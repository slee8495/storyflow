// npx tsx --test src/lib/translationWindow.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { translationWindow } from "./translationWindow";

const plan = ["anna", "karamazov", "musketeers", "caesars"];

test("current book and the one after it in the plan", () => {
  assert.deepEqual(translationWindow(plan, "karamazov", ["anna"]), ["karamazov", "musketeers"]);
});
test("skips a finished next book", () => {
  assert.deepEqual(translationWindow(plan, "karamazov", ["musketeers"]), ["karamazov", "caesars"]);
});
test("last book in the plan: only itself", () => {
  assert.deepEqual(translationWindow(plan, "caesars", []), ["caesars"]);
});
test("reading something off the plan: it plus the first unfinished plan book", () => {
  assert.deepEqual(translationWindow(plan, "art-tour", ["anna"]), ["art-tour", "karamazov"]);
});
test("no bookmark: no window", () => {
  assert.equal(translationWindow(plan, null, []), null);
});
