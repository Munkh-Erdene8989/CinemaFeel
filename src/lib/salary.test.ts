import assert from "node:assert/strict";
import test from "node:test";
import { buildSalaryCreators, currentSalaryCycle, payableSalaryCycles, recentSalaryCycles, salaryCycleAt } from "./salary.ts";
import type { Payment, Series } from "./types.ts";

const UB_OFFSET_MS = 8 * 60 * 60 * 1000;

function at(year: number, month: number, day: number, hour = 0, minute = 0) {
  return Date.UTC(year, month - 1, day, hour, minute) - UB_OFFSET_MS;
}

function series(partial: Pick<Series, "id" | "ownerId" | "uniqueViews">): Series {
  return {
    title: partial.id,
    genre: "Драма",
    description: "",
    episodes: 1,
    price: 1000,
    access: "paid",
    image: "",
    cover: "",
    shareCode: "",
    views: 0,
    ownerName: "",
    status: "Нийтлэгдсэн",
    translation: "",
    featured: false,
    year: 2026,
    age: "13+",
    createdAt: 1,
    ...partial,
  };
}

function payment(partial: Pick<Payment, "id" | "amount" | "createdAt">): Payment {
  return {
    uid: "u",
    email: "",
    product: "",
    mode: "single",
    seriesId: "film",
    date: "",
    method: "QPay",
    invoiceId: "",
    senderInvoiceNo: "",
    paymentId: "",
    qrImage: "",
    qrText: "",
    urls: [],
    status: "Амжилттай",
    ...partial,
  };
}

test("the 15th stays in the first half and the 16th opens the second", () => {
  const fifteenth = currentSalaryCycle(at(2026, 10, 15, 23, 59));
  assert.equal(fifteenth.id, "2026-10-a");
  assert.equal(fifteenth.label, "10 сарын 1 – 15");
  assert.equal(fifteenth.payoutLabel, "10 сарын 15");
  assert.equal(fifteenth.start, at(2026, 10, 1));
  assert.equal(fifteenth.end, at(2026, 10, 16));

  const sixteenth = currentSalaryCycle(at(2026, 10, 16));
  assert.equal(sixteenth.id, "2026-10-b");
  assert.equal(sixteenth.start, at(2026, 10, 16));
  assert.equal(sixteenth.end, at(2026, 11, 1));
  assert.equal(sixteenth.payoutLabel, "10 сарын 30");
});

test("the 30th and the 31st stay in the second half, and the 1st opens the next month", () => {
  assert.equal(currentSalaryCycle(at(2026, 10, 30, 12)).id, "2026-10-b");
  const last = currentSalaryCycle(at(2026, 10, 31, 23, 59));
  assert.equal(last.id, "2026-10-b");
  assert.ok(at(2026, 10, 31, 23, 59) >= last.start && at(2026, 10, 31, 23, 59) < last.end);

  const next = currentSalaryCycle(at(2026, 11, 1));
  assert.equal(next.id, "2026-11-a");
  assert.equal(next.start, at(2026, 11, 1));
  assert.equal(recentSalaryCycles(at(2026, 1, 1), 2).map((cycle) => cycle.id).join(","), "2026-01-a,2025-12-b");
});

test("February pays on the last day of the month", () => {
  const plain = salaryCycleAt(2026, 2, "b");
  assert.equal(plain.payoutLabel, "2 сарын 28");
  assert.equal(plain.label, "2 сарын 16 – 28");
  assert.equal(plain.end, at(2026, 3, 1));
  assert.equal(currentSalaryCycle(at(2026, 2, 28, 23, 59)).id, "2026-02-b");

  const leap = salaryCycleAt(2024, 2, "b");
  assert.equal(leap.payoutLabel, "2 сарын 29");
  assert.equal(leap.label, "2 сарын 16 – 29");
  assert.equal(currentSalaryCycle(at(2024, 2, 29, 23, 59)).id, "2024-02-b");
});

test("payable cycles start in October 2026 and keep every later half", () => {
  assert.deepEqual(payableSalaryCycles(at(2026, 9, 30)).map((cycle) => cycle.id), []);
  assert.deepEqual(payableSalaryCycles(at(2026, 10, 10)).map((cycle) => cycle.id), ["2026-10-a"]);
  assert.deepEqual(payableSalaryCycles(at(2026, 10, 21)).map((cycle) => cycle.id), ["2026-10-b", "2026-10-a"]);
  assert.deepEqual(payableSalaryCycles(at(2026, 11, 1)).map((cycle) => cycle.id), ["2026-11-a", "2026-10-b", "2026-10-a"]);
});

test("a paid mark changes status without changing the cycle amount", () => {
  const cycles = recentSalaryCycles(at(2026, 10, 16), 2);
  const creators = buildSalaryCreators(
    cycles,
    [series({ id: "film", ownerId: "ada", uniqueViews: 4 })],
    [payment({ id: "late", amount: 1000, createdAt: at(2026, 10, 31, 8) }), payment({ id: "early", amount: 2000, createdAt: at(2026, 10, 10, 8) })],
    [{ id: "ada", name: "Ада", username: "ada", bankName: "Хаан", bankAccount: "5123456789" }],
    [{ adminId: "ada", cycleId: "2026-10-a", paid: true, paidAt: at(2026, 10, 15, 18) }],
  );
  const [creator] = creators;
  assert.equal(creator?.lines[0]?.id, "2026-10-b");
  assert.equal(creator?.lines[0]?.total, 800);
  assert.equal(creator?.lines[0]?.status, "Хүлээгдэж буй");
  assert.equal(creator?.lines[1]?.id, "2026-10-a");
  assert.equal(creator?.lines[1]?.total, 1600);
  assert.equal(creator?.lines[1]?.status, "Олгосон");
  assert.equal(creator?.bankAccount, "5123456789");
});
