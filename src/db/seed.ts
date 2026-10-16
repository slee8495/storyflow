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
    slug: "fanny-hill",
    title: "패니 힐: 쾌락의 여인의 회고록",
    titleEn: "Fanny Hill: Memoirs of a Woman of Pleasure",
    author: "존 클리랜드 (John Cleland)",
    totalChapters: null as number | null,
    coverColor: "#8c3b4a",
    description: "시골에서 런던으로 올라온 패니가 쾌락과 사랑을 거쳐 진정한 행복에 이르기까지, 스스로 써 내려간 고백.",
    descriptionEn: "Fanny comes to London from the country and, through pleasure and love, writes her own way to happiness.",
  },
  {
    slug: "gatsby",
    title: "위대한 개츠비",
    titleEn: "The Great Gatsby",
    author: "F. 스콧 피츠제럴드 (F. Scott Fitzgerald)",
    totalChapters: null as number | null,
    coverColor: "#1f4e5f",
    description: "1922년 뉴욕 롱아일랜드. 잃어버린 사랑을 되찾으려 화려한 파티를 여는 개츠비와, 그를 지켜본 이웃 닉의 이야기.",
    descriptionEn: "Long Island, 1922: Gatsby throws dazzling parties to win back a lost love, as told by his neighbor Nick.",
  },
  {
    slug: "anna-karenina",
    title: "안나 카레니나",
    titleEn: "Anna Karenina",
    author: "레프 톨스토이 (Leo Tolstoy)",
    totalChapters: null as number | null,
    coverColor: "#6b2d3a",
    description: "19세기 러시아. 사랑을 위해 모든 것을 건 안나와, 삶의 의미를 찾아가는 레빈. 두 사람의 이야기가 엮인 대작.",
    descriptionEn: "Nineteenth-century Russia: Anna risks everything for love, while Levin searches for the meaning of life.",
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
