import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { books, bookmarks } from "@/db/schema";
import { computeOverallProgressPct, recordProgressSnapshot } from "@/lib/progress";

// Upserts a reader's "last read chapter" (+ optional in-chapter sentence position) for a book —
// called both when a chapter's reading page mounts (chapterNumber only) and whenever TTS/click
// playback advances to a new sentence within the chapter (chapterNumber + chunkIndex + lang).
// One row per (readerId, bookId).
//
// chunkIndex/lang handling: if the caller omits them (the "I just opened this chapter" call),
// the existing position is PRESERVED when re-opening the same chapter (so a page reload doesn't
// wipe out where you were), but RESET to null when chapterNumber actually changed — a chunkIndex
// from a different chapter's text doesn't mean anything here. If the caller explicitly provides
// chunkIndex/lang (the "I just listened to/clicked a sentence" call), those values always win.
//
// Also records today's progress-percentage snapshot (see src/lib/progress.ts) — every bookmark
// write is a "progress changed" event, whether or not it carries a sentence position, since even
// a bare chapterNumber move shifts the whole-book percentage.
export async function POST(req: NextRequest) {
  const { readerId, bookId, chapterNumber, chunkIndex, lang } = await req.json().catch(() => ({}));
  if (!readerId || !bookId || !chapterNumber) {
    return NextResponse.json({ error: "readerId, bookId, and chapterNumber are required" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.readerId, readerId), eq(bookmarks.bookId, bookId)))
    .limit(1);

  const positionProvided = typeof chunkIndex === "number" && (lang === "ko" || lang === "en");
  const sameChapter = existing?.chapterNumber === chapterNumber;
  const nextChunkIndex = positionProvided ? chunkIndex : sameChapter ? (existing?.chunkIndex ?? null) : null;
  const nextLang = positionProvided ? lang : sameChapter ? (existing?.lang ?? null) : null;

  const bookmark = existing
    ? (
        await db
          .update(bookmarks)
          .set({ chapterNumber, chunkIndex: nextChunkIndex, lang: nextLang, updatedAt: new Date() })
          .where(eq(bookmarks.id, existing.id))
          .returning()
      )[0]
    : (
        await db
          .insert(bookmarks)
          .values({ readerId, bookId, chapterNumber, chunkIndex: nextChunkIndex, lang: nextLang })
          .returning()
      )[0];

  const [book] = await db.select().from(books).where(eq(books.id, bookId)).limit(1);
  if (book) {
    const pct = await computeOverallProgressPct(book, chapterNumber, nextChunkIndex, nextLang as "ko" | "en" | null);
    await recordProgressSnapshot(readerId, bookId, pct).catch(() => {
      // best-effort — a failed snapshot write shouldn't fail the bookmark save itself
    });
  }

  return NextResponse.json({ bookmark });
}
