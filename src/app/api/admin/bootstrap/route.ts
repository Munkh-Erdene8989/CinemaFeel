import { NextRequest, NextResponse } from "next/server";
import { listSeries } from "@/lib/catalog";
import { adminDb } from "@/lib/firebase-admin";
import { assertAdmin, jsonError } from "@/lib/http";
import { revenueForWindow, revenueWindow, scopedRevenue } from "@/lib/revenue";
import { withRolledViews } from "@/lib/views";
import { mapStaff } from "@/lib/staff";
import { mergeSettings, type AppUser, type Payment, type Settings } from "@/lib/types";

function mapPayment(id: string, data: Omit<Payment, "id">): Payment {
  return { id, ...data, qrImage: "", qrText: "", urls: [] };
}

export async function GET(request: NextRequest) {
  const session = await assertAdmin(request);
  if (!session) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const creator = session.role === "admin";
  const { since } = revenueWindow(creator ? 30 : 90);
  const [series, settingsSnap, paymentSnap, staffSnap, plusSnap, countSnap] = await Promise.all([
    listSeries().then(withRolledViews),
    adminDb().collection("settings").doc("app").get(),
    adminDb().collection("payments").where("createdAt", ">=", since).get(),
    adminDb().collection("admins").get(),
    creator ? Promise.resolve(null) : adminDb().collection("users").where("plan", "==", "Plus").get(),
    creator ? Promise.resolve(null) : adminDb().collection("users").count().get(),
  ]);
  const payments = paymentSnap.docs.map((item) => mapPayment(item.id, item.data() as Omit<Payment, "id">));
  const staff = staffSnap.docs.map((item) => ({
    id: item.id,
    name: String(item.data().name ?? ""),
    username: String(item.data().username ?? ""),
    invitedById: String(item.data().invitedById ?? ""),
  }));
  const settings = mergeSettings(settingsSnap.data() as Partial<Settings> | undefined);
  if (creator) {
    const profile = staffSnap.docs.find((item) => item.id === session.adminId)?.data();
    const revenue = scopedRevenue(revenueForWindow(series, payments, staff, since), session);
    return NextResponse.json({
      session: {
        ...session,
        inviteCode: String(profile?.inviteCode ?? ""),
        username: String(profile?.username ?? ""),
        cornerName: String(profile?.cornerName ?? ""),
        cornerNameEdits: Number(profile?.cornerNameEdits ?? 0),
        termsSeen: Number(profile?.creatorTermsSeenAt ?? 0) > 0,
        guideSeen: Number(profile?.creatorGuideSeenAt ?? 0) > 0,
      },
      series: series.filter((item) => item.ownerId === session.adminId),
      settings,
      payments: [],
      users: [],
      userCount: 0,
      staff: [],
      revenue,
    });
  }
  const users = (plusSnap?.docs ?? [])
    .map((item) => ({ uid: item.id, ...(item.data() as Omit<AppUser, "uid">) }))
    .sort((a, b) => String(b.joined).localeCompare(String(a.joined)));
  return NextResponse.json({
    session,
    series,
    settings,
    payments,
    users,
    userCount: countSnap?.data().count ?? users.length,
    staff: staffSnap.docs.map((item) => mapStaff(item.id, item.data() as Record<string, unknown>)).sort((a, b) => b.createdAt - a.createdAt),
    revenue: null,
  });
}
