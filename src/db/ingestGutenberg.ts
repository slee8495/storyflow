import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { books } from "./schema";
import { insertChapters, splitIntoParts, wordCount, type SourceRow } from "./splitParts";
import { BOOK_QUEUE, type QueuedBook } from "../lib/bookQueue";

// Generic ingestion for the reading-plan books in src/lib/bookQueue.ts (`npx tsx
// --env-file=.env.local src/db/ingestGutenberg.ts <slug> [--dry]`). Downloads the Project
// Gutenberg plain text once into data/gutenberg/ (gitignored — fetchable again any time), finds
// chapters by the book's `chapterHeading`, and groups short consecutive chapters into rows of up
// to MAX_ROW_WORDS — never across a `partHeading` — splitting any longer chapter at paragraph
// breaks, same shape as ingestAnnaKarenina.ts. Segments under MIN_CHAPTER_WORDS are tables of
// contents, not chapters, and are dropped. `--dry` prints the rows without touching the DB.
const MAX_ROW_WORDS = 3500;
const MIN_CHAPTER_WORDS = 150;
const START = /\*\*\* START OF TH(E|IS) PROJECT GUTENBERG EBOOK.*\*\*\*/;
const END = "*** END OF TH";
const BACK_MATTER = /^ *(FOOTNOTES:?|LETTER TO M\. DAELLI) *$/m;

export async function loadSource(book: QueuedBook): Promise<string> {
  const dir = join(process.cwd(), "data", "gutenberg");
  const path = join(dir, `${book.gutenbergId}.txt`);
  if (!existsSync(path)) {
    const res = await fetch(`https://www.gutenberg.org/cache/epub/${book.gutenbergId}/pg${book.gutenbergId}.txt`);
    if (!res.ok) throw new Error(`download failed for ${book.slug}: ${res.status}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, await res.text());
  }
  return readFileSync(path, "utf-8");
}

export function parseGutenberg(raw: string, book: QueuedBook): SourceRow[] {
  const start = raw.match(START);
  let body = raw.slice(start ? start.index! + start[0].length : 0);
  body = body.slice(0, body.indexOf(END) === -1 ? body.length : body.indexOf(END)).replace(/\r/g, "");

  // Walk the lines once: each part heading closes the current part, each chapter heading opens a
  // chapter. Text before the first chapter heading (title page, preface, contents) is dropped.
  type Chapter = { heading: string; part: string; lines: string[] };
  const chaptersFound: Chapter[] = [];
  let part = "";
  let current: Chapter | null = null;
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (book.partHeading?.test(trimmed) && !book.chapterHeading.test(trimmed)) {
      part = trimmed;
      current = null;
      continue;
    }
    if (book.chapterHeading.test(trimmed)) {
      current = { heading: trimmed, part, lines: [] };
      chaptersFound.push(current);
      continue;
    }
    current?.lines.push(line);
  }
  const withText = chaptersFound.map((c) => ({ ...c, text: c.lines.join("\n").trim() }));
  const startAt = book.startAt ?? book.chapterHeading;
  const first = withText.findIndex((c) => startAt.test(c.heading) && wordCount(c.text) >= MIN_CHAPTER_WORDS);
  const story = withText.slice(Math.max(0, first));
  // Back matter (the translator's footnotes, Hugo's letter) follows the last chapter: cut there.
  const backMatter = story.findIndex((c) => BACK_MATTER.test(c.text));
  if (backMatter !== -1) {
    const c = story[backMatter];
    story.splice(backMatter, story.length, { ...c, text: c.text.slice(0, c.text.search(BACK_MATTER)).trim() });
  }
  const chapters = story.filter((c) => wordCount(c.text) >= MIN_CHAPTER_WORDS);
  if (chapters.length === 0) throw new Error(`${book.slug}: no chapters matched`);

  const label = (c: { heading: string; part: string }) => (c.part ? `${c.part} · ${c.heading}` : c.heading);
  const rows: SourceRow[] = [];
  let group: typeof chapters = [];
  const flush = () => {
    if (group.length === 0) return;
    const first = label(group[0]);
    rows.push({
      sourceTitle: group.length === 1 ? first : `${first} – ${group[group.length - 1].heading}`,
      sourceText: group.map((c) => `${c.heading}\n\n${c.text}`).join("\n\n"),
    });
    group = [];
  };
  for (const chapter of chapters) {
    const words = wordCount(chapter.text);
    if (group.length > 0 && group[0].part !== chapter.part) flush();
    if (words > MAX_ROW_WORDS) {
      flush();
      const pieces = splitIntoParts(chapter.text, MAX_ROW_WORDS);
      pieces.forEach((text, p) =>
        rows.push({
          sourceTitle: `${label(chapter)} · Section ${p + 1} of ${pieces.length}`,
          sourceText: `${chapter.heading}\n\n${text}`,
        }),
      );
      continue;
    }
    if (group.length > 0 && group.reduce((n, c) => n + wordCount(c.text), 0) + words > MAX_ROW_WORDS) flush();
    group.push(chapter);
  }
  flush();
  return rows;
}

// Creates the books row from the queue entry if it isn't there yet, then inserts the chapters.
export async function ingestQueuedBook(book: QueuedBook) {
  const rows = parseGutenberg(await loadSource(book), book);
  const [existing] = await db.select().from(books).where(eq(books.slug, book.slug)).limit(1);
  if (!existing) {
    await db.insert(books).values({
      slug: book.slug,
      title: book.title,
      titleEn: book.titleEn,
      author: book.author,
      coverColor: book.coverColor,
      description: book.description,
      descriptionEn: book.descriptionEn,
    });
  }
  await insertChapters(book.slug, rows);
  return rows.length;
}

if (process.argv[1]?.endsWith("ingestGutenberg.ts")) {
  const [slug, flag] = process.argv.slice(2);
  const targets = slug === "--all" ? BOOK_QUEUE : BOOK_QUEUE.filter((b) => b.slug === slug);
  if (targets.length === 0) throw new Error(`no queued book ${slug}`);
  (async () => {
    for (const book of targets) {
      if (flag === "--dry" || slug === "--all") {
        const rows = parseGutenberg(await loadSource(book), book);
        const words = rows.map((r) => wordCount(r.sourceText));
        console.log(
          `${book.slug}: ${rows.length} rows, ${words.reduce((a, b) => a + b, 0)} words, ` +
            `smallest ${Math.min(...words)}, largest ${Math.max(...words)} | first: ${rows[0].sourceTitle} | last: ${rows[rows.length - 1].sourceTitle}`,
        );
      } else {
        console.log(`${book.slug}: ingested ${await ingestQueuedBook(book)} rows`);
      }
    }
    process.exit(0);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
