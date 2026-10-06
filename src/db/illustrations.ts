import { inArray } from "drizzle-orm";
import { db } from "./index";
import { chapterIllustrations } from "./schema";

// Shape of one curated artwork in a book's data/*.json illustration file — see the
// chapterIllustrations table in schema.ts.
export type IllustrationEntry = {
  imageUrl: string;
  title: string;
  artist: string;
  dateDisplay?: string;
  credit: string;
  sourceUrl: string;
  captionKo: string;
  captionEn: string;
};

// Replaces the illustration set of every given chapter with the curated entries (array order =
// display position). Delete-then-insert, so editing a book's JSON and re-running its ingest script
// is the whole workflow for swapping pictures; story text is never touched.
export async function replaceIllustrations(byChapterId: Map<number, IllustrationEntry[]>) {
  const chapterIds = [...byChapterId.keys()];
  if (chapterIds.length === 0) return;
  await db.delete(chapterIllustrations).where(inArray(chapterIllustrations.chapterId, chapterIds));
  const rows = chapterIds.flatMap((chapterId) =>
    byChapterId.get(chapterId)!.map((entry, position) => ({
      chapterId,
      position,
      imageUrl: entry.imageUrl,
      title: entry.title,
      artist: entry.artist,
      dateDisplay: entry.dateDisplay ?? null,
      credit: entry.credit,
      sourceUrl: entry.sourceUrl,
      captionKo: entry.captionKo,
      captionEn: entry.captionEn,
    })),
  );
  if (rows.length > 0) await db.insert(chapterIllustrations).values(rows);
}
