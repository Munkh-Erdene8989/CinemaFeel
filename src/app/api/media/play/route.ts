import { after, NextRequest, NextResponse } from "next/server";
import { userCanWatch } from "@/lib/access";
import { playbackDenial } from "@/lib/playback";
import { mapSeries } from "@/lib/catalog";
import { adminBucket, adminDb } from "@/lib/firebase-admin";
import { jsonError, readUser } from "@/lib/http";
import { subtitleUrl } from "@/lib/preview";
import { recordPlaybackView } from "@/lib/views";

export async function POST(request: NextRequest) {
  const user = await readUser(request);
  if (!user?.uid) {
    const denial = playbackDenial(false, false)!;
    return NextResponse.json({ error: denial.error, code: denial.code }, { status: denial.status });
  }
  const body = (await request.json().catch(() => ({}))) as { seriesId?: string; episodeId?: string };
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
      youtubeId,
      startAt: Number(data.startAt ?? 0),
      subtitleOffsetMs: Number(data.subtitleOffsetMs ?? 0),
      subtitleUrl: subtitlePath ? subtitleUrl(body.seriesId, episodeSnap.id) : "",
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
  return finish(body.seriesId, user.uid, ownerId, { url, title: episodeSnap.data()?.title || series.title });
}

function finish(seriesId: string, uid: string, ownerId: string, body: Record<string, unknown>) {
  after(() =>
    recordPlaybackView(seriesId, uid, ownerId).catch((error) => {
      console.warn("Үзэлт бүртгэж чадсангүй.", error);
    }),
  );
  return NextResponse.json(body);
}
