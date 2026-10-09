import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { userCanWatch } from "@/lib/access";
import { mapSeries } from "@/lib/catalog";
import { adminBucket, adminDb } from "@/lib/firebase-admin";
import { jsonError, readUser } from "@/lib/http";

export async function POST(request: NextRequest) {
  const user = await readUser(request);
  if (!user?.uid) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const body = (await request.json().catch(() => ({}))) as { seriesId?: string; episodeId?: string };
  if (!body.seriesId || !body.episodeId) return jsonError("Анги олдсонгүй.");
  const seriesSnap = await adminDb().collection("series").doc(body.seriesId).get();
  if (!seriesSnap.exists || seriesSnap.data()?.status !== "Нийтлэгдсэн") return jsonError("Кино олдсонгүй.", 404);
  const series = mapSeries(seriesSnap.id, seriesSnap.data()!);
  const allowed = await userCanWatch(adminDb(), user.uid, series);
  if (!allowed) return jsonError("Энэ киног үзэх эрхгүй байна.", 403);
  const episode = await seriesSnap.ref.collection("episodes").doc(body.episodeId).get();
  if (!episode.exists) return jsonError("Анги олдсонгүй.", 404);
  const storagePath = String(episode.data()?.storagePath ?? "");
  if (!storagePath) return jsonError("Энэ ангийн видео оруулаагүй байна.", 404);
  const [url] = await adminBucket().file(storagePath).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 2 * 60 * 60 * 1000,
  });
  await seriesSnap.ref.set({ views: FieldValue.increment(1) }, { merge: true });
  return NextResponse.json({ url, title: episode.data()?.title || series.title });
}
