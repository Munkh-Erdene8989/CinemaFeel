import { NextRequest, NextResponse } from "next/server";
import { mapSeries } from "@/lib/catalog";
import { adminDb } from "@/lib/firebase-admin";
import { assertAdmin, jsonError, requireSuper } from "@/lib/http";
import { paymentsWithoutQr } from "@/lib/payment-query";
import { buildSalaryCreators, listedSalaryCycle, payableSalaryCycles, salaryPayoutDocId, salaryStatus, type SalaryPayout } from "@/lib/salary";
import type { Payment } from "@/lib/types";

export async function GET(request: NextRequest) {
  const session = await assertAdmin(request);
  if (!session) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const cycles = payableSalaryCycles();
  const since = cycles[cycles.length - 1]?.start ?? Date.now();
  const cycleIds = cycles.map((cycle) => cycle.id);
  const payoutChunks: string[][] = [];
  for (let index = 0; index < cycleIds.length; index += 30) payoutChunks.push(cycleIds.slice(index, index + 30));
  const [seriesSnap, paymentSnap, staffSnap, payoutSnaps] = await Promise.all([
    adminDb().collection("series").get(),
    paymentsWithoutQr(adminDb().collection("payments").where("createdAt", ">=", since)).get(),
    adminDb().collection("admins").get(),
    Promise.all(payoutChunks.map((ids) => adminDb().collection("salaryPayouts").where("cycleId", "in", ids).get())),
  ]);
  const payoutSnap = payoutSnaps.flatMap((snap) => snap.docs);
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
  const payouts: SalaryPayout[] = payoutSnap.map((item) => {
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
