import { NextRequest, NextResponse } from "next/server";
import { posterUrl, readManageableSeries, seriesPayload, uniqueShareCode } from "@/lib/catalog";
import { adminBucket, adminDb } from "@/lib/firebase-admin";
import { assertAdmin, jsonError } from "@/lib/http";

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
    await ref.set({ status: body.status === "Нийтлэгдсэн" ? "Нийтлэгдсэн" : "Ноорог" }, { merge: true });
    return NextResponse.json({ ok: true });
  }

  const payload = seriesPayload({ ...current.data(), ...body }, Number(current.data()?.createdAt ?? Date.now()));
  if (typeof body.posterPath === "string" && body.posterPath) {
    payload.image = await posterUrl(body.posterPath);
  }
  if (typeof body.coverPath === "string" && body.coverPath) {
    payload.cover = await posterUrl(body.coverPath);
  }
  if (!payload.title) return jsonError("Киноны нэр оруулна уу.");
  let shareCode = String(current.data()?.shareCode ?? "");
  if (!shareCode) shareCode = await uniqueShareCode();
  await ref.set({ ...payload, shareCode }, { merge: true });
  return NextResponse.json({ ok: true, image: payload.image, cover: payload.cover, shareCode });
}

export async function DELETE(request: NextRequest, context: Context) {
  const session = await assertAdmin(request);
  if (!session) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const { id } = await context.params;
  const loaded = await readManageableSeries(session, id);
  if (!loaded.ok) return jsonError(loaded.error, loaded.status);
  const { ref } = loaded;
  const episodes = await ref.collection("episodes").get();
  await Promise.all(
    episodes.docs.map(async (episode) => {
      const path = String(episode.data().storagePath ?? "");
      if (path) await adminBucket().file(path).delete({ ignoreNotFound: true });
      await episode.ref.delete();
    }),
  );
  const [posters] = await adminBucket().getFiles({ prefix: `posters/${id}/` });
  await Promise.all(posters.map((file) => file.delete({ ignoreNotFound: true })));
  const [covers] = await adminBucket().getFiles({ prefix: `covers/${id}/` });
  await Promise.all(covers.map((file) => file.delete({ ignoreNotFound: true })));
  const [videos] = await adminBucket().getFiles({ prefix: `videos/${id}/` });
  await Promise.all(videos.map((file) => file.delete({ ignoreNotFound: true })));
  const views = await adminDb().collection("views").where("seriesId", "==", id).get();
  for (let index = 0; index < views.docs.length; index += 400) {
    const batch = adminDb().batch();
    views.docs.slice(index, index + 400).forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }
  await ref.delete();
  return NextResponse.json({ ok: true });
}
