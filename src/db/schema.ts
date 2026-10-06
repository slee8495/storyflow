import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  integer,
  real,
  date,
  unique,
} from "drizzle-orm/pg-core";

// Personal, single-user app — no OAuth/billing (see docs/project-context.md). Identity is just a
// name, the same lightweight "log in by typing a name" scheme Wordflow used before Auth.js was
// added: a reader row persists progress in Postgres so switching devices (phone Safari, desktop)
// and re-entering the same name resumes where they left off, without any password to manage.
export const readers = pgTable("readers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// One row per book in the library. Generic on purpose — 삼국지 is only the first title; the
// schema needs to hold Game of Thrones, 오디세이아, etc. without changes later (see
// docs/project-context.md for the candidate list).
export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  title: varchar("title", { length: 256 }).notNull(),
  titleEn: varchar("title_en", { length: 256 }),
  author: varchar("author", { length: 256 }),
  // Total chapter count once the source text is fully ingested — drives the chapter grid/progress
  // UI. Null until ingestion completes for a book that's been added but not yet processed.
  totalChapters: integer("total_chapters"),
  coverColor: varchar("cover_color", { length: 16 }), // hex accent for the library card, per-book variety
  description: text("description"),
  descriptionEn: text("description_en"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// One row per chapter, per book. `sourceText` holds the raw ingested original (public-domain
// text dump, see docs/project-context.md) — chunked into chapters up front, once, outside of any
// request. The bilingual `story*` fields are the Claude-rewritten easy/engaging retelling and are
// generated lazily on first read, then cached here forever (mirrors Wordflow's
// generate-once-reuse-forever pattern for curriculum content — see generateChapter.ts). Null
// story fields mean "not generated yet"; `generatedAt` null is the cheap way to check that
// without testing every text column.
export const chapters = pgTable(
  "chapters",
  {
    id: serial("id").primaryKey(),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    chapterNumber: integer("chapter_number").notNull(),
    // The original work's own chapter heading (e.g. 삼국지's stylized 回目 couplet), kept as-is
    // for reference — not shown as the primary title since it's often hard to parse un-annotated.
    sourceTitle: text("source_title"),
    sourceText: text("source_text").notNull(),

    titleKo: text("title_ko"),
    titleEn: text("title_en"),
    storyKo: text("story_ko"),
    storyEn: text("story_en"),

    generatedAt: timestamp("generated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.bookId, t.chapterNumber)],
);

// Artwork shown alongside a chapter — public-domain museum images (The Met / Art Institute of
// Chicago open access), hand-curated per chapter and loaded by a book's ingestion script, never
// generated. Kept out of the story text itself so TTS and sentence-level resume positions
// (bookmarks.chunkIndex) are unaffected by how many pictures a chapter has. `position` orders
// several illustrations within one chapter.
export const chapterIllustrations = pgTable(
  "chapter_illustrations",
  {
    id: serial("id").primaryKey(),
    chapterId: integer("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    imageUrl: text("image_url").notNull(),
    title: text("title").notNull(),
    artist: text("artist").notNull(),
    dateDisplay: varchar("date_display", { length: 64 }),
    credit: text("credit").notNull(), // museum + accession, shown under the image
    sourceUrl: text("source_url").notNull(), // the museum's own object page
    captionKo: text("caption_ko").notNull(),
    captionEn: text("caption_en").notNull(),
  },
  (t) => [unique().on(t.chapterId, t.position)],
);

// Pure "where did I leave off" pointer per reader per book — deliberately NOT an auto-advancing
// daily cursor like Wordflow's Today tab (this app has no Today concept, see
// docs/project-context.md). Updated whenever a reader opens a chapter; read back as the
// "이어읽기" (resume) target from the Library/book page.
//
// chunkIndex/lang add sentence-level position WITHIN chapterNumber — chapters run long, and
// re-listening/re-reading from the top every time isn't acceptable (explicit operator ask, see
// project-context.md). chunkIndex indexes into splitIntoChunks(storyKo|storyEn) for whichever
// `lang` it was recorded in — Korean and English chunk counts differ (independent retellings, not
// aligned translations), so a chunkIndex is only meaningful paired with the lang it came from.
// Both null until the reader has actually listened to or clicked a sentence in the CURRENT
// chapterNumber; whenever chapterNumber itself changes (navigating to a different chapter), the
// API resets both to null rather than carrying over a position that refers to different text —
// see src/app/api/bookmarks/route.ts.
export const bookmarks = pgTable(
  "bookmarks",
  {
    id: serial("id").primaryKey(),
    readerId: integer("reader_id")
      .notNull()
      .references(() => readers.id, { onDelete: "cascade" }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    chapterNumber: integer("chapter_number").notNull().default(1),
    chunkIndex: integer("chunk_index"),
    lang: varchar("lang", { length: 4 }), // "ko" | "en", null until chunkIndex is set
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.readerId, t.bookId)],
);

// Bookmarks the reader places by hand — any number per book, unlike `bookmarks` above, which is
// the single automatic "where did I leave off" pointer. A row marks either one sentence
// (chunkIndex + lang, indexing splitIntoChunks of that language's story text, same convention as
// bookmarks.chunkIndex) or, with both null, the whole chapter (handy for an art-tour painting).
// `excerpt` snapshots the sentence (or chapter title) at save time so the list reads well even if
// a chapter is ever regenerated and its chunk indices shift. `note` is the reader's own memo.
export const savedMarks = pgTable("saved_marks", {
  id: serial("id").primaryKey(),
  readerId: integer("reader_id")
    .notNull()
    .references(() => readers.id, { onDelete: "cascade" }),
  bookId: integer("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  chapterNumber: integer("chapter_number").notNull(),
  chunkIndex: integer("chunk_index"),
  lang: varchar("lang", { length: 4 }), // "ko" | "en", null for a whole-chapter mark
  excerpt: text("excerpt").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// One row per reader/book/calendar-day, storing the best (max) overall book-progress percentage
// reached that day — the data behind the "이 추세면 언제 다 읽나" pace projection (mirrors
// Wordflow's trailing-pace projectedCompletionDate in src/lib/progress.ts there, adapted from
// discrete curriculum-item counts to a continuous percentage). Written from
// src/lib/progress.ts's recordProgressSnapshot(), called after every bookmark update — never
// written directly from route handlers. "Best" (not "latest") per day so jumping back to reread
// an earlier chapter doesn't dip today's recorded high-water mark, which would make the pace
// calculation swing on simple navigation rather than real forward progress.
export const progressSnapshots = pgTable(
  "progress_snapshots",
  {
    id: serial("id").primaryKey(),
    readerId: integer("reader_id")
      .notNull()
      .references(() => readers.id, { onDelete: "cascade" }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    day: date("day").notNull(), // server UTC calendar date — no per-reader timezone tracking in this app
    progressPct: real("progress_pct").notNull(), // 0-100, best value reached this day
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.readerId, t.bookId, t.day)],
);

export type Reader = typeof readers.$inferSelect;
export type Book = typeof books.$inferSelect;
export type Chapter = typeof chapters.$inferSelect;
export type Bookmark = typeof bookmarks.$inferSelect;
export type ProgressSnapshot = typeof progressSnapshots.$inferSelect;
export type ChapterIllustration = typeof chapterIllustrations.$inferSelect;
export type SavedMark = typeof savedMarks.$inferSelect;
