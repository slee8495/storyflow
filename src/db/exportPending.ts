import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "./index";
import { books, chapters } from "./schema";
import { generationPrompt } from "../lib/generateChapter";

// The subscription path for pregeneration (`npx tsx --env-file=.env.local src/db/exportPending.ts
// <slug> <dir>`): writes one <chapter>.job.md per not-yet-generated chapter, holding the same
// instructions /api pregeneration would send (see generationPrompt). Claude Code then writes each
// <chapter>.out.md, and importWritten.ts loads them. Nothing here calls a model.
async function main() {
  const [slug, dir] = process.argv.slice(2);
  if (!slug || !dir) throw new Error("usage: exportPending.ts <book-slug> <out-dir>");
  const [book] = await db.select().from(books).where(eq(books.slug, slug)).limit(1);
  if (!book) throw new Error(`no book with slug ${slug}`);

  const pending = await db
    .select()
    .from(chapters)
    .where(and(eq(chapters.bookId, book.id), isNull(chapters.generatedAt)))
    .orderBy(asc(chapters.chapterNumber));
  mkdirSync(dir, { recursive: true });
  for (const chapter of pending) {
    const ko = generationPrompt(chapter, book, "ko");
    const en = generationPrompt(chapter, book, "en");
    writeFileSync(
      join(dir, `${chapter.chapterNumber}.job.md`),
      [
        `# Korean retelling — instructions`,
        ko.system,
        `# English retelling — instructions`,
        en.system,
        `# Source (the same for both)`,
        ko.prompt,
      ].join("\n\n"),
    );
  }
  console.log(`exported ${pending.length} jobs: ${pending.map((c) => c.chapterNumber).join(",")}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
