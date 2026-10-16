import { readFileSync } from "node:fs";
import { join } from "node:path";
import { insertChapters, splitIntoParts, wordCount, type SourceRow } from "./splitParts";

// One-off ingestion for Leo Tolstoy's Anna Karenina (1878), in Constance Garnett's 1901 English
// translation — Project Gutenberg ebook #1399 (gutenberg.org/ebooks/1399). Both the novel and
// Garnett's translation (she died in 1946) are public domain.
//
// The opposite problem from Chatterley: 239 chapters across eight parts, most only 1k-2k words.
// One row per chapter would make a 239-step table of contents of tiny reads, so consecutive
// chapters within a part are grouped up to ~MAX_ROW_WORDS (never across a part break). A rare
// chapter longer than that on its own is split at paragraph boundaries instead.
const SOURCE_PATH = join(process.cwd(), "data", "anna-karenina-source.txt");
const MAX_ROW_WORDS = 3500;

const PART_HEADER = /^PART ([A-Z]+)\s*$/gm;
const CHAPTER_HEADER = /^Chapter (\d+)\s*$/gm;
const GUTENBERG_END = "*** END OF THE PROJECT GUTENBERG EBOOK";
const PART_NAMES = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT"];
const titleCase = (s: string) => s[0] + s.slice(1).toLowerCase();

export function parseAnnaKarenina(raw: string): SourceRow[] {
  const body = raw.slice(0, raw.indexOf(GUTENBERG_END));
  // The contents list has the part names indented, so only the real headings match.
  const parts = [...body.matchAll(PART_HEADER)];
  if (parts.map((p) => p[1]).join() !== PART_NAMES.join()) throw new Error(`unexpected part headings`);

  const rows: SourceRow[] = [];
  let chapterTotal = 0;
  parts.forEach((part, i) => {
    const partText = body.slice(part.index! + part[0].length, i + 1 < parts.length ? parts[i + 1].index! : body.length);
    const partName = `Part ${titleCase(part[1])}`;
    const chapters = [...partText.matchAll(CHAPTER_HEADER)].map((m, j, all) => ({
      number: Number(m[1]),
      text: partText.slice(m.index! + m[0].length, j + 1 < all.length ? all[j + 1].index! : partText.length).trim(),
    }));
    chapterTotal += chapters.length;

    let group: typeof chapters = [];
    const flush = () => {
      if (group.length === 0) return;
      const first = group[0].number;
      const last = group[group.length - 1].number;
      rows.push({
        sourceTitle: `${partName} · ${first === last ? `Chapter ${first}` : `Chapters ${first}–${last}`}`,
        sourceText: group.map((c) => `Chapter ${c.number}\n\n${c.text}`).join("\n\n"),
      });
      group = [];
    };
    for (const chapter of chapters) {
      const words = wordCount(chapter.text);
      if (words > MAX_ROW_WORDS) {
        flush();
        const pieces = splitIntoParts(chapter.text, MAX_ROW_WORDS);
        pieces.forEach((sourceText, p) =>
          rows.push({ sourceTitle: `${partName} · Chapter ${chapter.number} · Section ${p + 1} of ${pieces.length}`, sourceText }),
        );
        continue;
      }
      if (group.length > 0 && group.reduce((n, c) => n + wordCount(c.text), 0) + words > MAX_ROW_WORDS) flush();
      group.push(chapter);
    }
    flush();
  });
  if (chapterTotal !== 239) throw new Error(`expected 239 chapters, found ${chapterTotal}`);
  return rows;
}

// Only run when executed directly (`npm run db:ingest-anna-karenina`).
if (process.argv[1]?.endsWith("ingestAnnaKarenina.ts")) {
  const rows = parseAnnaKarenina(readFileSync(SOURCE_PATH, "utf-8"));
  console.log(`parsed ${rows.length} parts from ${SOURCE_PATH}`);
  insertChapters("anna-karenina", rows)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
