CREATE TABLE "saved_marks" (
	"id" serial PRIMARY KEY NOT NULL,
	"reader_id" integer NOT NULL,
	"book_id" integer NOT NULL,
	"chapter_number" integer NOT NULL,
	"chunk_index" integer,
	"lang" varchar(4),
	"excerpt" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_marks" ADD CONSTRAINT "saved_marks_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_marks" ADD CONSTRAINT "saved_marks_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;