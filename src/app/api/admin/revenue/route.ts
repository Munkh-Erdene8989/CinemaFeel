import { NextRequest, NextResponse } from "next/server";
import { mapSeries } from "@/lib/catalog";
import { adminDb } from "@/lib/firebase-admin";
import { assertAdmin, jsonError } from "@/lib/http";
import { buildRevenue, revenueWindow } from "@/lib/revenue";
import { SUPER_ADMIN_ID, type AdminRevenue, type Payment } from "@/lib/types";

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
  const names = new Map<string, string>([[SUPER_ADMIN_ID, "Super admin"]]);
  const invitedBy = new Map<string, string>();
  for (const admin of staffSnap.docs) {
    const data = admin.data();
    names.set(admin.id, String(data.name || data.username || admin.id));
    const invitedById = String(data.invitedById ?? "");
    if (invitedById) invitedBy.set(admin.id, invitedById);
  }
  const report = buildRevenue(series, payments, names, invitedBy);
  if (session.role === "super") return NextResponse.json(report);
  const mine: AdminRevenue = report.admins.find((item) => item.adminId === session.adminId) ?? {
    adminId: session.adminId,
    name: session.name,
    contentCount: 0,
    uniqueViews: 0,
    gross: 0,
    direct: 0,
    platformFee: 0,
    subscriptionShare: 0,
    referral: 0,
    referrals: [],
    total: 0,
    sharePercent: 0,
  };
  return NextResponse.json({
    subscriptionGross: 0,
    subscriptionPool: report.subscriptionPool,
    platformSubscription: 0,
    platformDirect: 0,
    referralPaid: mine.referral,
    totalUniqueViews: report.totalUniqueViews,
    unallocated: 0,
    rows: report.rows.filter((row) => row.ownerId === session.adminId),
    admins: [mine],
  });
}
