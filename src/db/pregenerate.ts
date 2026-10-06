import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "./index";
import { books, chapters } from "./schema";
import { ensureChapterContent } from "../lib/generateChapter";

// Generates every not-yet-generated chapter of one book up front (`npm run db:pregenerate --
// <slug>`), so a reader never waits on first open. On-demand generation in the chapter route still
// works. This just fills the same cache ahead of time — useful for books whose chapters take
// minutes each (Lady Chatterley parts run ~200s on Sonnet, see generateChapter.ts). A few
// chapters run concurrently. Re-running skips anything already generated, so an interrupted run
// can simply be restarted.
const CONCURRENCY = 4;

async function main() {
  const slug = process.argv[2];
  if (!slug) throw new Error("usage: npm run db:pregenerate -- <book-slug>");
  const [book] = await db.select().from(books).where(eq(books.slug, slug)).limit(1);
  if (!book) throw new Error(`no book with slug ${slug}`);

  const pending = await db
    .select({ id: chapters.id, chapterNumber: chapters.chapterNumber })
    .from(chapters)
    .where(and(eq(chapters.bookId, book.id), isNull(chapters.generatedAt)))
    .orderBy(asc(chapters.chapterNumber));
  console.log(`${pending.length} chapters to generate for ${slug}`);

  let failed = 0;
  const queue = [...pending];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const started = Date.now();
        try {
          const row = await ensureChapterContent(next.id);
          console.log(`ch ${next.chapterNumber} done in ${Math.round((Date.now() - started) / 1000)}s — ${row.titleKo}`);
        } catch (err) {
          failed++;
          console.error(`ch ${next.chapterNumber} FAILED:`, err instanceof Error ? err.message : err);
        }
      }
    }),
  );

  console.log(`finished: ${pending.length - failed} generated, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
