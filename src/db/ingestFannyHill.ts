import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq, and } from "drizzle-orm";
import { db } from "./index";
import { books, chapters } from "./schema";

// One-off ingestion for John Cleland's Memoirs of a Woman of Pleasure ("Fanny Hill") — Project
// Gutenberg ebook #25305 (gutenberg.org/ebooks/25305), the unexpurgated Isidore Liseux edition
// "from the original text (London, 1749)". Public domain everywhere (Cleland died in 1789).
//
// The novel is just two long letters (~42k words each), so — same as ingestChatterley.ts — each
// letter is split at paragraph boundaries into roughly equal parts of at most ~MAX_PART_WORDS,
// numbered sequentially across the book. No illustrations for this one.
const SOURCE_PATH = join(process.cwd(), "data", "fanny-hill-source.txt");
const BOOK_SLUG = "fanny-hill";
const MAX_PART_WORDS = 3500;

const LETTER_HEADER = /^LETTER THE (FIRST|SECOND)\s*$/gm;
const LETTER_FOOTER = /^THE END OF THE FIRST LETTER\s*$/m;
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

export function parseFannyHill(raw: string): { sourceTitle: string; sourceText: string }[] {
  const body = raw.slice(0, raw.indexOf(GUTENBERG_END));
  // The table of contents repeats both headings indented; the real ones start at column 0.
  const matches = [...body.matchAll(LETTER_HEADER)];
  if (matches.length !== 2) throw new Error(`expected 2 letter headers, found ${matches.length}`);

  return matches.flatMap((match, i) => {
    const bodyStart = match.index! + match[0].length;
    const bodyEnd = i + 1 < matches.length ? matches[i + 1].index! : body.length;
    const letter = body.slice(bodyStart, bodyEnd).replace(LETTER_FOOTER, "");
    const label = i === 0 ? "Letter I" : "Letter II";
    const parts = splitIntoParts(letter);
    return parts.map((sourceText, p) => ({
      sourceTitle: `${label} · Part ${p + 1} of ${parts.length}`,
      sourceText,
    }));
  });
}

async function main() {
  const parsed = parseFannyHill(readFileSync(SOURCE_PATH, "utf-8"));
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
  process.exit(0);
}

// Only run when executed directly (`npm run db:ingest-fanny-hill`), so parseFannyHill can be
// imported for inspection without touching the database.
if (process.argv[1]?.endsWith("ingestFannyHill.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
