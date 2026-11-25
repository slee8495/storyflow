// Chapter pictures — the morning batch's second half (scripts/nightly/nightly.sh, after it hands the
// translation to Claude). Runs on the operator's Mac, never on Vercel.
//
// 2026-11-24 user: "워드플로우 퀄리티의 사진들을 넣는거야 … 하루에 8장씩 … 8장부터 … 내가 현재
// 읽는책의 다음책까지만 하고 내가 따라잡을때까지 쉬는걸로". Up to 8 chapters a run, chosen by
// src/lib/pictureTargets.ts from where the operator's reader is. For each chapter:
// 1. `claude -p` (once) picks 3-6 moments and writes a photoreal image prompt for each, keeping
//    the book's look and its characters' faces consistent with the chapter pictured before it;
// 2. a local image model draws them (Z-Image Turbo via mflux — Wordflow's film venv, free);
// 3. JPEGs go to Vercel Blob and the chapter's rows to chapter_pictures, all at once.
//
// Usage: npx tsx --env-file=.env.local scripts/pictures/pictures.ts [--plan] [--max N] [--chapter <id>]
//   --plan  print what this run would draw ("todo <slug> <n>" lines, or "REST") and exit.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { del, put } from "@vercel/blob";
import { db } from "@/db";
import { bookmarks, books, chapterPictures, chapters, finishedBooks, readers, readingPlan, type Chapter } from "@/db/schema";
import { splitIntoChunks } from "@/lib/speak";
import { nextBookInPlan, pickPictureChapters } from "@/lib/pictureTargets";

const READER = process.env.PICTURES_READER ?? "SL";
const SKIP_BOOKS = ["art-tour"]; // a tour of real paintings — its pictures are the point
const WORK = path.join(os.homedir(), "Library/Caches/storyflow-pictures");
const MFLUX = process.env.PICTURES_MFLUX ?? path.join(os.homedir(), ".slstudio/wordflow-film/venv/bin/mflux-generate-z-image-turbo");
const CLAUDE = process.env.CLAUDE_BIN ?? "claude";
const W = 1344;
const H = 768;

const DEFAULT_STYLE =
  "Photorealistic cinematic film still, shot on ARRI Alexa 65 with anamorphic lens, historically accurate " +
  "period setting and costume, natural skin texture, real fabric and wear, natural light, muted color grade, " +
  "subtle film grain, prestige period drama, simple uncluttered composition";

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(5, 16), ...a);

// ---------- what to draw ----------

async function targets(max: number) {
  const [reader] = await db.select().from(readers).where(eq(readers.name, READER)).limit(1);
  if (!reader) throw new Error(`reader ${READER} not found`);
  const marks = await db
    .select({ bookId: bookmarks.bookId, slug: books.slug, chapterNumber: bookmarks.chapterNumber })
    .from(bookmarks)
    .innerJoin(books, eq(books.id, bookmarks.bookId))
    .where(eq(bookmarks.readerId, reader.id))
    .orderBy(desc(bookmarks.updatedAt))
    .limit(5);
  const pos = marks.find((m) => !SKIP_BOOKS.includes(m.slug));
  if (!pos) return { pos: null, picked: [] as Chapter[] };

  const plan = await db
    .select({ bookId: books.id, slug: books.slug })
    .from(readingPlan)
    .innerJoin(books, eq(books.slug, readingPlan.slug))
    .orderBy(asc(readingPlan.position));
  const finished = (await db.select({ id: finishedBooks.bookId }).from(finishedBooks).where(eq(finishedBooks.readerId, reader.id))).map((f) => f.id);
  const next = nextBookInPlan(plan, pos.bookId, finished);

  const bookIds = next ? [pos.bookId, next.bookId] : [pos.bookId];
  const rows = await db
    .select({
      id: chapters.id,
      bookId: chapters.bookId,
      chapterNumber: chapters.chapterNumber,
      translated: isNotNull(chapters.storyKo),
      pictured: sql<boolean>`exists (select 1 from chapter_pictures p where p.chapter_id = ${chapters.id})`,
    })
    .from(chapters)
    .where(inArray(chapters.bookId, bookIds));
  const picked = pickPictureChapters({
    currentBookId: pos.bookId,
    currentChapter: pos.chapterNumber,
    nextBookId: next?.bookId ?? null,
    chapters: rows.map((r) => ({ ...r, translated: !!r.translated, pictured: !!r.pictured })),
    max,
  });
  const ids = picked.map((p) => rows.find((r) => r.bookId === p.bookId && r.chapterNumber === p.chapterNumber)!.id);
  const full = ids.length ? await db.select().from(chapters).where(inArray(chapters.id, ids)) : [];
  return { pos, next, picked: ids.map((id) => full.find((c) => c.id === id)!) };
}

// ---------- prompts (the only Claude step) ----------

function claudeJson(prompt: string): unknown {
  const res = spawnSync(CLAUDE, ["-p", prompt, "--model", "opus", "--output-format", "text"], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    timeout: 20 * 60 * 1000,
  });
  if (res.status !== 0) throw new Error(`claude -p failed: ${res.stderr?.slice(0, 500)}`);
  const s = res.stdout;
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("claude -p returned no JSON");
  return JSON.parse(s.slice(a, b + 1));
}

// The most recently pictured chapter of the same book — its style and prompts keep the look and
// the characters' faces the same from chapter to chapter.
async function previousPictures(bookId: number) {
  const [last] = await db
    .select({ chapterId: chapterPictures.chapterId })
    .from(chapterPictures)
    .innerJoin(chapters, eq(chapters.id, chapterPictures.chapterId))
    .where(eq(chapters.bookId, bookId))
    .orderBy(desc(chapterPictures.createdAt))
    .limit(1);
  if (!last) return null;
  return db.select().from(chapterPictures).where(eq(chapterPictures.chapterId, last.chapterId)).orderBy(asc(chapterPictures.position));
}

type Scene = { from: number; prompt: string };

async function writePrompts(ch: Chapter, bookTitle: string, chunks: string[]): Promise<{ style: string; scenes: Scene[] }> {
  const prev = await previousPictures(ch.bookId);
  const chars = chunks.join("").length;
  const want = Math.max(3, Math.min(6, Math.round(chars / 1800)));
  const prompt = [
    `You are choosing the pictures for one chapter of "${bookTitle}" (chapter ${ch.chapterNumber}: ${ch.titleKo ?? ""}) in a personal audiobook-reading app. While the reader listens, one photorealistic picture at a time is shown pinned above the text; it changes as the story moves on.`,
    `The chapter's Korean text, in numbered chunks:\n${chunks.map((c, i) => `[${i}] ${c}`).join("\n")}`,
    `Pick ${want} moments (between 3 and 6) spread across the chapter. Each picture appears at a chunk number and stays until the next one; the first appears at chunk 0. Choose the moments a reader would most want to see — a new place, an arrival, a turning point, a striking image.`,
    `For each, write an English image prompt for a photorealistic still (an AI image model renders it): one concrete, filmable moment — who, where, action, light, camera framing. Historically accurate place, era and costume for this book. Real people, never cartoon or painting. Describe only what IS in the frame; never write "no X" (the image model adds anything you name). Describe every recurring character by appearance (age, hair, build, clothing) the same way each time — never rely on a name alone. Keep violence implied, never gore. Romance or sex: show only a fully clothed, non-sexual moment around it (a glance, hands, a candle-lit room, a closed door, a landscape) — never nudity.`,
    prev
      ? `The previous chapter's pictures, for continuity — describe the same characters the same way:\n${prev.map((p) => `- ${p.prompt}`).join("\n")}\nThe book's visual style string — return it unchanged: ${prev[0].style}`
      : `Also write the book's visual style string, shared by every picture of this book: start from this and adapt the place and era: ${DEFAULT_STYLE}`,
    `Reply with ONLY this JSON: {"style": "<style string>", "scenes": [{"from": <chunk number>, "prompt": "<English image prompt>"}]}`,
  ].join("\n\n");

  const raw = claudeJson(prompt) as { style?: string; scenes?: { from?: number; prompt?: string }[] };
  const scenes = (raw.scenes ?? []).filter((s): s is Scene => Number.isInteger(s.from) && !!s.prompt?.trim());
  if (scenes.length < 2) throw new Error("too few pictures");
  scenes[0].from = 0;
  for (let i = 1; i < scenes.length; i++) {
    if (scenes[i].from <= scenes[i - 1].from || scenes[i].from >= chunks.length) throw new Error("picture positions out of order");
  }
  return { style: prev?.[0].style ?? (raw.style?.trim() || DEFAULT_STYLE), scenes: scenes.map((s) => ({ from: s.from, prompt: s.prompt.trim() })) };
}

// ---------- drawing ----------

function run(cmd: string, args: (string | number)[]) {
  const r = spawnSync(cmd, args.map(String), { stdio: ["ignore", "ignore", "inherit"] });
  if (r.status !== 0) throw new Error(`${path.basename(cmd)} failed`);
}

function draw(prompt: string, seed: number, dir: string, name: string): string {
  const png = path.join(dir, `${name}.png`);
  const jpg = path.join(dir, `${name}.jpg`);
  if (!fs.existsSync(jpg)) {
    if (!fs.existsSync(png)) {
      run(MFLUX, ["-q", 4, "--low-ram", "--steps", 9, "--width", W, "--height", H, "--seed", seed, "--prompt", prompt, "--output", png]);
    }
    run("ffmpeg", ["-y", "-loglevel", "error", "-i", png, "-vf", "scale=1280:-2", "-q:v", 4, jpg]);
  }
  return jpg;
}

async function picture(ch: Chapter, slug: string, bookTitle: string) {
  const chunks = splitIntoChunks(ch.storyKo!);
  const total = chunks.join("").length;
  const dir = path.join(WORK, String(ch.id));
  fs.mkdirSync(dir, { recursive: true });

  // Prompts are cached on disk so a run cut short (time limit, Mac asleep) doesn't ask Claude again.
  const promptsFile = path.join(dir, "prompts.json");
  let script: { style: string; scenes: Scene[] };
  if (fs.existsSync(promptsFile)) script = JSON.parse(fs.readFileSync(promptsFile, "utf8"));
  else {
    log(`prompts ${slug} ${ch.chapterNumber} (${chunks.length} chunks)`);
    script = await writePrompts(ch, bookTitle, chunks);
    fs.writeFileSync(promptsFile, JSON.stringify(script, null, 1));
  }

  const jpgs = script.scenes.map((sc, i) => draw(`${script.style}. ${sc.prompt}`, 100 + i, dir, String(i).padStart(2, "0")));
  // No Blob store yet: keep the drawings on disk; the next run with a token just uploads them.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    log(`drawn   ${slug} ${ch.chapterNumber} (${jpgs.length} pictures) — no BLOB_READ_WRITE_TOKEN, waiting to upload`);
    return;
  }
  const rows: (typeof chapterPictures.$inferInsert)[] = [];
  for (const [i, sc] of script.scenes.entries()) {
    const jpg = jpgs[i];
    const blob = await put(`storyflow-pictures/${ch.id}/${i}.jpg`, fs.readFileSync(jpg), {
      access: "public",
      contentType: "image/jpeg",
      addRandomSuffix: true, // the store is public; the URL itself keeps the picture unlisted
      cacheControlMaxAge: 31536000,
    });
    const at = chunks.slice(0, sc.from).join("").length / total;
    rows.push({ chapterId: ch.id, position: i, at, imageUrl: blob.url, prompt: sc.prompt, style: script.style });
  }
  await db.transaction(async (tx) => {
    await tx.delete(chapterPictures).where(eq(chapterPictures.chapterId, ch.id));
    await tx.insert(chapterPictures).values(rows);
  });
  fs.rmSync(dir, { recursive: true, force: true });
  log(`done    ${slug} ${ch.chapterNumber} (${rows.length} pictures)`);
}

// 2026-11-24 user: "한번 지나간 건 다시 안봐도 되. 스토리플로우는 한번 읽고 지나가면 끝이니까" —
// pictures of chapters behind the one being read (and of books outside the current/next window)
// are deleted, from Blob and the DB and the local cache. The current chapter's stay.
async function purgePassed(pos: { bookId: number; chapterNumber: number }, nextBookId: number | null) {
  const keepBooks = nextBookId ? [pos.bookId, nextBookId] : [pos.bookId];
  const rows = await db
    .select({ id: chapterPictures.id, chapterId: chapterPictures.chapterId, imageUrl: chapterPictures.imageUrl, bookId: chapters.bookId, chapterNumber: chapters.chapterNumber })
    .from(chapterPictures)
    .innerJoin(chapters, eq(chapters.id, chapterPictures.chapterId));
  const isPassed = (r: { bookId: number; chapterNumber: number }) =>
    !keepBooks.includes(r.bookId) || (r.bookId === pos.bookId && r.chapterNumber < pos.chapterNumber);

  // Drawings still waiting on disk for chapters already read won't be needed either.
  const cached = fs.existsSync(WORK) ? fs.readdirSync(WORK).map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
  if (cached.length) {
    const cachedChapters = await db
      .select({ id: chapters.id, bookId: chapters.bookId, chapterNumber: chapters.chapterNumber })
      .from(chapters)
      .where(inArray(chapters.id, cached));
    for (const c of cachedChapters.filter(isPassed)) fs.rmSync(path.join(WORK, String(c.id)), { recursive: true, force: true });
  }

  const passed = rows.filter(isPassed);
  if (!passed.length) return;
  if (process.env.BLOB_READ_WRITE_TOKEN) await del(passed.map((r) => r.imageUrl)).catch((e) => log("  blob delete failed", String(e)));
  await db.delete(chapterPictures).where(inArray(chapterPictures.id, passed.map((r) => r.id)));
  for (const id of new Set(passed.map((r) => r.chapterId))) fs.rmSync(path.join(WORK, String(id)), { recursive: true, force: true });
  log(`purged  ${passed.length} pictures of ${new Set(passed.map((r) => r.chapterId)).size} chapters already read`);
}

async function main() {
  const args = process.argv.slice(2);
  const max = args.includes("--max") ? Number(args[args.indexOf("--max") + 1]) : 8;
  const only = args.includes("--chapter") ? Number(args[args.indexOf("--chapter") + 1]) : null;

  let list: Chapter[];
  if (only) list = await db.select().from(chapters).where(eq(chapters.id, only));
  else {
    const t = await targets(max);
    if (args.includes("--plan")) {
      if (!t.pos) console.log("REST (no bookmark)");
      else if (!t.picked.length) console.log(`REST — ${t.pos.slug} and ${t.next?.slug ?? "(no next book)"} are pictured as far as they're translated`);
      for (const c of t.picked) console.log(`todo ${c.bookId} ${c.chapterNumber}`);
      process.exit(0);
    }
    if (t.pos) log(`reader at ${t.pos.slug} ${t.pos.chapterNumber}; next book ${t.next?.slug ?? "none"}; ${t.picked.length} to draw`);
    if (t.pos) await purgePassed(t.pos, t.next?.bookId ?? null);
    list = t.picked;
  }

  const bookRows = await db.select().from(books);
  let failed = 0;
  for (const ch of list) {
    const book = bookRows.find((b) => b.id === ch.bookId)!;
    try {
      // Neon drops a connection left idle while the previous chapter was drawing (~10 min), so
      // the first query after it can fail; one retry gets a fresh one. Prompts and drawings are
      // cached on disk, so a retry costs nothing.
      await picture(ch, book.slug, book.title).catch((e) => {
        if (!String(e?.message ?? e).includes("Failed query")) throw e;
        log(`retry   ${book.slug} ${ch.chapterNumber} (database connection had gone stale)`);
        return picture(ch, book.slug, book.title);
      });
    } catch (e) {
      failed++;
      log(`FAILED  ${book.slug} ${ch.chapterNumber}:`, e instanceof Error ? e.message : e);
    }
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
