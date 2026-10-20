import assert from "node:assert/strict";
import test from "node:test";
import { collectOwnedSeriesIds, listedOwnership } from "./ownership.ts";

test("a stored purchase list answers without scanning purchases", () => {
  assert.equal(listedOwnership(["a", "b"], "b"), true);
  assert.equal(listedOwnership(["a"], "b"), false);
  assert.equal(listedOwnership(undefined, "a"), null);
  assert.equal(listedOwnership("a", "a"), null);
});

test("owned series ids keep one copy of each film", () => {
  assert.deepEqual(collectOwnedSeriesIds(["a", "", "a", "b"], "b"), ["a", "b"]);
  assert.deepEqual(collectOwnedSeriesIds([], "c"), ["c"]);
});
