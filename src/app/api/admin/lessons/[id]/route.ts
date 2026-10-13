import { NextRequest, NextResponse } from "next/server";
import { posterUrl } from "@/lib/catalog";
import { adminBucket } from "@/lib/firebase-admin";
import { lessonError, lessonFields, moveLesson, readManageableLesson, safeLessonPath } from "@/lib/lessons";
import { jsonError, requireSuper } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const { session, error } = await requireSuper(request);
  if (error) return error;
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const loaded = await readManageableLesson(session, id);
  if (!loaded.ok) return jsonError(loaded.error, loaded.status);

  if (body.move === "up" || body.move === "down") {
    await moveLesson(id, body.move);
    return NextResponse.json({ ok: true });
  }

  const current = loaded.snap.data() ?? {};
  const fields = lessonFields({ ...current, ...body });
  const problem = lessonError(fields);
  if (problem) return jsonError(problem);

  let storagePath = String(current.storagePath ?? "");
  if (typeof body.storagePath === "string" && body.storagePath) {
    if (!safeLessonPath(id, body.storagePath, "lessons")) return jsonError("Видео файл буруу байна.");
    if (storagePath && storagePath !== body.storagePath) await adminBucket().file(storagePath).delete({ ignoreNotFound: true });
    storagePath = body.storagePath;
  }

  let cover = String(current.cover ?? "");
  if (typeof body.coverPath === "string" && body.coverPath) {
    if (!safeLessonPath(id, body.coverPath, "lesson-covers")) return jsonError("Ковер файл буруу байна.");
    cover = await posterUrl(body.coverPath);
  }

  await loaded.ref.set({ ...fields, storagePath, cover }, { merge: true });
  return NextResponse.json({ ok: true, cover, hasVideo: Boolean(storagePath) });
}

export async function DELETE(request: NextRequest, context: Context) {
  const { session, error } = await requireSuper(request);
  if (error) return error;
  const { id } = await context.params;
  const loaded = await readManageableLesson(session, id);
  if (!loaded.ok) return jsonError(loaded.error, loaded.status);
  const path = String(loaded.snap.data()?.storagePath ?? "");
  if (path) await adminBucket().file(path).delete({ ignoreNotFound: true });
  const [videos] = await adminBucket().getFiles({ prefix: `lessons/${id}/` });
  const [covers] = await adminBucket().getFiles({ prefix: `lesson-covers/${id}/` });
  await Promise.all([...videos, ...covers].map((file) => file.delete({ ignoreNotFound: true })));
  await loaded.ref.delete();
  return NextResponse.json({ ok: true });
}
