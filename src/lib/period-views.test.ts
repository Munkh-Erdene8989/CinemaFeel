import assert from "node:assert/strict";
import test from "node:test";
import { countUniqueViews, viewDayKey } from "./period-views.ts";

const UB_OFFSET_MS = 8 * 60 * 60 * 1000;

function at(year: number, month: number, day: number, hour = 0, minute = 0) {
  return Date.UTC(year, month - 1, day, hour, minute) - UB_OFFSET_MS;
}

test("the view day follows Ulaanbaatar midnight, including the 15th and the 16th", () => {
  assert.equal(viewDayKey(at(2026, 10, 15, 23, 30)), "2026-10-15");
  assert.equal(viewDayKey(at(2026, 10, 16, 0, 30)), "2026-10-16");
});

test("one viewer counts once per month and once per half they actually watched", () => {
  const events = [
    { seriesId: "film", uid: "u", createdAt: at(2026, 10, 2, 8) },
    { seriesId: "film", uid: "u", createdAt: at(2026, 10, 20, 8) },
    { seriesId: "film", uid: "v", createdAt: at(2026, 10, 20, 8) },
    { seriesId: "other", uid: "u", createdAt: at(2026, 10, 20, 8) },
  ];
  assert.equal(countUniqueViews(events, at(2026, 10, 1), at(2026, 11, 1)).get("film"), 2);
  assert.equal(countUniqueViews(events, at(2026, 10, 1), at(2026, 10, 16)).get("film"), 1);
  assert.equal(countUniqueViews(events, at(2026, 10, 16), at(2026, 11, 1)).get("film"), 2);
  assert.equal(countUniqueViews(events, at(2026, 10, 16), at(2026, 11, 1)).get("other"), 1);
});
