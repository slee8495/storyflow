import { generateObject } from "ai";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { books, chapters, type Book, type Chapter } from "@/db/schema";
import { BOOK_MODELS, MODEL } from "@/lib/ai/model";

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

// Extra per-book instructions, keyed by books.slug — for books whose content needs handling the
// generic prompt doesn't cover. Lady Chatterley's Lover is the reason this exists: its frank love
// scenes are the heart of the novel (it was banned for 30+ years over them), and a "make it easy"
// rewrite left to its own devices tends to fade them out into a polite line or two. The operator
// explicitly asked for them kept — as frank as Lawrence wrote them, not more.
const BOOK_GUIDANCE: Record<string, string> = {
  chatterley:
    "This is D. H. Lawrence's unexpurgated Lady Chatterley's Lover, read by an adult who chose it for its frankness. " +
    "The love scenes are central to the novel's meaning — keep every intimate scene in full, as candid and sensual as " +
    "Lawrence wrote it: what the characters do, what their bodies feel, and what it means to them. Do not fade to " +
    "black, skip, or soften these scenes into vague summary, and keep Mellors' blunt Derbyshire words where Lawrence uses " +
    "them (render his dialect as plain, warm, rough speech). Equally, do not add explicitness beyond the source. " +
    "Each row is one part of a longer original chapter: continue the story naturally without re-introducing the " +
    "characters or recapping earlier parts.",
};

// Korean and English are generated as two independent, parallel calls rather than one bilingual
// object. A Lady Chatterley part (~3k source words) retold in both languages in a single call ran
// ~14k output tokens / ~340s — past Vercel's 300s function limit — while each language alone is
// roughly half that. The two were never aligned translations anyway (see bookmarks.chunkIndex in
// schema.ts), so nothing depends on them coming out of the same call.
const LANGUAGES = {
  ko: {
    name: "Korean",
    style: "Write in natural, easy modern Korean prose.",
  },
  en: {
    name: "English",
    style:
      "Write in plain, simple modern English that an intermediate learner can follow: short sentences, everyday " +
      "vocabulary, explain rather than reproduce archaic or literary phrasing. Never copy the source's sentences " +
      "verbatim — retell them in your own simpler words, even when the source itself is already in English.",
  },
} as const;
type Lang = keyof typeof LANGUAGES;

const chapterSchema = z.object({
  title: z.string().describe("A short, engaging chapter title (not a literal translation of the original chapter heading)"),
  story: z
    .string()
    .describe(
      "The chapter's events retold as easy, engaging, natural prose — same events, characters, and outcomes as the source, just told in accessible modern language",
    ),
});

export type GeneratedChapterContent = {
  titleKo: string;
  titleEn: string;
  storyKo: string;
  storyEn: string;
};

async function generateInLanguage(chapter: Chapter, book: Book, lang: Lang) {
  const { name, style } = LANGUAGES[lang];
  const { object } = await withRetry(
    () =>
      generateObject({
        model: BOOK_MODELS[book.slug] ?? MODEL,
        schema: chapterSchema,
        system:
          "You retell classic novel chapters in an easy, engaging story-style voice for a personal reading app called Storyflow. " +
          "The reader wants to finally get through a book they've always wanted to read but found the original prose too dense or " +
          "archaic to finish — your job is to make the SAME story easy and fun to follow, not to summarize or abridge it. " +
          `Write both fields in ${name}. ${style} ` +
          STYLE_GUIDANCE +
          (BOOK_GUIDANCE[book.slug] ? ` ${BOOK_GUIDANCE[book.slug]}` : ""),
        prompt: [
          `Book: ${book.titleEn ?? book.title}${book.author ? ` by ${book.author}` : ""}`,
          `Book chapter ${chapter.chapterNumber}${chapter.sourceTitle ? ` (original heading: ${chapter.sourceTitle})` : ""}`,
          `Source text:\n${chapter.sourceText}`,
        ].join("\n\n"),
      }),
    ({ object }) => looksComplete(object.title, 2) && looksComplete(object.story),
  );
  return object;
}

export async function generateFreshContent(chapter: Chapter, book: Book): Promise<GeneratedChapterContent> {
  const [ko, en] = await Promise.all([generateInLanguage(chapter, book, "ko"), generateInLanguage(chapter, book, "en")]);
  return { titleKo: ko.title, titleEn: en.title, storyKo: ko.story, storyEn: en.story };
}

// Returns the chapter's bilingual retelling, generating and caching it on first read. Content is
// a pure function of the chapter's source text (nothing reader-specific goes into the prompt), so
// once generated it's reused forever by every reader and every future visit — mirrors Wordflow's
// generate-once-cache-forever pattern for curriculum content.
//
// No lock around generation: an earlier version held a Postgres advisory-lock transaction open for
// the whole Claude call, which the Neon pooler closes once generation runs into minutes
// (CONNECTION_CLOSED on the final write). Instead the write is conditional on generatedAt still
// being null — two racing requests (double-tap, two tabs) may each pay for a generation, but the
// first to finish wins and both return the same stored row. Single-user app, so that race is rare.
export async function ensureChapterContent(chapterId: number): Promise<Chapter> {
  const [existing] = await db.select().from(chapters).where(eq(chapters.id, chapterId)).limit(1);
  if (!existing) throw new Error(`No chapter with id ${chapterId}`);
  if (existing.generatedAt) return existing;

  const [book] = await db.select().from(books).where(eq(books.id, existing.bookId)).limit(1);
  const content = await generateFreshContent(existing, book);

  const [updated] = await db
    .update(chapters)
    .set({ ...content, generatedAt: new Date() })
    .where(and(eq(chapters.id, chapterId), isNull(chapters.generatedAt)))
    .returning();
  if (updated) return updated;

  const [winner] = await db.select().from(chapters).where(eq(chapters.id, chapterId)).limit(1);
  return winner;
}
