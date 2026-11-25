-- One-off: creates the chapter_pictures table (src/db/schema.ts `chapterPictures`). Additive only.
CREATE TABLE IF NOT EXISTS chapter_pictures (
  id serial PRIMARY KEY,
  chapter_id integer NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  position integer NOT NULL,
  at real NOT NULL,
  image_url text NOT NULL,
  prompt text NOT NULL,
  style text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, position)
);
