import assert from "node:assert/strict";
import test from "node:test";
import { coverFilm, isMature, matureCatalog, normalizeAge, publicCatalog } from "./mature.ts";

test("18+ age or genre is mature", () => {
  assert.equal(isMature({ age: "18+" }), true);
  assert.equal(isMature({ age: "+18" }), true);
  assert.equal(isMature({ genre: "+18", age: "13+" }), true);
  assert.equal(isMature({ age: "13+", genre: "Романтик" }), false);
  assert.equal(isMature({ age: "16+" }), false);
  assert.equal(normalizeAge(" + 18 "), "18+");
  assert.equal(normalizeAge(""), "13+");
});

test("mature titles stay off the public feed and cover", () => {
  const series = [
    { id: "safe", age: "13+", genre: "Драма", featured: false },
    { id: "cover", age: "18+", genre: "Романтик", featured: true },
    { id: "shelf", age: "13+", genre: "+18", featured: false },
  ];
  assert.deepEqual(publicCatalog(series).map((film) => film.id), ["safe"]);
  assert.deepEqual(matureCatalog(series).map((film) => film.id), ["cover", "shelf"]);
  assert.equal(coverFilm(series)?.id, "safe");
});

