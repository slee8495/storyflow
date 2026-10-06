CREATE TABLE "chapter_illustrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"chapter_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"image_url" text NOT NULL,
	"title" text NOT NULL,
	"artist" text NOT NULL,
	"date_display" varchar(64),
	"credit" text NOT NULL,
	"source_url" text NOT NULL,
	"caption_ko" text NOT NULL,
	"caption_en" text NOT NULL,
	CONSTRAINT "chapter_illustrations_chapter_id_position_unique" UNIQUE("chapter_id","position")
);
--> statement-breakpoint
ALTER TABLE "chapter_illustrations" ADD CONSTRAINT "chapter_illustrations_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;