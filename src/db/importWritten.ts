import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./index";
import { books, chapters } from "./schema";
import { looksComplete } from "../lib/generateChapter";

// Loads chapters written by Claude Code (see exportPending.ts): each <chapter>.out.md holds four
// sections, each starting with a marker line —
//   ===TITLE_KO===  ===STORY_KO===  ===TITLE_EN===  ===STORY_EN===
// A file that's missing a section, looks cut off, or is far shorter than its source is reported
// and skipped, so it can be rewritten. Only chapters still ungenerated are written.
const MARKERS = ["TITLE_KO", "STORY_KO", "TITLE_EN", "STORY_EN"] as const;
// The English retelling of a part normally runs ~0.8-1x its source's length (more for Chinese,
// whose characters pack more per word); well under that means something got skipped.
const MIN_EN_TO_SOURCE = 0.5;

function parse(text: string): Record<(typeof MARKERS)[number], string> | null {
  const parts = text.split(/^===(TITLE_KO|STORY_KO|TITLE_EN|STORY_EN)===\s*$/m);
  const out: Partial<Record<(typeof MARKERS)[number], string>> = {};
  for (let i = 1; i < parts.length; i += 2) out[parts[i] as (typeof MARKERS)[number]] = parts[i + 1].trim();
  return MARKERS.every((m) => out[m]) ? (out as Record<(typeof MARKERS)[number], string>) : null;
}

async function main() {
  const [slug, dir] = process.argv.slice(2);
  if (!slug || !dir) throw new Error("usage: importWritten.ts <book-slug> <dir>");
  const [book] = await db.select().from(books).where(eq(books.slug, slug)).limit(1);
  if (!book) throw new Error(`no book with slug ${slug}`);
  const pending = await db
    .select()
    .from(chapters)
    .where(and(eq(chapters.bookId, book.id), isNull(chapters.generatedAt)));

  let written = 0;
  const problems: string[] = [];
  for (const chapter of pending) {
    const file = join(dir, `${chapter.chapterNumber}.out.md`);
    if (!existsSync(file)) continue;
    const content = parse(readFileSync(file, "utf-8"));
    if (!content) {
      problems.push(`${chapter.chapterNumber}: missing a section`);
      continue;
    }
    if (!looksComplete(content.STORY_KO) || !looksComplete(content.STORY_EN)) {
      problems.push(`${chapter.chapterNumber}: story looks cut off`);
      continue;
    }
    const ratio = content.STORY_EN.length / chapter.sourceText.length;
    if (ratio < MIN_EN_TO_SOURCE && !/[一-鿿]/.test(chapter.sourceText.slice(0, 200))) {
      problems.push(`${chapter.chapterNumber}: English is only ${Math.round(ratio * 100)}% of the source length`);
      continue;
    }
    await db
      .update(chapters)
      .set({
        titleKo: content.TITLE_KO,
        storyKo: content.STORY_KO,
        titleEn: content.TITLE_EN,
        storyEn: content.STORY_EN,
        generatedAt: new Date(),
      })
      .where(and(eq(chapters.id, chapter.id), isNull(chapters.generatedAt)));
    written++;
  }
  console.log(`imported ${written}; ${pending.length - written} still pending`);
  for (const p of problems) console.log(`  problem — ${p}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
