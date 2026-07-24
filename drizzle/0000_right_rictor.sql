CREATE TABLE "bookmarks" (
	"id" serial PRIMARY KEY NOT NULL,
	"reader_id" integer NOT NULL,
	"book_id" integer NOT NULL,
	"chapter_number" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookmarks_reader_id_book_id_unique" UNIQUE("reader_id","book_id")
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"title" varchar(256) NOT NULL,
	"title_en" varchar(256),
	"author" varchar(256),
	"total_chapters" integer,
	"cover_color" varchar(16),
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "books_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "chapters" (
	"id" serial PRIMARY KEY NOT NULL,
	"book_id" integer NOT NULL,
	"chapter_number" integer NOT NULL,
	"source_title" text,
	"source_text" text NOT NULL,
	"title_ko" text,
	"title_en" text,
	"story_ko" text,
	"story_en" text,
	"generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chapters_book_id_chapter_number_unique" UNIQUE("book_id","chapter_number")
);
--> statement-breakpoint
CREATE TABLE "readers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "readers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;