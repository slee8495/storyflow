import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq, and } from "drizzle-orm";
import { db } from "./index";
import { books, chapters } from "./schema";

// One-off ingestion for 삼국지's source text — chunks the public-domain Chinese original
// (Luo Guanzhong's 三國志演義, Project Gutenberg ebook #23950: gutenberg.org/ebooks/23950,
// "Public domain in the USA") into 120 `chapters` rows keyed by chapter number, matching the
// novel's own traditional 120-回 division. The Chinese original was picked over an English
// translation because (a) it's a single complete public-domain file covering all 120 chapters —
// the well-known Brewitt-Taylor English translation on Gutenberg is split across two volumes and
// only volume 1 (chapters 1-60) could be found there — and (b) Claude reads classical Chinese
// well enough to ground the bilingual (Korean+English) easy-retelling rewrite in
// generateChapter.ts without needing a pre-translated intermediate.
//
// Chapter boundaries follow the text's own "第N回：<heading>" markers (Chinese chapter-numeral
// spelling varies — "第一回", later "第一一六回", "第一二○回" — so this doesn't parse the
// numeral at all, it just splits on each match in document order and numbers them 1..120
// sequentially).
const SOURCE_PATH = join(process.cwd(), "data", "samgukji-source.txt");
const CHAPTER_HEADER = /^第.+回：(.+)$/gm;

function parseChapters(raw: string): { sourceTitle: string; sourceText: string }[] {
  const matches = [...raw.matchAll(CHAPTER_HEADER)];
  if (matches.length === 0) throw new Error("no chapter headers found — source file format may have changed");

  return matches.map((match, i) => {
    const bodyStart = match.index! + match[0].length;
    const bodyEnd = i + 1 < matches.length ? matches[i + 1].index! : raw.length;
    return {
      sourceTitle: match[1].trim(),
      sourceText: raw.slice(bodyStart, bodyEnd).trim(),
    };
  });
}

async function main() {
  const raw = readFileSync(SOURCE_PATH, "utf-8");
  const parsedChapters = parseChapters(raw);
  console.log(`parsed ${parsedChapters.length} chapters from ${SOURCE_PATH}`);

  const [book] = await db.select().from(books).where(eq(books.slug, "samgukji")).limit(1);
  if (!book) throw new Error("samgukji book row not found — run `npm run db:seed` first");

  let inserted = 0;
  let skipped = 0;
  for (const [i, chapter] of parsedChapters.entries()) {
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
    await db.insert(chapters).values({
      bookId: book.id,
      chapterNumber,
      sourceTitle: chapter.sourceTitle,
      sourceText: chapter.sourceText,
    });
    inserted++;
  }

  await db.update(books).set({ totalChapters: parsedChapters.length }).where(eq(books.id, book.id));

  console.log(`inserted ${inserted} new chapters, skipped ${skipped} already present`);
  console.log(`books.totalChapters set to ${parsedChapters.length}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
