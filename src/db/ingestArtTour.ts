import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq, and } from "drizzle-orm";
import { db } from "./index";
import { books, chapters } from "./schema";
import { replaceIllustrations, type IllustrationEntry } from "./illustrations";

// Ingestion for the art-history tour (`npm run db:ingest-art-tour`) — an original Storyflow book
// inspired by Gombrich's The Story of Art, not a retelling of it (Gombrich's text is in copyright;
// see docs/project-context.md). There is no source text: data/art-tour.json is a curated outline,
// one public-domain artwork per chapter in chronological order, each with a fact sheet (`notes`)
// and its museum images. The fact sheet becomes the row's `sourceText`, which generateChapter.ts
// writes a fresh docent-style chapter from (see BOOK_ROLES["art-tour"] there).
//
// Unlike the novels, re-running UPDATES existing rows' sourceText/sourceTitle (the outline is
// ours to edit) — and clears generatedAt on any row whose notes changed, so its chapter text is
// regenerated from the new facts on next read rather than going stale.
const OUTLINE_PATH = join(process.cwd(), "data", "art-tour.json");
const BOOK_SLUG = "art-tour";

type OutlineChapter = {
  chapterNumber: number;
  sectionKo: string;
  sectionEn: string;
  nudeThread: boolean;
  notes: string;
  illustrations: IllustrationEntry[];
};

function toSourceText(c: OutlineChapter): string {
  const works = c.illustrations
    .map((i) => `- ${i.title} — ${i.artist}${i.dateDisplay ? `, ${i.dateDisplay}` : ""} (${i.credit})`)
    .join("\n");
  return [
    `Section: ${c.sectionEn} (${c.sectionKo})`,
    c.nudeThread ? "Part of the book's recurring thread on the nude: how the depiction of the body changes across eras." : null,
    `Artwork(s) shown above the chapter:\n${works}`,
    `Fact sheet:\n${c.notes}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function main() {
  const outline: OutlineChapter[] = JSON.parse(readFileSync(OUTLINE_PATH, "utf-8"));
  const [book] = await db.select().from(books).where(eq(books.slug, BOOK_SLUG)).limit(1);
  if (!book) throw new Error(`${BOOK_SLUG} book row not found — run \`npm run db:seed\` first`);

  const byChapterId = new Map<number, IllustrationEntry[]>();
  let inserted = 0;
  let changed = 0;
  for (const c of outline) {
    const sourceTitle = `${c.sectionKo} · ${c.illustrations[0].title}`;
    const sourceText = toSourceText(c);
    const [existing] = await db
      .select()
      .from(chapters)
      .where(and(eq(chapters.bookId, book.id), eq(chapters.chapterNumber, c.chapterNumber)))
      .limit(1);
    let chapterId: number;
    if (!existing) {
      const [row] = await db
        .insert(chapters)
        .values({ bookId: book.id, chapterNumber: c.chapterNumber, sourceTitle, sourceText })
        .returning({ id: chapters.id });
      chapterId = row.id;
      inserted++;
    } else {
      chapterId = existing.id;
      if (existing.sourceText !== sourceText || existing.sourceTitle !== sourceTitle) {
        await db
          .update(chapters)
          .set({ sourceTitle, sourceText, generatedAt: null })
          .where(eq(chapters.id, existing.id));
        changed++;
      }
    }
    byChapterId.set(chapterId, c.illustrations);
  }
  await replaceIllustrations(byChapterId);
  await db.update(books).set({ totalChapters: outline.length }).where(eq(books.id, book.id));

  console.log(`inserted ${inserted}, updated ${changed} (marked for regeneration), total ${outline.length} chapters`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
