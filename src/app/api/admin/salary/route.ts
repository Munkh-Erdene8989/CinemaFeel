import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { syncSalaryExpense } from "@/lib/expense-store";
import { assertAdmin, jsonError, requireSuper } from "@/lib/http";
import { listedSalaryCycle, payableSalaryCycles, salaryPayoutDocId, salaryStatus } from "@/lib/salary";
import { loadSalaryCreators } from "@/lib/salary-report";

export async function GET(request: NextRequest) {
  const session = await assertAdmin(request);
  if (!session) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const creators = await loadSalaryCreators(payableSalaryCycles());
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
  const cycle = listedSalaryCycle(cycleId);
  if (!cycle) return jsonError("Энэ цикл жагсаалтад байхгүй.");
  const admin = await adminDb().collection("admins").doc(adminId).get();
  if (!admin.exists) return jsonError("Контент бүтээгч олдсонгүй.", 404);
  const paidAt = body.paid ? Date.now() : 0;
  const creators = body.paid ? await loadSalaryCreators([cycle]) : [];
  const creator = creators.find((item) => item.adminId === adminId);
  const amount = creator?.lines.find((line) => line.id === cycle.id)?.total ?? 0;
  const name = creator?.name || String(admin.data()?.name ?? "");
  await adminDb().collection("salaryPayouts").doc(salaryPayoutDocId(adminId, cycleId)).set({
    adminId,
    cycleId,
    paid: body.paid,
    paidAt,
    paidBy: gate.session?.adminId || "super",
  }, { merge: true });
  const expense = await syncSalaryExpense({ adminId, name, cycle, amount, paid: body.paid, paidAt });
  return NextResponse.json({ adminId, cycleId, paid: body.paid, paidAt, status: salaryStatus(body.paid), expense });
}
