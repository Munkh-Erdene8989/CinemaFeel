import assert from "node:assert/strict";
import test from "node:test";
import { isAlreadyExists, isRetryableWrite, sumShards, VIEW_SHARD_COUNT, viewShardId } from "./views.ts";

test("shard ids stay inside the counter spread", () => {
  for (let index = 0; index < 100; index += 1) {
    const id = Number(viewShardId());
    assert.equal(Number.isInteger(id), true);
    assert.ok(id >= 0 && id < VIEW_SHARD_COUNT);
  }
});

test("shard totals add every piece, including the stored base", () => {
  assert.deepEqual(
    sumShards([{ views: 10, uniqueViews: 4 }, { views: "3", uniqueViews: 1 }, { views: -2, uniqueViews: "nope" }]),
    { views: 13, uniqueViews: 5 },
  );
});

test("only a missing unique-view document counts as already stored", () => {
  assert.equal(isAlreadyExists({ code: 6 }), true);
  assert.equal(isAlreadyExists({ code: "already-exists" }), true);
  assert.equal(isAlreadyExists({ code: 10 }), false);
});

test("a contended shard write can move to another shard", () => {
  assert.equal(isRetryableWrite({ code: 10 }), true);
  assert.equal(isRetryableWrite({ code: "unavailable" }), true);
  assert.equal(isRetryableWrite({ code: 6 }), false);
});
