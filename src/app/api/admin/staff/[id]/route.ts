import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { jsonError, requireSuper } from "@/lib/http";
import { hashPassword } from "@/lib/staff";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const { id } = await context.params;
  const ref = adminDb().collection("admins").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return jsonError("Админ олдсонгүй.", 404);
  const body = (await request.json().catch(() => ({}))) as { name?: string; active?: boolean; password?: string };
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim().length >= 2) patch.name = body.name.trim();
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.password === "string" && body.password) {
    if (body.password.length < 6) return jsonError("Нууц үг хамгийн багадаа 6 тэмдэгт.");
    patch.passwordHash = hashPassword(body.password);
  }
  if (!Object.keys(patch).length) return jsonError("Өөрчлөх мэдээлэл алга.");
  await ref.set(patch, { merge: true });
  if (typeof patch.name === "string") {
    const series = await adminDb().collection("series").where("ownerId", "==", id).get();
    await Promise.all(series.docs.map((item) => item.ref.set({ ownerName: patch.name }, { merge: true })));
  }
  return NextResponse.json({ ok: true });
}
