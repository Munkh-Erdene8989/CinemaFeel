import assert from "node:assert/strict";
import test from "node:test";
import { expenseAmount, expenseDate, expenseFromRecord, expenseWrite } from "./expenses.ts";

test("expense amount is a positive tugrik", () => {
  assert.equal(expenseAmount(1500.4), 1500);
  assert.equal(expenseAmount(0), 0);
  assert.equal(expenseAmount(-20), 0);
});

test("expense date keeps a real calendar day", () => {
  assert.equal(expenseDate("2026-10-22"), "2026-10-22");
  assert.equal(expenseDate("2026-02-31"), "");
  assert.equal(expenseDate("22.10.2026"), "");
});

test("expense write accepts a complete entry", () => {
  const saved = expenseWrite({ title: "  Meta зар  ", amount: 250000, category: "Зар сурталчилгаа", spentOn: "2026-10-22", note: "10 сар" }, 10);
  assert.equal("value" in saved && saved.value.title, "Meta зар");
  assert.equal("value" in saved && saved.value.amount, 250000);
  assert.equal("value" in saved && saved.value.category, "Зар сурталчилгаа");
  assert.equal(expenseWrite({ title: "", amount: 1000, category: "Бусад", spentOn: "2026-10-22" }).error, "Зардлын нэр 1–80 тэмдэгт байна.");
});

test("stored expenses skip broken rows", () => {
  assert.equal(expenseFromRecord("a", { title: "Сервер", amount: 90000, category: "Сервер", spentOn: "2026-10-01", note: "", createdAt: 1 })?.title, "Сервер");
  assert.equal(expenseFromRecord("b", { title: "Хоосон", amount: 0, category: "Бусад", spentOn: "2026-10-01" }), null);
});
