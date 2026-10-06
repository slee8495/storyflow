import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "./index";
import { books, chapters, chapterIllustrations } from "./schema";

// One-off ingestion for D. H. Lawrence's Lady Chatterley's Lover — Project Gutenberg ebook
// #73144 (gutenberg.org/ebooks/73144), the unexpurgated third-manuscript text (Florence/Orioli,
// 1928). Lawrence died in 1930, so this is public domain both in the US and life+70 countries.
//
// Unlike 삼국지's 120 short 回, the novel's 19 chapters run 3k-15k words each — far more than one
// generateObject call can retell bilingually without quietly abridging (and generateChapter.ts
// explicitly asks for a retelling, not a summary). So each original chapter is split at paragraph
// boundaries into roughly equal parts of at most ~MAX_PART_WORDS, and every part becomes its own
// `chapters` row numbered sequentially across the book (42 rows total). `sourceTitle` keeps the
// original chapter/part label so the table of contents and the generation prompt both know where
// a row sits in the novel.
//
// Also loads the per-row illustrations (public-domain museum artworks hand-picked per part, see
// data/chatterley-illustrations.json) — re-running replaces each row's illustration set, so the
// JSON can be tweaked and re-ingested without touching generated story text.
const SOURCE_PATH = join(process.cwd(), "data", "chatterley-source.txt");
const ILLUSTRATIONS_PATH = join(process.cwd(), "data", "chatterley-illustrations.json");
const BOOK_SLUG = "chatterley";
const MAX_PART_WORDS = 3500;

const CHAPTER_HEADER = /^\s*CHAPTER ([IVXL]+)\s*$/gm;
const GUTENBERG_END = "*** END OF THE PROJECT GUTENBERG EBOOK";

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

// Greedy, balanced split: aim each part at total/n words (n = parts needed to stay under the
// max), cutting only between paragraphs so no scene is sliced mid-paragraph.
function splitIntoParts(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const total = paragraphs.reduce((sum, p) => sum + wordCount(p), 0);
  const partCount = Math.ceil(total / MAX_PART_WORDS);
  const target = total / partCount;

  const parts: string[][] = [[]];
  let running = 0;
  for (const p of paragraphs) {
    parts[parts.length - 1].push(p);
    running += wordCount(p);
    if (parts.length < partCount && running >= target * parts.length) parts.push([]);
  }
  return parts.filter((p) => p.length > 0).map((p) => p.join("\n\n"));
}

export function parseChatterley(raw: string): { sourceTitle: string; sourceText: string }[] {
  const body = raw.slice(0, raw.indexOf(GUTENBERG_END));
  const matches = [...body.matchAll(CHAPTER_HEADER)];
  if (matches.length !== 19) throw new Error(`expected 19 chapter headers, found ${matches.length}`);

  return matches.flatMap((match, i) => {
    const bodyStart = match.index! + match[0].length;
    const bodyEnd = i + 1 < matches.length ? matches[i + 1].index! : body.length;
    const parts = splitIntoParts(body.slice(bodyStart, bodyEnd));
    return parts.map((sourceText, p) => ({
      sourceTitle: parts.length > 1 ? `Chapter ${match[1]} · Part ${p + 1} of ${parts.length}` : `Chapter ${match[1]}`,
      sourceText,
    }));
  });
}

type IllustrationEntry = {
  chapterNumber: number;
  imageUrl: string;
  title: string;
  artist: string;
  dateDisplay?: string;
  credit: string;
  sourceUrl: string;
  captionKo: string;
  captionEn: string;
};

async function main() {
  const parsed = parseChatterley(readFileSync(SOURCE_PATH, "utf-8"));
  console.log(`parsed ${parsed.length} parts from ${SOURCE_PATH}`);

  const [book] = await db.select().from(books).where(eq(books.slug, BOOK_SLUG)).limit(1);
  if (!book) throw new Error(`${BOOK_SLUG} book row not found — run \`npm run db:seed\` first`);

  let inserted = 0;
  let skipped = 0;
  for (const [i, chapter] of parsed.entries()) {
    const chapterNumber = i + 1;
    const [existing] = await db
      .select({ id: chapters.id })
      .from(chapters)
      .where(and(eq(chapters.bookId, book.id), eq(chapters.chapterNumber, chapterNumber)))
      .limit(1);
    if (existing) {
      skipped++;
      continue;
    }
    await db.insert(chapters).values({ bookId: book.id, chapterNumber, ...chapter });
    inserted++;
  }
  await db.update(books).set({ totalChapters: parsed.length }).where(eq(books.id, book.id));
  console.log(`inserted ${inserted} new chapters, skipped ${skipped} already present`);

  if (!existsSync(ILLUSTRATIONS_PATH)) {
    console.log(`no ${ILLUSTRATIONS_PATH} yet — skipping illustrations`);
    process.exit(0);
  }
  const illustrations: IllustrationEntry[] = JSON.parse(readFileSync(ILLUSTRATIONS_PATH, "utf-8"));
  const rows = await db
    .select({ id: chapters.id, chapterNumber: chapters.chapterNumber })
    .from(chapters)
    .where(eq(chapters.bookId, book.id));
  const idByNumber = new Map(rows.map((r) => [r.chapterNumber, r.id]));

  await db.delete(chapterIllustrations).where(inArray(chapterIllustrations.chapterId, rows.map((r) => r.id)));
  const positionByChapter = new Map<number, number>();
  for (const entry of illustrations) {
    const chapterId = idByNumber.get(entry.chapterNumber);
    if (!chapterId) throw new Error(`illustration references missing chapter ${entry.chapterNumber}`);
    const position = positionByChapter.get(entry.chapterNumber) ?? 0;
    positionByChapter.set(entry.chapterNumber, position + 1);
    await db.insert(chapterIllustrations).values({
      chapterId,
      position,
      imageUrl: entry.imageUrl,
      title: entry.title,
      artist: entry.artist,
      dateDisplay: entry.dateDisplay ?? null,
      credit: entry.credit,
      sourceUrl: entry.sourceUrl,
      captionKo: entry.captionKo,
      captionEn: entry.captionEn,
    });
  }
  console.log(`loaded ${illustrations.length} illustrations`);
  process.exit(0);
}

// Only run when executed directly (`npm run db:ingest-chatterley`), so parseChatterley can be
// imported for inspection without touching the database.
if (process.argv[1]?.endsWith("ingestChatterley.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
