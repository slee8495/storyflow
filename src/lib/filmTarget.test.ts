// npx tsx --test src/lib/filmTarget.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickFilmChapter } from "./filmTarget";

const ch = (chapterNumber: number, listenSec: number | null = 1000) => ({ chapterNumber, listenSec });

test("paused: the very next chapter", () => {
  assert.equal(pickFilmChapter({ remainingSecInCurrent: 30, upcoming: [ch(9), ch(10)], leadSec: 0 }), 9);
});

test("listening with plenty left in this chapter: still the next one", () => {
  assert.equal(pickFilmChapter({ remainingSecInCurrent: 4000, upcoming: [ch(9), ch(10)], leadSec: 3600 }), 9);
});

test("listening near the end: skips chapters they'd reach before the film is ready", () => {
  assert.equal(pickFilmChapter({ remainingSecInCurrent: 100, upcoming: [ch(9), ch(10), ch(11), ch(12), ch(13)], leadSec: 3600 }), 13);
  assert.equal(pickFilmChapter({ remainingSecInCurrent: 1200, upcoming: [ch(9, 1200), ch(10, 1200), ch(11)], leadSec: 3600 }), 11);
});

test("an untranslated chapter in the way: nothing to film yet", () => {
  assert.equal(pickFilmChapter({ remainingSecInCurrent: 0, upcoming: [ch(9, null)], leadSec: 0 }), null);
  assert.equal(pickFilmChapter({ remainingSecInCurrent: 0, upcoming: [ch(9), ch(10, null)], leadSec: 3600 }), null);
});

test("last chapter of the book: nothing to film", () => {
  assert.equal(pickFilmChapter({ remainingSecInCurrent: 0, upcoming: [], leadSec: 0 }), null);
});
