-- One-off: creates the chapter_films table (src/db/schema.ts `chapterFilms`). Additive only.
CREATE TABLE IF NOT EXISTS chapter_films (
  id serial PRIMARY KEY,
  chapter_id integer NOT NULL UNIQUE REFERENCES chapters(id) ON DELETE CASCADE,
  status varchar(16) NOT NULL,
  text_sig varchar(64) NOT NULL,
  script jsonb NOT NULL,
  cues jsonb,
  video_url text,
  poster_url text,
  duration_sec real,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
