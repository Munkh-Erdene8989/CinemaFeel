import { NextRequest, NextResponse } from "next/server";
import { publishNotice } from "@/lib/publish-notice";
import { seriesStatus } from "@/lib/series-doc";
import { deleteEpisodeMedia, deleteShareCode, posterUrl, readManageableSeries, seriesPayload, uniqueShareCode, writeShareCode } from "@/lib/catalog";
import { adminBucket, adminDb } from "@/lib/firebase-admin";
import { canonicalGenre, loadGenres, sameGenre } from "@/lib/genres";
import { isMature } from "@/lib/mature";
import { assertAdmin, jsonError, siteOrigin } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const session = await assertAdmin(request);
  if (!session) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const loaded = await readManageableSeries(session, id);
  if (!loaded.ok) return jsonError(loaded.error, loaded.status);
  const { ref } = loaded;
  const current = loaded.snap;

  if (typeof body.status === "string" && Object.keys(body).length === 1) {
    const nextStatus = seriesStatus(body.status);
    await ref.set({ status: nextStatus }, { merge: true });
    await writeShareCode(String(current.data()?.shareCode ?? ""), id, nextStatus);
    const notice = await publishNotice(id, siteOrigin(request), body.status);
    return NextResponse.json({ ok: true, ...notice });
  }

  const payload = seriesPayload({ ...current.data(), ...body }, Number(current.data()?.createdAt ?? Date.now()));
  const previous = String(current.data()?.genre ?? "");
  const genre = canonicalGenre(payload.genre, await loadGenres());
  if (!genre && !sameGenre(payload.genre, previous)) return jsonError("Энэ төрөл бүртгэлгүй. Эхлээд төрөл нэмнэ үү.");
  payload.genre = genre || previous;
  if (typeof body.posterPath === "string" && body.posterPath) {
    payload.image = await posterUrl(body.posterPath);
  }
  if (typeof body.coverPath === "string" && body.coverPath && !isMature(payload)) {
    payload.cover = await posterUrl(body.coverPath);
  }
  if (isMature(payload)) {
    payload.featured = false;
    payload.cover = "";
  }
  if (!payload.title) return jsonError("Киноны нэр оруулна уу.");
  let shareCode = String(current.data()?.shareCode ?? "");
  if (!shareCode) shareCode = await uniqueShareCode();
  await ref.set({ ...payload, shareCode }, { merge: true });
  await writeShareCode(shareCode, id, payload.status);
  const notice = await publishNotice(id, siteOrigin(request), payload.status);
  return NextResponse.json({ ok: true, image: payload.image, cover: payload.cover, shareCode, ...notice });
}

export async function DELETE(request: NextRequest, context: Context) {
  const session = await assertAdmin(request);
  if (!session) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const { id } = await context.params;
  const loaded = await readManageableSeries(session, id);
  if (!loaded.ok) return jsonError(loaded.error, loaded.status);
  const { ref } = loaded;
  const shareCode = String(loaded.snap.data()?.shareCode ?? "");
  const episodes = await ref.collection("episodes").get();
  await Promise.all(
    episodes.docs.map(async (episode) => {
      await deleteEpisodeMedia(ref, episode.id, episode.data());
      await episode.ref.delete();
    }),
  );
  const playback = await ref.collection("playback").get();
  await Promise.all(playback.docs.map((item) => item.ref.delete()));
  const [posters] = await adminBucket().getFiles({ prefix: `posters/${id}/` });
  await Promise.all(posters.map((file) => file.delete({ ignoreNotFound: true })));
  const [covers] = await adminBucket().getFiles({ prefix: `covers/${id}/` });
  await Promise.all(covers.map((file) => file.delete({ ignoreNotFound: true })));
  const [videos] = await adminBucket().getFiles({ prefix: `videos/${id}/` });
  await Promise.all(videos.map((file) => file.delete({ ignoreNotFound: true })));
  const [subtitles] = await adminBucket().getFiles({ prefix: `subtitles/${id}/` });
  await Promise.all(subtitles.map((file) => file.delete({ ignoreNotFound: true })));
  const shards = await ref.collection("viewShards").get();
  if (!shards.empty) {
    const shardBatch = adminDb().batch();
    shards.docs.forEach((item) => shardBatch.delete(item.ref));
    await shardBatch.commit();
  }
  const views = await adminDb().collection("views").where("seriesId", "==", id).get();
  for (let index = 0; index < views.docs.length; index += 400) {
    const batch = adminDb().batch();
    views.docs.slice(index, index + 400).forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }
  await deleteShareCode(shareCode);
  await ref.delete();
  return NextResponse.json({ ok: true });
}
