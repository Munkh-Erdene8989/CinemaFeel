import assert from "node:assert/strict";
import test from "node:test";
import { seriesAccess, seriesFromRecord, seriesStatus, seriesWritePayload } from "./series-doc.ts";

test("a zero price is free on read and write", () => {
  assert.equal(seriesAccess(0, "paid"), "free");
  assert.equal(seriesAccess(1000, "free"), "free");
  assert.equal(seriesAccess(1000, "paid"), "paid");
  assert.equal(seriesFromRecord("a", { price: 0, access: "paid" }).access, "free");
  assert.equal(seriesWritePayload({ price: 0 }).access, "free");
  assert.equal(seriesWritePayload({ price: 4900 }).access, "paid");
});

test("missing status is a draft", () => {
  assert.equal(seriesStatus(undefined), "Ноорог");
  assert.equal(seriesStatus("Нийтлэгдсэн"), "Нийтлэгдсэн");
  assert.equal(seriesFromRecord("a", {}).status, "Ноорог");
  assert.equal(seriesWritePayload({}).status, "Ноорог");
});
