import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  integer,
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

// Pure "where did I leave off" pointer per reader per book — deliberately NOT an auto-advancing
// daily cursor like Wordflow's Today tab (this app has no Today concept, see
// docs/project-context.md). Updated whenever a reader opens a chapter; read back as the
// "이어읽기" (resume) target from the Library/book page.
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
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.readerId, t.bookId)],
);

export type Reader = typeof readers.$inferSelect;
export type Book = typeof books.$inferSelect;
export type Chapter = typeof chapters.$inferSelect;
export type Bookmark = typeof bookmarks.$inferSelect;
