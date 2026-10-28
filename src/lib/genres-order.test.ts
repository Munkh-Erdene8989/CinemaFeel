import assert from "node:assert/strict";
import test from "node:test";
import { reorderGenres } from "./genres-order.ts";

const current = ["Романтик", "Драма", "Өшөө авалт"];

test("reorder keeps the same genres in a new order", () => {
  assert.deepEqual(reorderGenres(current, ["Драма", "Өшөө авалт", "Романтик"]), ["Драма", "Өшөө авалт", "Романтик"]);
});

test("reorder rejects a different set", () => {
  assert.equal(reorderGenres(current, ["Драма", "Романтик"]), null);
  assert.equal(reorderGenres(current, ["Драма", "Романтик", "Триллер"]), null);
  assert.equal(reorderGenres(current, ["Драма", "Драма", "Романтик"]), null);
});
