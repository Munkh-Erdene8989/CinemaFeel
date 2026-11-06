import { NextRequest, NextResponse } from "next/server";
import { detachCreatorViewers } from "@/lib/access";
import { adminDb } from "@/lib/firebase-admin";
import { jsonError, requireSuper } from "@/lib/http";
import { hashPassword } from "@/lib/staff";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const { id } = await context.params;
  const ref = adminDb().collection("admins").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return jsonError("Контент бүтээгч олдсонгүй.", 404);
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

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const { id } = await context.params;
  const db = adminDb();
  const ref = db.collection("admins").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return jsonError("Контент бүтээгч олдсонгүй.", 404);

  const [invited, byCreator, byUid] = await Promise.all([
    db.collection("admins").where("invitedById", "==", id).get(),
    db.collection("payments").where("creatorId", "==", id).get(),
    db.collection("payments").where("uid", "==", `creator:${id}`).get(),
  ]);
  const pending = new Map<string, (typeof byCreator.docs)[number]["ref"]>();
  for (const item of [...byCreator.docs, ...byUid.docs]) {
    const data = item.data();
    if (data.mode === "creator" && data.status === "Хүлээгдэж буй") pending.set(item.id, item.ref);
  }

  for (let index = 0; index < invited.docs.length; index += 400) {
    const batch = db.batch();
    invited.docs.slice(index, index + 400).forEach((item) => batch.set(item.ref, { invitedById: "" }, { merge: true }));
    await batch.commit();
  }
  await Promise.all([...pending.values()].map((paymentRef) => db.runTransaction(async (tx) => {
    const fresh = await tx.get(paymentRef);
    if (fresh.get("status") !== "Хүлээгдэж буй") return;
    tx.set(paymentRef, { status: "Амжилтгүй" }, { merge: true });
  })));
  await detachCreatorViewers(db, id);
  await ref.delete();
  return NextResponse.json({ ok: true });
}
