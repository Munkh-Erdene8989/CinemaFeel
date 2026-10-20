import { NextRequest, NextResponse } from "next/server";
import { mapSeries } from "@/lib/catalog";
import { adminDb } from "@/lib/firebase-admin";
import { assertAdmin, jsonError, requireSuper } from "@/lib/http";
import { buildSalaryCreators, listedSalaryCycle, recentSalaryCycles, salaryPayoutDocId, salaryStatus, type SalaryPayout } from "@/lib/salary";
import type { Payment } from "@/lib/types";

export async function GET(request: NextRequest) {
  const session = await assertAdmin(request);
  if (!session) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const cycles = recentSalaryCycles();
  const since = cycles[cycles.length - 1]?.start ?? 0;
  const [seriesSnap, paymentSnap, staffSnap, payoutSnap] = await Promise.all([
    adminDb().collection("series").get(),
    adminDb().collection("payments").where("createdAt", ">=", since).get(),
    adminDb().collection("admins").get(),
    adminDb().collection("salaryPayouts").where("cycleId", "in", cycles.map((cycle) => cycle.id)).get(),
  ]);
  const series = seriesSnap.docs.map((item) => mapSeries(item.id, item.data()));
  const payments = paymentSnap.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Payment, "id">) }));
  const staff = staffSnap.docs.map((admin) => {
    const data = admin.data();
    return {
      id: admin.id,
      name: String(data.name ?? ""),
      username: String(data.username ?? ""),
      invitedById: String(data.invitedById ?? ""),
      bankName: String(data.bankName ?? ""),
      bankAccount: String(data.bankAccount ?? ""),
    };
  });
  const payouts: SalaryPayout[] = payoutSnap.docs.map((item) => {
    const data = item.data();
    return {
      adminId: String(data.adminId ?? ""),
      cycleId: String(data.cycleId ?? ""),
      paid: data.paid === true,
      paidAt: Number(data.paidAt ?? 0),
    };
  }).filter((item) => item.adminId && item.cycleId);
  const creators = buildSalaryCreators(cycles, series, payments, staff, payouts);
  return NextResponse.json({
    creators: session.role === "super" ? creators : creators.filter((creator) => creator.adminId === session.adminId),
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const body = (await request.json().catch(() => ({}))) as { adminId?: string; cycleId?: string; paid?: boolean };
  const adminId = String(body.adminId ?? "").trim();
  const cycleId = String(body.cycleId ?? "").trim();
  if (!adminId || !cycleId || typeof body.paid !== "boolean") return jsonError("Цалингийн мэдээлэл дутуу.");
  if (!listedSalaryCycle(cycleId)) return jsonError("Энэ цикл жагсаалтад байхгүй.");
  const admin = await adminDb().collection("admins").doc(adminId).get();
  if (!admin.exists) return jsonError("Контент бүтээгч олдсонгүй.", 404);
  const paidAt = body.paid ? Date.now() : 0;
  await adminDb().collection("salaryPayouts").doc(salaryPayoutDocId(adminId, cycleId)).set({
    adminId,
    cycleId,
    paid: body.paid,
    paidAt,
    paidBy: gate.session?.adminId || "super",
  }, { merge: true });
  return NextResponse.json({ adminId, cycleId, paid: body.paid, paidAt, status: salaryStatus(body.paid) });
}
