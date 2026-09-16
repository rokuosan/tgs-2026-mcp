import assert from "node:assert/strict";
import test from "node:test";

import { extractJsonArray, getNoveltyMentions, getXAccount } from "./update-exhibitors.mjs";

test("extractJsonArray handles brackets inside strings", () => {
  const input = 'prefix [{"name":"]","items":[1,2]}] suffix';
  const start = input.indexOf("[");

  assert.equal(extractJsonArray(input, start), '[{"name":"]","items":[1,2]}]');
});

test("getXAccount normalizes account and status URLs", () => {
  assert.deepEqual(getXAccount("https://x.com/tokyo_game_show/status/1"), {
    handle: "@tokyo_game_show",
    url: "https://x.com/tokyo_game_show",
  });
  assert.equal(getXAccount("https://example.com/x.com/account"), null);
});

test("getNoveltyMentions extracts only relevant sentences", () => {
  assert.deepEqual(
    getNoveltyMentions({ text: "試遊できます。限定ノベルティを配布します。", events: [] }),
    ["限定ノベルティを配布します。"],
  );
});
