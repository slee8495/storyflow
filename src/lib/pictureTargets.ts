// Which chapters the morning batch should draw pictures for next — kept free of the DB so it can
// be tested on its own.
//
// 2026-11-24 user: "내가 현재 읽는책의 다음책까지만 하고 내가 따라잡을때까지 쉬는걸로" — from the
// chapter the reader is on (included: "8장부터 해줘") to the end of the book they're reading, then
// the book after it in the reading plan, and nothing beyond. Once both are done the batch rests
// until the reader moves on to the next book, which moves the window forward.

export type PlanBook = { bookId: number; slug: string };
export type CandidateChapter = { bookId: number; chapterNumber: number; translated: boolean; pictured: boolean };

// The book after `currentBookId` in the plan; when the current book isn't in the plan, the first
// plan book that isn't it and isn't finished.
export function nextBookInPlan(plan: PlanBook[], currentBookId: number, finishedBookIds: number[]): PlanBook | null {
  const i = plan.findIndex((b) => b.bookId === currentBookId);
  const after = i >= 0 ? plan.slice(i + 1) : plan;
  return after.find((b) => b.bookId !== currentBookId && !finishedBookIds.includes(b.bookId)) ?? null;
}

export function pickPictureChapters({
  currentBookId,
  currentChapter,
  nextBookId,
  chapters,
  max,
}: {
  currentBookId: number;
  currentChapter: number;
  nextBookId: number | null;
  chapters: CandidateChapter[];
  max: number;
}): CandidateChapter[] {
  const inOrder = (bookId: number, from: number) =>
    chapters
      .filter((c) => c.bookId === bookId && c.chapterNumber >= from)
      .sort((a, b) => a.chapterNumber - b.chapterNumber);
  const window = [...inOrder(currentBookId, currentChapter), ...(nextBookId ? inOrder(nextBookId, 1) : [])];
  // An untranslated chapter is skipped, not waited on — the translation batch fills it in later.
  return window.filter((c) => c.translated && !c.pictured).slice(0, max);
}
