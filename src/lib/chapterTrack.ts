import type { Track } from "@/app/PlaybackProvider";

// A chapter as narration: the PlaybackProvider track for one chapter in one language, which saves
// the listening position as it goes and, when the chapter ends, carries on into the next one with
// its number spoken first ("82장." / "Chapter 82.") — as long as the next one is translated.

export type ChapterJson = {
  book: { id: number; slug: string };
  chapter: {
    chapterNumber: number;
    titleKo: string | null;
    titleEn: string | null;
    storyKo: string | null;
    storyEn: string | null;
  };
  nextReady?: boolean;
};

export const chapterSourceId = (slug: string, chapterNumber: number) => `chapter-${slug}-${chapterNumber}`;

function chapterIntro(chapterNumber: number, title: string | null, lang: "ko" | "en") {
  const number = lang === "ko" ? `${chapterNumber}장.` : `Chapter ${chapterNumber}.`;
  return title ? `${number} ${title}.` : number;
}

export function chapterTrack(
  json: ChapterJson,
  { lang, readerId, startIndex, intro }: { lang: "ko" | "en"; readerId: number; startIndex?: number; intro?: string },
): Track | null {
  const text = lang === "en" ? json.chapter.storyEn : json.chapter.storyKo;
  if (!text?.trim()) return null;
  const { slug, id: bookId } = json.book;
  const chapterNumber = json.chapter.chapterNumber;
  const title = lang === "en" ? json.chapter.titleEn : json.chapter.titleKo;

  return {
    id: chapterSourceId(slug, chapterNumber),
    label: title ?? `Ch. ${chapterNumber}`,
    text,
    startIndex,
    intro,
    onPosition: (chunkIndex) => {
      fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readerId, bookId, chapterNumber, chunkIndex, lang }),
      }).catch(() => {
        // best-effort — a missed save just resumes a little earlier next time
      });
    },
    next: async () => {
      if (!json.nextReady) return null;
      const res = await fetch(`/api/books/${slug}/chapters/${chapterNumber + 1}?readerId=${readerId}`);
      if (!res.ok) return null;
      const next = (await res.json()) as ChapterJson;
      const nextTitle = lang === "en" ? next.chapter.titleEn : next.chapter.titleKo;
      return chapterTrack(next, { lang, readerId, intro: chapterIntro(chapterNumber + 1, nextTitle, lang) });
    },
  };
}
