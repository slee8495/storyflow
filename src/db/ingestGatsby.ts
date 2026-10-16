import { readFileSync } from "node:fs";
import { join } from "node:path";
import { insertChapters, splitIntoParts, type SourceRow } from "./splitParts";

// One-off ingestion for F. Scott Fitzgerald's The Great Gatsby (1925) — Project Gutenberg ebook
// #64317 (gutenberg.org/ebooks/64317). Public domain in the US since January 2021; Fitzgerald
// died in 1940, so it's life+70 public domain too.
//
// Nine chapters of 3k-9k words; any over ~MAX_PART_WORDS is split at paragraph boundaries, the
// same way ingestChatterley.ts does it.
const SOURCE_PATH = join(process.cwd(), "data", "gatsby-source.txt");
const MAX_PART_WORDS = 3500;

// The real headings are centred (indented) Roman numerals; the contents list has them at column 0.
const CHAPTER_HEADER = /^ {10,}([IVX]+)\s*$/gm;
const GUTENBERG_END = "*** END OF THE PROJECT GUTENBERG EBOOK";

export function parseGatsby(raw: string): SourceRow[] {
  const body = raw.slice(0, raw.indexOf(GUTENBERG_END));
  const matches = [...body.matchAll(CHAPTER_HEADER)];
  if (matches.length !== 9) throw new Error(`expected 9 chapter headers, found ${matches.length}`);

  return matches.flatMap((match, i) => {
    const start = match.index! + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : body.length;
    const parts = splitIntoParts(body.slice(start, end), MAX_PART_WORDS);
    return parts.map((sourceText, p) => ({
      sourceTitle: parts.length > 1 ? `Chapter ${match[1]} · Part ${p + 1} of ${parts.length}` : `Chapter ${match[1]}`,
      sourceText,
    }));
  });
}

// Only run when executed directly (`npm run db:ingest-gatsby`).
if (process.argv[1]?.endsWith("ingestGatsby.ts")) {
  const rows = parseGatsby(readFileSync(SOURCE_PATH, "utf-8"));
  console.log(`parsed ${rows.length} parts from ${SOURCE_PATH}`);
  insertChapters("gatsby", rows)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
