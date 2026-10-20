import { after, NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { jsonError } from "@/lib/http";
import { readPreview, subtitleUrl, type SeriesPreview } from "@/lib/preview";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { seriesId?: string };
  const seriesId = String(body.seriesId ?? "").trim();
  if (!seriesId) return jsonError("Кино олдсонгүй.");

  const seriesSnap = await adminDb().collection("series").doc(seriesId).get();
  if (!seriesSnap.exists || seriesSnap.data()?.status !== "Нийтлэгдсэн") return jsonError("Кино олдсонгүй.", 404);

  const data = seriesSnap.data() ?? {};
  if (data.previewReady === true) {
    const stored = readPreview(data.preview);
    if (!stored) return NextResponse.json({ youtube: false });
    return NextResponse.json(previewBody(seriesId, String(data.title ?? ""), stored));
  }

  const episodes = await seriesSnap.ref.collection("episodes").get();
  const ordered = episodes.docs
    .map((doc) => ({ id: doc.id, ref: doc.ref, data: doc.data() }))
    .sort((a, b) => Number(a.data.number ?? 0) - Number(b.data.number ?? 0));
  const candidates = ordered.filter((episode) => episode.data.source === "youtube" || episode.data.youtubeId);
  const resolved = await Promise.all(
    candidates.map(async (episode) => {
      let videoId = String(episode.data.youtubeId ?? "");
      let subtitlePath = String(episode.data.subtitlePath ?? "");
      if (!videoId) {
        const playback = await seriesSnap.ref.collection("playback").doc(episode.id).get();
        videoId = String(playback.data()?.youtubeId ?? "");
        if (!subtitlePath) subtitlePath = String(playback.data()?.subtitlePath ?? "");
      }
      return { episode, videoId, subtitlePath };
    }),
  );
  const first = resolved.find((item) => item.videoId);
  if (!first) {
    after(() => seriesSnap.ref.set({ previewReady: true }, { merge: true }).catch((error) => console.warn("Трейлерийг хадгалж чадсангүй.", error)));
    return NextResponse.json({ youtube: false });
  }

  const number = Number(first.episode.data.number ?? 1) || 1;
  const preview: SeriesPreview = {
    episodeId: first.episode.id,
    episodeNumber: number,
    videoId: first.videoId,
    startAt: Number(first.episode.data.startAt ?? 0),
    subtitlePath: first.subtitlePath,
    subtitleOffsetMs: Number(first.episode.data.subtitleOffsetMs ?? 0),
    episodeLabel: String(first.episode.data.title || `${number}-р анги`),
  };
  after(() =>
    seriesSnap.ref.set({ preview, previewReady: true }, { merge: true }).catch((error) => {
      console.warn("Трейлерийг хадгалж чадсангүй.", error);
    }),
  );
  if (!String(first.episode.data.youtubeId ?? "")) {
    const patch: Record<string, string> = { youtubeId: first.videoId };
    if (first.subtitlePath) patch.subtitlePath = first.subtitlePath;
    after(() => first.episode.ref.set(patch, { merge: true }).catch((error) => console.warn("Ангийн видеог хадгалж чадсангүй.", error)));
  }
  return NextResponse.json(previewBody(seriesId, String(data.title ?? ""), preview));
}

function previewBody(seriesId: string, title: string, preview: SeriesPreview) {
  return {
    youtube: true,
    videoId: preview.videoId,
    startAt: preview.startAt,
    subtitleOffsetMs: preview.subtitleOffsetMs,
    subtitleUrl: preview.subtitlePath ? subtitleUrl(seriesId, preview.episodeId) : "",
    episodeLabel: preview.episodeLabel,
    title,
  };
}
