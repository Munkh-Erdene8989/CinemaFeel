import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { assertAdmin, jsonError } from "@/lib/http";

export async function POST(request: NextRequest) {
  const session = await assertAdmin(request);
  if (!session) return jsonError("Нэвтрэх шаардлагатай.", 401);
  if (session.role !== "admin") return jsonError("Зөвхөн контент бүтээгчид хамаарна.", 403);
  await adminDb().collection("admins").doc(session.adminId).set({ creatorGuideSeenAt: Date.now() }, { merge: true });
  return NextResponse.json({ ok: true });
}
