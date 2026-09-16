import assert from "node:assert/strict";
import test from "node:test";

import { extractJsonArray } from "./update-exhibitors.mjs";

test("extractJsonArray handles brackets inside strings", () => {
  const input = 'prefix [{"name":"]","items":[1,2]}] suffix';
  const start = input.indexOf("[");

  assert.equal(extractJsonArray(input, start), '[{"name":"]","items":[1,2]}]');
});
