import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { books, chapters } from "./schema";

// Shared by the newer ingestion scripts (Gatsby, Anna Karenina). Chatterley and Fanny Hill keep
// their own copies of splitIntoParts — same logic, written before this file existed.

export const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

// Greedy, balanced split: aim each part at total/n words (n = parts needed to stay under the
// max), cutting only between paragraphs so no scene is sliced mid-paragraph.
export function splitIntoParts(text: string, maxWords: number): string[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const total = paragraphs.reduce((sum, p) => sum + wordCount(p), 0);
  const partCount = Math.ceil(total / maxWords);
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

export type SourceRow = { sourceTitle: string; sourceText: string };

// Inserts rows numbered 1..n for the book, skipping numbers already present, and records the
// total — so re-running after a partial ingest only fills the gaps.
export async function insertChapters(slug: string, rows: SourceRow[]) {
  const [book] = await db.select().from(books).where(eq(books.slug, slug)).limit(1);
  if (!book) throw new Error(`${slug} book row not found — run \`npm run db:seed\` first`);

  let inserted = 0;
  let skipped = 0;
  for (const [i, row] of rows.entries()) {
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
    await db.insert(chapters).values({ bookId: book.id, chapterNumber, ...row });
    inserted++;
  }
  await db.update(books).set({ totalChapters: rows.length }).where(eq(books.id, book.id));
  console.log(`inserted ${inserted} new chapters, skipped ${skipped} already present`);
}
