import assert from "node:assert/strict";
import test from "node:test";
import { buildActivityReport, monthlyListPrice, scenarioWeight, weeklyListPrice } from "./activity.ts";
import { WEEKLY_PRICE } from "./types.ts";

const now = Date.UTC(2026, 9, 22);
const day = 24 * 60 * 60 * 1000;

function user(uid: string, extra: { expiresAt?: number; email?: string; joined?: string } = {}) {
  return { uid, name: uid, email: extra.email ?? `${uid}@cinemafeel.mn`, phone: "", joined: extra.joined ?? "2026.10.20", expiresAt: extra.expiresAt ?? 0 };
}

function views(uid: string, count: number, lastDaysAgo: number) {
  return Array.from({ length: count }, (_, index) => ({
    uid,
    seriesId: `${uid}-${index}`,
    createdAt: now - lastDaysAgo * day - index,
  }));
}

test("monthly price falls back when the setting is empty", () => {
  assert.equal(monthlyListPrice("14900"), 14900);
  assert.equal(monthlyListPrice("₮14 900"), 14900);
  assert.equal(monthlyListPrice(""), 14900);
  assert.equal(weeklyListPrice(""), WEEKLY_PRICE);
  assert.equal(weeklyListPrice("7 900"), 7900);
});

test("a renewed recent viewer of four titles is a high renewal inside seven days", () => {
  const report = buildActivityReport({
    now,
    monthlyPrice: 14900,
    users: [user("ada", { expiresAt: now + 3 * day })],
    views: views("ada", 4, 1),
    payments: [
      { uid: "ada", mode: "weekly", status: "Амжилттай", amount: 6900, createdAt: now - 20 * day },
      { uid: "ada", mode: "weekly", status: "Амжилттай", amount: 6900, createdAt: now - 6 * day },
    ],
  });
  const row = report.windows[7].renewal[0];
  assert.equal(row.band, "high");
  assert.equal(row.amount, Math.round(6900 * 0.7));
  assert.equal(report.windows[7].totals.base, row.amount);
  assert.equal(report.groups.expiring.length, 1);
  assert.equal(report.groups.recent.length, 1);
});

test("one title or a stale package is a low renewal", () => {
  const report = buildActivityReport({
    now,
    monthlyPrice: 14900,
    users: [user("one", { expiresAt: now + 2 * day }), user("stale", { expiresAt: now + 2 * day })],
    views: [...views("one", 1, 1), ...views("stale", 3, 20)],
    payments: [
      { uid: "one", mode: "subscription", status: "Амжилттай", amount: 14900, createdAt: now - 10 * day },
      { uid: "stale", mode: "subscription", status: "Амжилттай", amount: 14900, createdAt: now - 10 * day },
    ],
  });
  const bands = Object.fromEntries(report.windows[7].renewal.map((row) => [row.uid, row.band]));
  assert.deepEqual(bands, { one: "low", stale: "low" });
  assert.equal(report.groups.dormant.some((row) => row.uid === "stale"), true);
});

test("a package that ends after seven days stays in the thirty day window", () => {
  const report = buildActivityReport({
    now,
    monthlyPrice: 14900,
    users: [user("late", { expiresAt: now + 20 * day })],
    views: views("late", 2, 2),
    payments: [{ uid: "late", mode: "subscription", status: "Амжилттай", amount: 14900, createdAt: now - 10 * day }],
  });
  assert.equal(report.windows[7].renewal.length, 0);
  assert.equal(report.windows[30].renewal[0]?.band, "mid");
  assert.equal(report.groups.expiring.length, 0);
});

test("an unpaid viewer of two recent titles is a new weekly package", () => {
  const report = buildActivityReport({
    now,
    monthlyPrice: 14900,
    users: [user("new"), user("old")],
    views: [...views("new", 3, 1), ...views("old", 4, 10)],
    payments: [],
  });
  assert.equal(report.windows[7].acquisition.length, 1);
  assert.equal(report.windows[7].acquisition[0]?.uid, "new");
  assert.equal(report.windows[7].acquisition[0]?.price, WEEKLY_PRICE);
  assert.equal(report.weeklyPrice, WEEKLY_PRICE);
  const custom = buildActivityReport({
    now,
    monthlyPrice: 14900,
    weeklyPrice: 5000,
    users: [user("new")],
    views: views("new", 3, 1),
    payments: [],
  });
  assert.equal(custom.weeklyPrice, 5000);
  assert.equal(custom.windows[7].acquisition[0]?.price, 5000);
  assert.equal(report.windows[7].acquisition[0]?.weight, 0.2);
  assert.equal(report.windows[30].acquisition.length, 2);
  assert.equal(report.groups.prospects.length, 2);
});

test("a granted pass without payment is not package revenue", () => {
  const report = buildActivityReport({
    now,
    monthlyPrice: 14900,
    users: [user("grant", { expiresAt: now + 10 * day })],
    views: views("grant", 3, 1),
    payments: [{ uid: "grant", mode: "single", status: "Амжилттай", amount: 4000, createdAt: now - day }],
  });
  assert.equal(report.windows[30].renewal.length, 0);
  assert.equal(report.windows[30].acquisition.length, 0);
  assert.equal(report.groups.recent.length, 1);
});

test("the high scenario stops at 90 percent of the package price", () => {
  assert.equal(scenarioWeight("high", "renewal", "high"), 0.9);
  assert.equal(scenarioWeight("high", "renewal", "base"), 0.7);
  assert.equal(scenarioWeight("low", "acquisition", "low"), 0.0375);
});
