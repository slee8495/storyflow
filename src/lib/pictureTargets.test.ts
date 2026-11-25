// npx tsx --test src/lib/pictureTargets.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextBookInPlan, pickPictureChapters } from "./pictureTargets";

const plan = [
  { bookId: 7, slug: "anna" },
  { bookId: 8, slug: "karamazov" },
  { bookId: 9, slug: "musketeers" },
  { bookId: 10, slug: "caesars" },
];

test("next book is the one after the current one in the plan", () => {
  assert.equal(nextBookInPlan(plan, 8, [7])?.slug, "musketeers");
  assert.equal(nextBookInPlan(plan, 10, []), null);
  assert.equal(nextBookInPlan(plan, 99, [7])?.slug, "karamazov"); // reading something off the plan
});

const ch = (bookId: number, chapterNumber: number, translated = true, pictured = false) => ({
  bookId,
  chapterNumber,
  translated,
  pictured,
});

test("starts at the chapter being read, current book first, then the next book, then stops", () => {
  const chapters = [ch(8, 7), ch(8, 8), ch(8, 9, true, true), ch(8, 10), ch(9, 1), ch(9, 2, false), ch(9, 3), ch(10, 1)];
  const picked = pickPictureChapters({ currentBookId: 8, currentChapter: 8, nextBookId: 9, chapters, max: 8 });
  assert.deepEqual(
    picked.map((c) => `${c.bookId}:${c.chapterNumber}`),
    ["8:8", "8:10", "9:1", "9:3"],
  );
});

test("at most `max` a day", () => {
  const chapters = Array.from({ length: 20 }, (_, i) => ch(8, i + 1));
  assert.equal(pickPictureChapters({ currentBookId: 8, currentChapter: 1, nextBookId: null, chapters, max: 8 }).length, 8);
});

test("everything in the window done: rest", () => {
  const chapters = [ch(8, 8, true, true), ch(9, 1, true, true), ch(10, 1)];
  assert.equal(pickPictureChapters({ currentBookId: 8, currentChapter: 8, nextBookId: 9, chapters, max: 8 }).length, 0);
});
