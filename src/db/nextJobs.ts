import { asc, eq } from "drizzle-orm";
import { join } from "node:path";
import { db } from "./index";
import { books, readingPlan } from "./schema";
import { exportJobs } from "./exportPending";
import { ingestQueuedBook } from "./ingestGutenberg";
import { BOOK_QUEUE } from "../lib/bookQueue";

// The nightly batch's picker (`npx tsx --env-file=.env.local src/db/nextJobs.ts <dir> [max]`):
// walks the reading plan in order and exports up to `max` (default 8) ungenerated chapters as
// job files into <dir>/<slug>/, ingesting a plan book from Project Gutenberg the first time its
// turn comes. Prints one `<slug>=<n>` per book it exported from, or `ALL_DONE` when nothing in
// the plan is left to translate. Plan entries that are neither in the library nor in
// bookQueue.ts are skipped with a warning.
async function main() {
  const [dir, maxArg] = process.argv.slice(2);
  if (!dir) throw new Error("usage: nextJobs.ts <out-dir> [max]");
  let remaining = Number(maxArg ?? 8);
  const plan = await db.select().from(readingPlan).orderBy(asc(readingPlan.position));
  const exported: string[] = [];
  for (const { slug } of plan) {
    if (remaining <= 0) break;
    let [book] = await db.select().from(books).where(eq(books.slug, slug)).limit(1);
    if (!book) {
      const queued = BOOK_QUEUE.find((b) => b.slug === slug);
      if (!queued) {
        console.error(`skipping ${slug}: not in the library or bookQueue.ts`);
        continue;
      }
      console.error(`ingesting ${slug}: ${await ingestQueuedBook(queued)} rows`);
      [book] = await db.select().from(books).where(eq(books.slug, slug)).limit(1);
    }
    const numbers = await exportJobs(book, join(dir, slug), remaining);
    if (numbers.length > 0) exported.push(`${slug}=${numbers.length}`);
    remaining -= numbers.length;
  }
  console.log(exported.length ? exported.join(" ") : "ALL_DONE");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
