import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { userCanWatch } from "@/lib/access";
import { playbackDenial } from "@/lib/playback";
import { mapSeries } from "@/lib/catalog";
import { adminBucket, adminDb } from "@/lib/firebase-admin";
import { jsonError, readUser } from "@/lib/http";
import { recordUniqueView } from "@/lib/views";

export async function POST(request: NextRequest) {
  const user = await readUser(request);
  if (!user?.uid) {
    const denial = playbackDenial(false, false)!;
    return NextResponse.json({ error: denial.error, code: denial.code }, { status: denial.status });
  }
  const body = (await request.json().catch(() => ({}))) as { seriesId?: string; episodeId?: string };
  if (!body.seriesId || !body.episodeId) return jsonError("Анги олдсонгүй.");
  const seriesSnap = await adminDb().collection("series").doc(body.seriesId).get();
  if (!seriesSnap.exists || seriesSnap.data()?.status !== "Нийтлэгдсэн") return jsonError("Кино олдсонгүй.", 404);
  const series = mapSeries(seriesSnap.id, seriesSnap.data()!);
  const allowed = await userCanWatch(adminDb(), user.uid, series);
  const denial = playbackDenial(true, allowed);
  if (denial) return NextResponse.json({ error: denial.error, code: denial.code }, { status: denial.status });
  const episode = await seriesSnap.ref.collection("episodes").doc(body.episodeId).get();
  if (!episode.exists) return jsonError("Анги олдсонгүй.", 404);
  const data = episode.data() ?? {};
  const playback = await seriesSnap.ref.collection("playback").doc(episode.id).get();
  const youtubeId = String(playback.data()?.youtubeId ?? "");
  if (youtubeId) {
    let subtitleText = "";
    const subtitlePath = String(playback.data()?.subtitlePath ?? "");
    if (subtitlePath) {
      try {
        const [buffer] = await adminBucket().file(subtitlePath).download();
        subtitleText = buffer.toString("utf8");
      } catch (error) {
        console.warn("SRT уншиж чадсангүй.", error);
      }
    }
    await seriesSnap.ref.set({ views: FieldValue.increment(1) }, { merge: true });
    await recordUniqueView(body.seriesId, user.uid, String(seriesSnap.data()?.ownerId ?? ""));
    return NextResponse.json({
      youtubeId,
      startAt: Number(data.startAt ?? 0),
      subtitleOffsetMs: Number(data.subtitleOffsetMs ?? 0),
      subtitleText,
      title: data.title || series.title,
    });
  }
  const storagePath = String(data.storagePath ?? "");
  if (!storagePath) return jsonError("Энэ ангийн видео оруулаагүй байна.", 404);
  const [url] = await adminBucket().file(storagePath).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 2 * 60 * 60 * 1000,
  });
  await seriesSnap.ref.set({ views: FieldValue.increment(1) }, { merge: true });
  await recordUniqueView(body.seriesId, user.uid, String(seriesSnap.data()?.ownerId ?? ""));
  return NextResponse.json({ url, title: episode.data()?.title || series.title });
}
