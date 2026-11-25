// Which plan books the nightly translation batch may work on — kept free of the DB so it can be tested.
//
// 2026-11-25 user: translate like the pictures do — only the book being read and the book after it
// in the reading plan. Once both are fully translated the batch rests (just checking progress), and
// when the reader moves on to the next book the window moves forward and 8 a day start again.
export function translationWindow(planSlugs: string[], currentSlug: string | null, finishedSlugs: string[]): string[] | null {
  if (!currentSlug) return null; // no bookmark yet: no window, the caller walks the whole plan
  const i = planSlugs.indexOf(currentSlug);
  const after = i >= 0 ? planSlugs.slice(i + 1) : planSlugs;
  const next = after.find((s) => s !== currentSlug && !finishedSlugs.includes(s));
  return next ? [currentSlug, next] : [currentSlug];
}
