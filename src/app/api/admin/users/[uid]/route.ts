import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { assertAdmin, jsonError } from "@/lib/http";

export async function PATCH(request: NextRequest, context: { params: Promise<{ uid: string }> }) {
  if (!assertAdmin(request)) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const { uid } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { plan?: string; status?: string };
  const patch: Record<string, string | number> = {};
  if (body.plan === "Plus" || body.plan === "Үндсэн") patch.plan = body.plan;
  if (body.status === "Идэвхтэй" || body.status === "Түр зогссон") patch.status = body.status;
  if (body.plan === "Plus") {
    const current = await adminDb().collection("users").doc(uid).get();
    const expires = Number(current.data()?.subscriptionExpiresAt ?? 0);
    if (expires < Date.now()) patch.subscriptionExpiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  }
  if (body.plan === "Үндсэн") patch.subscriptionExpiresAt = 0;
  if (!Object.keys(patch).length) return jsonError("Өөрчлөх мэдээлэл алга.");
  await adminDb().collection("users").doc(uid).set(patch, { merge: true });
  return NextResponse.json({ ok: true });
}
