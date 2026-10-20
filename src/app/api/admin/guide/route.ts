import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { assertAdmin, jsonError } from "@/lib/http";

export async function POST(request: NextRequest) {
  const session = await assertAdmin(request);
  if (!session) return jsonError("Нэвтрэх шаардлагатай.", 401);
  if (session.role !== "admin") return jsonError("Зөвхөн контент бүтээгчид хамаарна.", 403);
  const body = (await request.json().catch(() => ({}))) as { scope?: string };
  const now = Date.now();
  const patch = body.scope === "salary"
    ? { salaryGuideSeenAt: now }
    : { creatorGuideSeenAt: now, salaryGuideSeenAt: now };
  await adminDb().collection("admins").doc(session.adminId).set(patch, { merge: true });
  return NextResponse.json({ ok: true });
}
