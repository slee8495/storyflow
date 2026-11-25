import { asc, desc, eq } from "drizzle-orm";
import { join } from "node:path";
import { db } from "./index";
import { bookmarks, books, finishedBooks, readers, readingPlan } from "./schema";
import { exportJobs } from "./exportPending";
import { ingestQueuedBook } from "./ingestGutenberg";
import { BOOK_QUEUE } from "../lib/bookQueue";
import { translationWindow } from "../lib/translationWindow";

const READER = process.env.PICTURES_READER ?? "SL";
const SKIP_BOOKS = ["art-tour"]; // same as the pictures batch

// The nightly batch's picker (`npx tsx --env-file=.env.local src/db/nextJobs.ts <dir> [max]`):
// walks the reading plan in order and exports up to `max` (default 8) ungenerated chapters as
// job files into <dir>/<slug>/, ingesting a plan book from Project Gutenberg the first time its
// turn comes. Prints one `<slug>=<n>` per book it exported from, or `ALL_DONE` when nothing in
// the plan is left to translate. Plan entries that are neither in the library nor in
// bookQueue.ts are skipped with a warning.
// 2026-11-25 user: only the book being read and the next plan book (see lib/translationWindow.ts);
// with both done it prints ALL_DONE and the batch rests until the reader moves on.
async function main() {
  const [dir, maxArg] = process.argv.slice(2);
  if (!dir) throw new Error("usage: nextJobs.ts <out-dir> [max]");
  let remaining = Number(maxArg ?? 8);
  const fullPlan = await db.select().from(readingPlan).orderBy(asc(readingPlan.position));
  const window = await readerWindow(fullPlan.map((p) => p.slug));
  if (window) console.error(`translation window: ${window.join(", ")}`);
  else console.error("translation window: no bookmark — whole plan");
  const plan = window ? window.map((slug) => ({ slug })) : fullPlan;
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

async function readerWindow(planSlugs: string[]): Promise<string[] | null> {
  const [reader] = await db.select().from(readers).where(eq(readers.name, READER)).limit(1);
  if (!reader) return null;
  const marks = await db
    .select({ slug: books.slug })
    .from(bookmarks)
    .innerJoin(books, eq(books.id, bookmarks.bookId))
    .where(eq(bookmarks.readerId, reader.id))
    .orderBy(desc(bookmarks.updatedAt))
    .limit(5);
  const pos = marks.find((m) => !SKIP_BOOKS.includes(m.slug));
  const finished = (
    await db.select({ slug: books.slug }).from(finishedBooks).innerJoin(books, eq(books.id, finishedBooks.bookId)).where(eq(finishedBooks.readerId, reader.id))
  ).map((f) => f.slug);
  return translationWindow(planSlugs, pos?.slug ?? null, finished);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
