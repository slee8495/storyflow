import { and, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { chapters, progressSnapshots, type Book } from "@/db/schema";
import { splitIntoChunks } from "@/lib/speak";

// How far back to look when estimating reading pace — same 14-day window Wordflow uses for its
// projectedCompletionDate (see ../../../wordflow/src/lib/progress.ts).
const PACE_WINDOW_DAYS = 14;

function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// Fraction (0-1) through one chapter, given a saved sentence position. Null chunkIndex/lang
// (never listened to or clicked a sentence in this chapter yet) reads as "just started" (0), not
// an error — a bare chapter-level bookmark with no sentence position is a valid, common state.
export async function computeChapterFraction(
  bookId: number,
  chapterNumber: number,
  chunkIndex: number | null,
  lang: "ko" | "en" | null,
): Promise<number> {
  if (chunkIndex === null || !lang) return 0;
  const [chapter] = await db
    .select()
    .from(chapters)
    .where(and(eq(chapters.bookId, bookId), eq(chapters.chapterNumber, chapterNumber)))
    .limit(1);
  const text = chapter ? (lang === "en" ? chapter.storyEn : chapter.storyKo) : null;
  if (!text) return 0;
  const totalChunks = splitIntoChunks(text).length;
  if (totalChunks === 0) return 0;
  return Math.min(1, (chunkIndex + 1) / totalChunks);
}

// Whole-book progress (0-100) — chapters fully before the current one, plus how far into the
// current chapter the reader's sentence position reaches. Smoother than a bare chapter-count
// ratio: it moves within a chapter, not just when a chapter completes.
export async function computeOverallProgressPct(
  book: Book,
  chapterNumber: number,
  chunkIndex: number | null,
  lang: "ko" | "en" | null,
): Promise<number> {
  if (!book.totalChapters || book.totalChapters <= 0) return 0;
  const fraction = await computeChapterFraction(book.id, chapterNumber, chunkIndex, lang);
  const pct = ((chapterNumber - 1 + fraction) / book.totalChapters) * 100;
  return Math.max(0, Math.min(100, pct));
}

// Upserts today's snapshot with the max of the existing/new value — see the schema comment on
// progressSnapshots for why "best of the day" rather than "latest write of the day".
export async function recordProgressSnapshot(readerId: number, bookId: number, pct: number): Promise<void> {
  const day = todayUtcDateString();
  const [existing] = await db
    .select()
    .from(progressSnapshots)
    .where(and(eq(progressSnapshots.readerId, readerId), eq(progressSnapshots.bookId, bookId), eq(progressSnapshots.day, day)))
    .limit(1);

  if (existing) {
    if (pct > existing.progressPct) {
      await db
        .update(progressSnapshots)
        .set({ progressPct: pct, updatedAt: new Date() })
        .where(eq(progressSnapshots.id, existing.id));
    }
    return;
  }

  await db.insert(progressSnapshots).values({ readerId, bookId, day, progressPct: pct });
}

export type ProjectedCompletion = { date: string; daysRemaining: number };

// Trailing-pace projection — compares the oldest and newest snapshot within the window to derive
// a %/day rate, then projects forward from the reader's CURRENT (live-computed, not necessarily
// yet snapshotted today) percentage to 100%. Returns null when there isn't enough history yet
// (fewer than two distinct days of data) or when the trailing rate isn't actually positive —
// same "not enough data" fallback Wordflow shows in that case.
export async function projectCompletion(
  readerId: number,
  bookId: number,
  currentPct: number,
): Promise<ProjectedCompletion | null> {
  if (currentPct >= 100) return { date: todayUtcDateString(), daysRemaining: 0 };

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - PACE_WINDOW_DAYS);
  const sinceStr = since.toISOString().slice(0, 10);

  const rows = await db
    .select()
    .from(progressSnapshots)
    .where(and(eq(progressSnapshots.readerId, readerId), eq(progressSnapshots.bookId, bookId), gte(progressSnapshots.day, sinceStr)))
    .orderBy(progressSnapshots.day);

  if (rows.length < 2) return null;

  const first = rows[0];
  const last = rows[rows.length - 1];
  const daysSpan = Math.max(1, Math.round((new Date(last.day).getTime() - new Date(first.day).getTime()) / 86_400_000));
  const pctGained = last.progressPct - first.progressPct;
  if (pctGained <= 0) return null;

  const ratePerDay = pctGained / daysSpan;
  const remainingPct = 100 - currentPct;
  const daysRemaining = Math.ceil(remainingPct / ratePerDay);

  const projected = new Date();
  projected.setUTCDate(projected.getUTCDate() + daysRemaining);
  return { date: projected.toISOString().slice(0, 10), daysRemaining };
}
