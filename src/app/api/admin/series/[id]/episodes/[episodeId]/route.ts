import { NextRequest, NextResponse } from "next/server";
import { readManageableSeries } from "@/lib/catalog";
import { adminBucket } from "@/lib/firebase-admin";
import { assertAdmin, jsonError } from "@/lib/http";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string; episodeId: string }> }) {
  const session = await assertAdmin(request);
  if (!session) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const { id, episodeId } = await context.params;
  const loaded = await readManageableSeries(session, id);
  if (!loaded.ok) return jsonError(loaded.error, loaded.status);
  const ref = loaded.ref.collection("episodes").doc(episodeId);
  const snap = await ref.get();
  if (!snap.exists) return jsonError("Анги олдсонгүй.", 404);
  const path = String(snap.data()?.storagePath ?? "");
  if (path) await adminBucket().file(path).delete({ ignoreNotFound: true });
  await ref.delete();
  const count = (await loaded.ref.collection("episodes").get()).size;
  await loaded.ref.set({ episodes: count }, { merge: true });
  return NextResponse.json({ ok: true });
}
