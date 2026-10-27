import { after, NextRequest, NextResponse } from "next/server";
import { userCanWatch } from "@/lib/access";
import { playbackDenial } from "@/lib/playback";
import { mapSeries } from "@/lib/catalog";
import { adminDb, readableObjectUrl } from "@/lib/firebase-admin";
import { jsonError, readUser } from "@/lib/http";
import { muxConfigured, playbackToken, syncAsset } from "@/lib/mux";
import { playbackProvider } from "@/lib/mux-source";
import { subtitleUrl } from "@/lib/preview";
import { recordPlaybackView } from "@/lib/views";

export async function POST(request: NextRequest) {
  const user = await readUser(request);
  if (!user?.uid) {
    const denial = playbackDenial(false, false)!;
    return NextResponse.json({ error: denial.error, code: denial.code }, { status: denial.status });
  }
  const body = (await request.json().catch(() => ({}))) as { seriesId?: string; episodeId?: string; fallback?: boolean };
  if (!body.seriesId || !body.episodeId) return jsonError("Анги олдсонгүй.");

  const db = adminDb();
  const seriesRef = db.collection("series").doc(body.seriesId);
  const [seriesSnap, userSnap, episodeSnap] = await Promise.all([
    seriesRef.get(),
    db.collection("users").doc(user.uid).get(),
    seriesRef.collection("episodes").doc(body.episodeId).get(),
  ]);
  if (!seriesSnap.exists || seriesSnap.data()?.status !== "Нийтлэгдсэн") return jsonError("Кино олдсонгүй.", 404);
  const series = mapSeries(seriesSnap.id, seriesSnap.data()!);
  const ownerId = String(seriesSnap.data()?.ownerId ?? "");
  const allowed = await userCanWatch(db, user.uid, series, userSnap.exists ? (userSnap.data() ?? null) : null);
  const denial = playbackDenial(true, allowed);
  if (denial) return NextResponse.json({ error: denial.error, code: denial.code }, { status: denial.status });
  if (!episodeSnap.exists) return jsonError("Анги олдсонгүй.", 404);

  const data = episodeSnap.data() ?? {};
  let youtubeId = String(data.youtubeId ?? "");
  let subtitlePath = String(data.subtitlePath ?? "");
  if (!youtubeId && data.source === "youtube") {
    const playback = await seriesRef.collection("playback").doc(episodeSnap.id).get();
    youtubeId = String(playback.data()?.youtubeId ?? "");
    if (!subtitlePath) subtitlePath = String(playback.data()?.subtitlePath ?? "");
    if (youtubeId) {
      const patch: Record<string, string> = { youtubeId };
      if (subtitlePath) patch.subtitlePath = subtitlePath;
      after(() => episodeSnap.ref.set(patch, { merge: true }).catch((error) => console.warn("Ангийн видеог хадгалж чадсангүй.", error)));
    }
  }

  if (youtubeId) {
    return finish(body.seriesId, user.uid, ownerId, {
      provider: "youtube",
      youtubeId,
      startAt: Number(data.startAt ?? 0),
      subtitleOffsetMs: Number(data.subtitleOffsetMs ?? 0),
      subtitleUrl: subtitlePath ? subtitleUrl(body.seriesId, episodeSnap.id) : "",
      title: data.title || series.title,
    }, true);
  }

  const storagePath = String(data.storagePath ?? "");
  if (!storagePath) return jsonError("Энэ ангийн видео оруулаагүй байна.", 404);

  const muxAssetId = String(data.muxAssetId ?? "");
  let muxPlaybackId = String(data.muxPlaybackId ?? "");
  let muxStatus = String(data.muxStatus ?? "");
  if (!body.fallback && muxConfigured() && muxAssetId && muxStatus !== "ready" && muxStatus !== "errored") {
    try {
      const fresh = await syncAsset(muxAssetId);
      muxPlaybackId = fresh.muxPlaybackId;
      muxStatus = fresh.muxStatus;
      await episodeSnap.ref.set({ muxAssetId: fresh.muxAssetId, muxPlaybackId, muxStatus }, { merge: true });
    } catch (error) {
      console.warn("Mux төлөв уншигдсангүй.", error);
    }
  }

  if (playbackProvider({ fallback: body.fallback, muxPlaybackId, muxStatus }) === "mux") {
    try {
      const token = await playbackToken(muxPlaybackId);
      return finish(body.seriesId, user.uid, ownerId, { provider: "mux", playbackId: muxPlaybackId, token, title: data.title || series.title }, true);
    } catch (error) {
      console.warn("Mux токен үүссэнгүй.", error);
    }
  }

  const url = await readableObjectUrl(storagePath);
  return finish(body.seriesId, user.uid, ownerId, { provider: "firebase", url, title: data.title || series.title }, !body.fallback);
}

function finish(seriesId: string, uid: string, ownerId: string, body: Record<string, unknown>, recordView: boolean) {
  if (recordView) {
    after(() =>
      recordPlaybackView(seriesId, uid, ownerId).catch((error) => {
        console.warn("Үзэлт бүртгэж чадсангүй.", error);
      }),
    );
  }
  return NextResponse.json(body);
}
