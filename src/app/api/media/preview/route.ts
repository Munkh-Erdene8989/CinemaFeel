import { NextRequest, NextResponse } from "next/server";
import { adminBucket, adminDb } from "@/lib/firebase-admin";
import { jsonError } from "@/lib/http";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { seriesId?: string };
  const seriesId = String(body.seriesId ?? "").trim();
  if (!seriesId) return jsonError("Кино олдсонгүй.");

  const seriesSnap = await adminDb().collection("series").doc(seriesId).get();
  if (!seriesSnap.exists || seriesSnap.data()?.status !== "Нийтлэгдсэн") return jsonError("Кино олдсонгүй.", 404);

  const episodes = await seriesSnap.ref.collection("episodes").get();
  const ordered = episodes.docs
    .map((doc) => ({ id: doc.id, data: doc.data() }))
    .sort((a, b) => Number(a.data.number ?? 0) - Number(b.data.number ?? 0));

  for (const episode of ordered) {
    if (episode.data.source !== "youtube") continue;
    const playbackSnap = await seriesSnap.ref.collection("playback").doc(episode.id).get();
    const youtubeId = String(playbackSnap.data()?.youtubeId ?? "");
    if (!youtubeId) continue;

    let subtitleText = "";
    const subtitlePath = String(playbackSnap.data()?.subtitlePath ?? "");
    if (subtitlePath) {
      try {
        const [buffer] = await adminBucket().file(subtitlePath).download();
        subtitleText = buffer.toString("utf8");
      } catch (error) {
        console.warn("SRT уншиж чадсангүй.", error);
      }
    }

    const number = Number(episode.data.number ?? 1) || 1;
    return NextResponse.json({
      youtube: true,
      videoId: youtubeId,
      startAt: Number(episode.data.startAt ?? 0),
      subtitleOffsetMs: Number(episode.data.subtitleOffsetMs ?? 0),
      subtitleText,
      episodeLabel: String(episode.data.title || `${number}-р анги`),
      title: String(seriesSnap.data()?.title ?? ""),
    });
  }

  return NextResponse.json({ youtube: false });
}
