import { generateObject } from "ai";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { chapters, type Chapter } from "@/db/schema";
import { MODEL } from "@/lib/ai/model";

// Postgres advisory lock, scoped to chapter generation — guards the shared-content cache below so
// two near-simultaneous requests for the same never-before-read chapter (double-tap, two tabs)
// can't both miss the cache and each pay for their own generation. Single-user app, so this is a
// belt-and-suspenders guard rather than a real concurrency concern, but it's cheap and mirrors
// Wordflow's withCurriculumItemLock (see ../../../wordflow/src/lib/generateReading.ts).
const LOCK_NAMESPACE_CHAPTER = 1;

async function withChapterLock<T>(chapterId: number, fn: () => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_NAMESPACE_CHAPTER}, ${chapterId})`);
    return fn();
  });
}

// Cheap truncation detector, same idea as Wordflow's looksComplete — a field that got cut off
// mid-generation almost never ends on sentence-ending punctuation.
const SENTENCE_END = /[.!?"'”’」）)]\s*$/;
function looksComplete(text: string | null | undefined, minLength = 20): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  return trimmed.length >= minLength && SENTENCE_END.test(trimmed);
}

async function withRetry<T>(fn: () => Promise<T>, isValid: (value: T) => boolean, attempts = 2): Promise<T> {
  let result = await fn();
  for (let i = 1; i < attempts && !isValid(result); i++) {
    result = await fn();
  }
  return result;
}

// Names/places in translated classical Chinese fiction (and other source texts) tend to drift
// into ad-hoc phonetic spellings if left unconstrained — keep Korean readings and English
// spellings each internally consistent chapter-to-chapter, since a reader will notice a character
// spelled two different ways two chapters apart.
const STYLE_GUIDANCE =
  "인명·지명은 매 챕터마다 동일한 한국어 표기(한자음 기준)와 동일한 영어 표기(널리 쓰이는 로마자 표기)를 " +
  "일관되게 사용하세요. 이야기의 사건, 대사, 인과관계는 원문에 있는 내용을 생략하거나 왜곡하지 말고 " +
  "그대로 담되, 문장은 쉽고 자연스럽게 다시 쓰세요.";

const bilingualField = (description: string) =>
  z.object({
    ko: z.string().describe(`${description} (Korean)`),
    en: z.string().describe(`${description} (English)`),
  });

const chapterSchema = z.object({
  title: bilingualField("A short, engaging chapter title (not a literal translation of the original chapter heading)"),
  story: bilingualField(
    "The chapter's events retold as easy, engaging, natural prose — same events, characters, and outcomes as the source, just told in accessible modern language",
  ),
});

export type GeneratedChapterContent = {
  titleKo: string;
  titleEn: string;
  storyKo: string;
  storyEn: string;
};

async function generateFreshContent(chapter: Chapter): Promise<GeneratedChapterContent> {
  const { object } = await withRetry(
    () =>
      generateObject({
        model: MODEL,
        schema: chapterSchema,
        system:
          "You retell classic novel chapters in an easy, engaging story-style voice for a personal reading app called Storyflow. " +
          "The reader wants to finally get through a book they've always wanted to read but found the original prose too dense or " +
          "archaic to finish — your job is to make the SAME story easy and fun to follow, not to summarize or abridge it. " +
          "Write every field in BOTH Korean and English — the two should carry the same meaning and cover the same events, " +
          "each natural in its own language, not a literal translation of each other. " +
          STYLE_GUIDANCE,
        prompt: [
          `Book chapter ${chapter.chapterNumber}${chapter.sourceTitle ? ` (original heading: ${chapter.sourceTitle})` : ""}`,
          `Source text:\n${chapter.sourceText}`,
        ].join("\n\n"),
      }),
    ({ object }) =>
      looksComplete(object.title.ko, 2) &&
      looksComplete(object.title.en, 2) &&
      looksComplete(object.story.ko) &&
      looksComplete(object.story.en),
  );

  return {
    titleKo: object.title.ko,
    titleEn: object.title.en,
    storyKo: object.story.ko,
    storyEn: object.story.en,
  };
}

// Returns the chapter's bilingual retelling, generating and caching it on first read. Content is
// a pure function of the chapter's source text (nothing reader-specific goes into the prompt), so
// once generated it's reused forever by every reader and every future visit — mirrors Wordflow's
// generate-once-cache-forever pattern for curriculum content.
export async function ensureChapterContent(chapterId: number): Promise<Chapter> {
  return withChapterLock(chapterId, async () => {
    const [existing] = await db.select().from(chapters).where(eq(chapters.id, chapterId)).limit(1);
    if (!existing) throw new Error(`No chapter with id ${chapterId}`);
    if (existing.generatedAt) return existing;

    const content = await generateFreshContent(existing);

    const [updated] = await db
      .update(chapters)
      .set({ ...content, generatedAt: new Date() })
      .where(and(eq(chapters.id, chapterId)))
      .returning();

    return updated;
  });
}
