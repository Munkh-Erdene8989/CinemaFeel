import assert from "node:assert/strict";
import test from "node:test";
import { revenueBetween, revenueForWindow, scopedRevenue } from "./revenue.ts";
import type { Payment, Series } from "./types.ts";

function series(partial: Pick<Series, "id" | "ownerId" | "uniqueViews"> & Partial<Series>): Series {
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
    featured: false,
    year: 2026,
    age: "13+",
    createdAt: 1,
    ...partial,
  };
}

function payment(partial: Pick<Payment, "id" | "mode" | "amount" | "status" | "createdAt"> & Partial<Payment>): Payment {
  return {
    uid: "u",
    email: "",
    product: "",
    seriesId: null,
    date: "",
    method: "QPay",
    invoiceId: "",
    senderInvoiceNo: "",
    paymentId: "",
    qrImage: "",
    qrText: "",
    urls: [],
    ...partial,
  };
}

test("a weekly payment joins the subscription pool, and an old payment stays outside the window", () => {
  const films = [series({ id: "film", ownerId: "creator", uniqueViews: 10 })];
  const report = revenueForWindow(
    films,
    [
      payment({ id: "new", mode: "weekly", amount: 5900, status: "Амжилттай", createdAt: 100 }),
      payment({ id: "old", mode: "single", amount: 4000, status: "Амжилттай", createdAt: 10, seriesId: "film" }),
    ],
    [{ id: "creator", name: "Ada", invitedById: "" }],
    50,
  );
  assert.equal(report.subscriptionGross, 5900);
  assert.equal(report.rows[0]?.gross, 0);
});

test("revenueBetween keeps payments inside the window and drops the end boundary", () => {
  const films = [series({ id: "film", ownerId: "creator", uniqueViews: 10 })];
  const report = revenueBetween(
    films,
    [
      payment({ id: "in", mode: "single", amount: 1000, status: "Амжилттай", createdAt: 100, seriesId: "film" }),
      payment({ id: "edge", mode: "single", amount: 5000, status: "Амжилттай", createdAt: 200, seriesId: "film" }),
      payment({ id: "before", mode: "single", amount: 9000, status: "Амжилттай", createdAt: 99, seriesId: "film" }),
    ],
    [{ id: "creator", name: "Ada" }],
    100,
    200,
  );
  assert.equal(report.rows[0]?.gross, 1000);
  assert.equal(report.admins[0]?.direct, 800);
});

test("a creator report keeps that creator's rows and hides the platform totals", () => {
  const films = [series({ id: "film", ownerId: "creator", uniqueViews: 4 })];
  const report = revenueForWindow(
    films,
    [payment({ id: "pay", mode: "single", amount: 2000, status: "Амжилттай", createdAt: 80, seriesId: "film" })],
    [{ id: "creator", name: "Ada" }],
    0,
  );
  const scoped = scopedRevenue(report, { role: "admin", adminId: "creator", name: "Ada" });
  assert.equal(scoped.subscriptionGross, 0);
  assert.equal(scoped.rows.length, 1);
  assert.equal(scoped.admins.length, 1);
  assert.equal(scopedRevenue(report, { role: "super", adminId: "super", name: "Super admin" }), report);
});
