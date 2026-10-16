import { NextRequest, NextResponse } from "next/server";
import { mapSeries } from "@/lib/catalog";
import { adminDb } from "@/lib/firebase-admin";
import { assertAdmin, jsonError } from "@/lib/http";
import { revenueForWindow, revenueWindow, scopedRevenue } from "@/lib/revenue";
import type { Payment } from "@/lib/types";

export async function GET(request: NextRequest) {
  const session = await assertAdmin(request);
  if (!session) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const { since } = revenueWindow(request.nextUrl.searchParams.get("days"));
  const [seriesSnap, paymentSnap, staffSnap] = await Promise.all([
    adminDb().collection("series").get(),
    adminDb().collection("payments").where("createdAt", ">=", since).get(),
    adminDb().collection("admins").get(),
  ]);
  const series = seriesSnap.docs.map((item) => mapSeries(item.id, item.data()));
  const payments = paymentSnap.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Payment, "id">) }));
  const staff = staffSnap.docs.map((admin) => {
    const data = admin.data();
    return { id: admin.id, name: String(data.name ?? ""), username: String(data.username ?? ""), invitedById: String(data.invitedById ?? "") };
  });
  const report = revenueForWindow(series, payments, staff, since);
  return NextResponse.json(scopedRevenue(report, session));
}
