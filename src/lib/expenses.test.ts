import assert from "node:assert/strict";
import test from "node:test";
import { expenseAmount, expenseCategoryTotals, expenseDate, expenseEntryWrite, expenseFromRecord, expenseWrite, recurringInstanceId, recurringMonths, salaryExpenseDraft, salaryExpenseId, spentOnForMonth } from "./expenses.ts";

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
  assert.equal("value" in saved && saved.value.frequency, "once");
  assert.equal("value" in saved && saved.value.source, "manual");
  assert.equal(expenseWrite({ title: "", amount: 1000, category: "Бусад", spentOn: "2026-10-22" }).error, "Зардлын нэр 1–80 тэмдэгт байна.");
});

test("new expense categories stay valid", () => {
  const saved = expenseWrite({ title: "Сайт", amount: 1000, category: "Веб хөгжүүлэлт", spentOn: "2026-10-01" }, 1);
  assert.equal("value" in saved && saved.value.category, "Веб хөгжүүлэлт");
  assert.equal(expenseWrite({ title: "Татвар", amount: 1000, category: "Татвар", spentOn: "2026-10-01" }).error, undefined);
});

test("stored expenses skip broken rows and old rows stay one-time", () => {
  const stored = expenseFromRecord("a", { title: "Сервер", amount: 90000, category: "Сервер", spentOn: "2026-10-01", note: "", createdAt: 1 });
  assert.equal(stored?.title, "Сервер");
  assert.equal(stored?.frequency, "once");
  assert.equal(stored?.source, "manual");
  assert.equal(stored?.receiptPath, "");
  assert.equal(expenseFromRecord("b", { title: "Хоосон", amount: 0, category: "Бусад", spentOn: "2026-10-01" }), null);
});

test("custom frequency only accepts 2, 3, 6, or 12 months", () => {
  const saved = expenseEntryWrite({ title: "Домэйн", amount: 50000, category: "Сервер", spentOn: "2026-01-15", frequency: "custom", intervalMonths: 12 });
  assert.equal("template" in saved && saved.kind === "recurring" && saved.template.intervalMonths, 12);
  assert.equal("template" in saved && saved.template.startMonth, "2026-01");
  assert.equal("template" in saved && saved.template.anchorDay, 15);
  assert.equal(expenseEntryWrite({ title: "Домэйн", amount: 50000, category: "Сервер", spentOn: "2026-01-15", frequency: "custom", intervalMonths: 5 }).error, "Давтамж 2, 3, 6 эсвэл 12 сар байна.");
});

test("recurring months honor the interval, the end, and skipped months", () => {
  assert.deepEqual(recurringMonths({ startMonth: "2026-01", intervalMonths: 3, endedMonth: "", skippedMonths: [] }, "2026-10"), ["2026-01", "2026-04", "2026-07", "2026-10"]);
  assert.deepEqual(recurringMonths({ startMonth: "2026-08", intervalMonths: 1, endedMonth: "", skippedMonths: [] }, "2026-10"), ["2026-08", "2026-09", "2026-10"]);
  assert.deepEqual(recurringMonths({ startMonth: "2026-08", intervalMonths: 1, endedMonth: "2026-09", skippedMonths: [] }, "2026-10"), ["2026-08", "2026-09"]);
  assert.deepEqual(recurringMonths({ startMonth: "2026-08", intervalMonths: 1, endedMonth: "", skippedMonths: ["2026-09"] }, "2026-10"), ["2026-08", "2026-10"]);
  assert.deepEqual(recurringMonths({ startMonth: "2026-11", intervalMonths: 1, endedMonth: "", skippedMonths: [] }, "2026-10"), []);
  assert.equal(recurringInstanceId("abc", "2026-10"), "recur_abc_2026-10");
});

test("a recurring anchor day clamps to the last day of a short month", () => {
  assert.equal(spentOnForMonth("2026-10", 22), "2026-10-22");
  assert.equal(spentOnForMonth("2026-02", 31), "2026-02-28");
  assert.equal(spentOnForMonth("2024-02", 31), "2024-02-29");
});

test("category totals follow the category order", () => {
  assert.deepEqual(expenseCategoryTotals([
    { category: "Татвар", amount: 10 },
    { category: "Татвар", amount: 5 },
    { category: "Хэрэгсэл", amount: 2 },
  ]), [
    { category: "Хэрэгсэл", total: 2 },
    { category: "Татвар", total: 15 },
  ]);
});

test("salary expense uses the payout day and a stable id", () => {
  assert.equal(salaryExpenseId("ada", "2026-10-a"), "salary_ada_2026-10-a");
  const mid = salaryExpenseDraft({ name: "Ада", payoutLabel: "10 сарын 15", spentOn: "2026-10-15", amount: 1600, createdAt: 5 });
  assert.equal(mid?.category, "Цалин");
  assert.equal(mid?.spentOn, "2026-10-15");
  assert.equal(mid?.source, "salary");
  assert.equal(mid?.frequency, "once");
  assert.equal(mid?.title, "Цалин · Ада · 10 сарын 15");
  const end = salaryExpenseDraft({ name: "Ада", payoutLabel: "10 сарын 30", spentOn: "2026-10-30", amount: 800, createdAt: 6 });
  assert.equal(end?.spentOn, "2026-10-30");
  const february = salaryExpenseDraft({ name: "Ада", payoutLabel: "2 сарын 28", spentOn: "2026-02-28", amount: 100, createdAt: 7 });
  assert.equal(february?.spentOn, "2026-02-28");
  assert.equal(salaryExpenseDraft({ name: "Ада", payoutLabel: "10 сарын 15", spentOn: "2026-10-15", amount: 0, createdAt: 1 }), null);
  const long = salaryExpenseDraft({ name: "А".repeat(100), payoutLabel: "10 сарын 15", spentOn: "2026-10-15", amount: 10, createdAt: 1 });
  assert.ok(long);
  assert.equal(long.title.length <= 80, true);
  assert.equal(long.title.startsWith("Цалин · "), true);
  assert.equal(long.title.endsWith(" · 10 сарын 15"), true);
});
