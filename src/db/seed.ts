import { eq } from "drizzle-orm";
import { db } from "./index";
import { books } from "./schema";

// Seeds the book catalog's metadata rows only — NOT chapters. Chapter text has to be sourced and
// ingested separately (see docs/project-context.md: 삼국지 full text hasn't been sourced yet as
// of this writing). `totalChapters` stays null until that ingestion step runs, which the Library/
// book UI already treats as "unknown yet" rather than an error.
const SEED_BOOKS = [
  {
    slug: "samgukji",
    title: "삼국지",
    titleEn: "Romance of the Three Kingdoms",
    author: "나관중 (羅貫中)",
    totalChapters: null as number | null,
    coverColor: "#2b3b80",
    description: "후한 말, 위·촉·오 세 나라가 다투던 시대의 영웅들 이야기.",
    descriptionEn: "Heroes and rivals of the Three Kingdoms era, as the Han dynasty falls apart.",
  },
];

async function main() {
  for (const book of SEED_BOOKS) {
    const [existing] = await db.select().from(books).where(eq(books.slug, book.slug)).limit(1);
    if (existing) {
      // Upsert rather than skip — lets this script be re-run after tweaking seed content
      // (titles/descriptions) during development without a manual DB edit. Never touches
      // totalChapters here, since that's set by the (not-yet-written) chapter ingestion script,
      // not this metadata seed.
      await db
        .update(books)
        .set({
          title: book.title,
          titleEn: book.titleEn,
          author: book.author,
          coverColor: book.coverColor,
          description: book.description,
          descriptionEn: book.descriptionEn,
        })
        .where(eq(books.slug, book.slug));
      console.log(`updated: ${book.slug}`);
      continue;
    }
    await db.insert(books).values(book);
    console.log(`seeded: ${book.slug}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
