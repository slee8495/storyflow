// Which chapter the film loop (scripts/film/) should have ready — kept free of the DB so it can be
// tested on its own.
//
// 2026-11-24 user: "내가 멈춘 장 바로 그 다음장부터 영상 담아주면 되는거야" — normally the chapter
// right after the bookmark. But a film takes about an hour to make, and if the reader is listening
// right now, narration would carry them into (or past) that chapter before it's ready and the work
// is wasted. So while they're listening, the film goes to the first chapter they can't reach
// before it's done: ahead of the bookmark by at least `leadSec` of narration. Once it's ready the
// chapter before it stops narration at its end (nextReady=false), so it can't be skipped.

export type UpcomingChapter = { chapterNumber: number; listenSec: number | null }; // null = not translated yet

export function pickFilmChapter({
  remainingSecInCurrent,
  upcoming,
  leadSec,
}: {
  remainingSecInCurrent: number; // narration left in the bookmarked chapter
  upcoming: UpcomingChapter[]; // the chapters after it, in order
  leadSec: number; // 0 when the reader isn't listening right now
}): number | null {
  let ahead = remainingSecInCurrent;
  for (const c of upcoming) {
    if (c.listenSec === null) return null; // a film needs the chapter's text; the nightly loop translates it first
    if (ahead >= leadSec) return c.chapterNumber;
    ahead += c.listenSec;
  }
  return null;
}
