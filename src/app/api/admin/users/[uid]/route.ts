import { NextRequest, NextResponse } from "next/server";
import { clearPass, extendPass } from "@/lib/entitlement";
import { adminDb } from "@/lib/firebase-admin";
import { jsonError, requireSuper } from "@/lib/http";

export async function PATCH(request: NextRequest, context: { params: Promise<{ uid: string }> }) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const { uid } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { plan?: string; status?: string };
  const patch: Record<string, string | number> = {};
  if (body.plan === "Plus" || body.plan === "Үндсэн") patch.plan = body.plan;
  if (body.status === "Идэвхтэй" || body.status === "Түр зогссон") patch.status = body.status;
  if (body.plan === "Plus") {
    const current = await adminDb().collection("users").doc(uid).get();
    const expires = Number(current.data()?.subscriptionExpiresAt ?? 0);
    Object.assign(patch, extendPass(expires));
  }
  if (body.plan === "Үндсэн") Object.assign(patch, clearPass());
  if (!Object.keys(patch).length) return jsonError("Өөрчлөх мэдээлэл алга.");
  await adminDb().collection("users").doc(uid).set(patch, { merge: true });
  return NextResponse.json({ ok: true, ...patch });
}
