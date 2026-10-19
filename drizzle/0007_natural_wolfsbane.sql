CREATE TABLE "archived_books" (
	"id" serial PRIMARY KEY NOT NULL,
	"reader_id" integer NOT NULL,
	"book_id" integer NOT NULL,
	"archived_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "archived_books_reader_id_book_id_unique" UNIQUE("reader_id","book_id")
);
--> statement-breakpoint
ALTER TABLE "archived_books" ADD CONSTRAINT "archived_books_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archived_books" ADD CONSTRAINT "archived_books_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;