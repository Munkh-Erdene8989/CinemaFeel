import { after, NextResponse } from "next/server";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { jsonError } from "@/lib/http";
import { isMature } from "@/lib/mature";
import { readPreview, type SeriesPreview } from "@/lib/preview";
import { REEL_LIMIT, fileClip, shuffle, youtubeClip, type ReelClip } from "@/lib/reels";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snap = await adminDb().collection("series").where("status", "==", "Нийтлэгдсэн").get();
    const docs = snap.docs.filter((doc) => !isMature({ age: doc.data().age, genre: doc.data().genre }));
    const ready: ReelClip[] = [];
    const pending: QueryDocumentSnapshot[] = [];
    for (const doc of docs) {
      const data = doc.data();
      const uploaded = fileClip(doc.id, data);
      if (uploaded) {
        ready.push(uploaded);
        continue;
      }
      if (data.previewReady === true) {
        const clip = youtubeClip(doc.id, data, readPreview(data.preview));
        if (clip) ready.push(clip);
        continue;
      }
      pending.push(doc);
    }
    const resolved = await Promise.all(shuffle(pending).slice(0, 12).map((doc) => resolveYoutube(doc)));
    const clips = shuffle([...ready, ...resolved.filter((clip): clip is ReelClip => Boolean(clip))]).slice(0, REEL_LIMIT);
    return NextResponse.json({ clips }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.warn("Reel уншиж чадсангүй.", error);
    return jsonError("Богино бичлэг уншиж чадсангүй.", 500);
  }
}

async function resolveYoutube(seriesSnap: QueryDocumentSnapshot): Promise<ReelClip | null> {
  const data = seriesSnap.data();
  const episodes = await seriesSnap.ref.collection("episodes").get();
  const ordered = episodes.docs
    .map((doc) => ({ id: doc.id, ref: doc.ref, data: doc.data() }))
    .sort((a, b) => Number(a.data.number ?? 0) - Number(b.data.number ?? 0));
  const candidates = ordered.filter((episode) => episode.data.source === "youtube" || episode.data.youtubeId);
  for (const episode of candidates) {
    let videoId = String(episode.data.youtubeId ?? "");
    let subtitlePath = String(episode.data.subtitlePath ?? "");
    if (!videoId) {
      const playback = await seriesSnap.ref.collection("playback").doc(episode.id).get();
      videoId = String(playback.data()?.youtubeId ?? "");
      if (!subtitlePath) subtitlePath = String(playback.data()?.subtitlePath ?? "");
    }
    if (!videoId) continue;
    const number = Number(episode.data.number ?? 1) || 1;
    const preview: SeriesPreview = {
      episodeId: episode.id,
      episodeNumber: number,
      videoId,
      startAt: Number(episode.data.startAt ?? 0),
      subtitlePath,
      subtitleOffsetMs: Number(episode.data.subtitleOffsetMs ?? 0),
      episodeLabel: String(episode.data.title || `${number}-р анги`),
    };
    after(() => seriesSnap.ref.set({ preview, previewReady: true }, { merge: true }).catch((error) => console.warn("Трейлерийг хадгалж чадсангүй.", error)));
    if (!String(episode.data.youtubeId ?? "")) {
      const patch: Record<string, string> = { youtubeId: videoId };
      if (subtitlePath) patch.subtitlePath = subtitlePath;
      after(() => episode.ref.set(patch, { merge: true }).catch((error) => console.warn("Ангийн видеог хадгалж чадсангүй.", error)));
    }
    return youtubeClip(seriesSnap.id, data, preview);
  }
  after(() => seriesSnap.ref.set({ previewReady: true }, { merge: true }).catch((error) => console.warn("Трейлерийг хадгалж чадсангүй.", error)));
  return youtubeClip(seriesSnap.id, data, readPreview(data.preview));
}
