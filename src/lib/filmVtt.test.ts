// npx tsx --test src/lib/filmVtt.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { cueAt, cuesToVtt } from "./filmVtt";

const cues = [
  { start: 0.3, end: 2.8, text: "8장 · 제목", chunk: -1 },
  { start: 3.0, end: 6.0, text: "첫 문장.", chunk: 0 },
  { start: 6.0, end: 9.5, text: "둘째 문장.", chunk: 0 },
  { start: 10.0, end: 12.0, text: "다음 조각.", chunk: 1 },
];

test("cueAt finds the cue and holds it through the short gap after it", () => {
  assert.equal(cueAt(cues, 4)?.text, "첫 문장.");
  assert.equal(cueAt(cues, 9.6)?.chunk, 0);
  assert.equal(cueAt(cues, 9.9), null);
  assert.equal(cueAt(cues, 11)?.chunk, 1);
  assert.equal(cueAt(null, 1), null);
});

test("cuesToVtt", () => {
  const vtt = cuesToVtt([{ start: 61.5, end: 63, text: "a --> b", chunk: 0 }]);
  assert.equal(vtt, "WEBVTT\n\n00:01:01.500 --> 00:01:03.250\na → b\n");
});
