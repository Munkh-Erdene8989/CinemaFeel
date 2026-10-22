import { NextRequest, NextResponse } from "next/server";
import { readManageableSeries } from "@/lib/catalog";
import { adminBucket } from "@/lib/firebase-admin";
import { readManageableLesson } from "@/lib/lessons";
import { assertAdmin, jsonError } from "@/lib/http";

const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg", "video/mp4", "video/webm", "video/quicktime"]);

export async function POST(request: NextRequest) {
  const session = await assertAdmin(request);
  if (!session) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const body = (await request.json().catch(() => ({}))) as { kind?: string; seriesId?: string; lessonId?: string; contentType?: string; fileName?: string };
  const contentType = body.contentType || "application/octet-stream";
  if (!allowed.has(contentType)) return jsonError("Энэ төрлийн файлыг зөвшөөрөхгүй.");
  const safe = (body.fileName || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);

  if (body.lessonId) {
    if (session.role !== "super") return jsonError("Зөвхөн super admin хичээл нэмнэ.", 403);
    const loaded = await readManageableLesson(session, body.lessonId);
    if (!loaded.ok) return jsonError(loaded.error, loaded.status);
    const folders = { poster: "lesson-covers", video: "lessons" } as const;
    const kind = body.kind as keyof typeof folders;
    if (!folders[kind]) return jsonError("Файл мэдээлэл дутуу.");
    if (kind === "video" && !contentType.startsWith("video/")) return jsonError("Видео файл оруулна уу.");
    if (kind === "poster" && !contentType.startsWith("image/")) return jsonError("Зураг файл оруулна уу.");
    const storagePath = `${folders[kind]}/${body.lessonId}/${Date.now()}-${safe}`;
    try {
      const [uploadUrl] = await adminBucket().file(storagePath).getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + 15 * 60 * 1000,
        contentType,
      });
      return NextResponse.json({ uploadUrl, storagePath });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Storage холбогдсонгүй.";
      return jsonError(`Firebase Storage бэлэн биш байна. ${message}`, 503);
    }
  }

  if (body.seriesId) {
    const loaded = await readManageableSeries(session, body.seriesId);
    if (!loaded.ok) return jsonError(loaded.error, loaded.status);
  }
  const folders = { poster: "posters", cover: "covers", video: "videos", reel: "reels" } as const;
  const kind = body.kind as keyof typeof folders;
  if (!body.seriesId || !folders[kind]) return jsonError("Файл мэдээлэл дутуу.");
  if ((kind === "video" || kind === "reel") && !contentType.startsWith("video/")) return jsonError("Видео файл оруулна уу.");
  const storagePath = `${folders[kind]}/${body.seriesId}/${Date.now()}-${safe}`;
  try {
    const [uploadUrl] = await adminBucket().file(storagePath).getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000,
      contentType,
    });
    return NextResponse.json({ uploadUrl, storagePath });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Storage холбогдсонгүй.";
    return jsonError(`Firebase Storage бэлэн биш байна. ${message}`, 503);
  }
}
