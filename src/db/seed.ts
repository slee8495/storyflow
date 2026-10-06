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
  {
    slug: "chatterley",
    title: "채털리 부인의 연인",
    titleEn: "Lady Chatterley's Lover",
    author: "D. H. 로렌스 (D. H. Lawrence)",
    totalChapters: null as number | null,
    coverColor: "#4f6b3a",
    description: "전쟁 뒤 차가운 귀족의 저택에서, 숲지기와의 사랑을 통해 몸과 마음을 되찾아가는 콘스턴스의 이야기.",
    descriptionEn:
      "In a cold country house after the war, Constance finds her body and her heart again through love with the gamekeeper.",
  },
  {
    slug: "art-tour",
    title: "미술관 산책: 그림으로 읽는 서양미술사",
    titleEn: "A Walk Through the Museum: The Story of Western Art",
    author: "Storyflow 오리지널 (곰브리치 『서양미술사』에서 영감)",
    totalChapters: null as number | null,
    coverColor: "#8a5a2b",
    description: "이집트부터 드가, 클림트까지. 하루 한 작품씩, 그림을 보며 읽는 서양미술의 흐름.",
    descriptionEn: "From ancient Egypt to Degas and Klimt — one artwork a day, the story of Western art told beside the pictures.",
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
