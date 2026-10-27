import { NextRequest, NextResponse } from "next/server";
import { loadSeriesWithViews } from "@/lib/catalog";
import { adminDb } from "@/lib/firebase-admin";
import { assertAdmin, jsonError } from "@/lib/http";
import { paymentsWithoutQr } from "@/lib/payment-query";
import { revenueForWindow, revenueWindow, scopedRevenue } from "@/lib/revenue";
import type { Payment } from "@/lib/types";
import { loadPeriodViews } from "@/lib/views";

export async function GET(request: NextRequest) {
  const session = await assertAdmin(request);
  if (!session) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const { since } = revenueWindow(request.nextUrl.searchParams.get("days"));
  const [series, paymentSnap, staffSnap, views] = await Promise.all([
    loadSeriesWithViews(),
    paymentsWithoutQr(adminDb().collection("payments").where("createdAt", ">=", since)).get(),
    adminDb().collection("admins").get(),
    loadPeriodViews(since),
  ]);
  const payments = paymentSnap.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Payment, "id">) }));
  const staff = staffSnap.docs.map((admin) => {
    const data = admin.data();
    return { id: admin.id, name: String(data.name ?? ""), username: String(data.username ?? ""), invitedById: String(data.invitedById ?? "") };
  });
  const report = revenueForWindow(series, payments, staff, since, views);
  return NextResponse.json(scopedRevenue(report, session));
}
