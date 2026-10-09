import { NextRequest, NextResponse } from "next/server";
import { adminBucket, adminDb } from "@/lib/firebase-admin";
import { assertAdmin, jsonError } from "@/lib/http";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string; episodeId: string }> }) {
  if (!assertAdmin(request)) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const { id, episodeId } = await context.params;
  const ref = adminDb().collection("series").doc(id).collection("episodes").doc(episodeId);
  const snap = await ref.get();
  if (!snap.exists) return jsonError("Анги олдсонгүй.", 404);
  const path = String(snap.data()?.storagePath ?? "");
  if (path) await adminBucket().file(path).delete({ ignoreNotFound: true });
  await ref.delete();
  const count = (await adminDb().collection("series").doc(id).collection("episodes").get()).size;
  await adminDb().collection("series").doc(id).set({ episodes: count }, { merge: true });
  return NextResponse.json({ ok: true });
}
