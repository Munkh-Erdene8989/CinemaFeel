import { NextRequest, NextResponse } from "next/server";
import { readManageableSeries } from "@/lib/catalog";
import { adminBucket } from "@/lib/firebase-admin";
import { assertAdmin, jsonError } from "@/lib/http";

const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg", "video/mp4", "video/webm", "video/quicktime"]);

export async function POST(request: NextRequest) {
  const session = await assertAdmin(request);
  if (!session) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const body = (await request.json().catch(() => ({}))) as { kind?: string; seriesId?: string; contentType?: string; fileName?: string };
  if (body.seriesId) {
    const loaded = await readManageableSeries(session, body.seriesId);
    if (!loaded.ok) return jsonError(loaded.error, loaded.status);
  }
  const contentType = body.contentType || "application/octet-stream";
  const folders = { poster: "posters", cover: "covers", video: "videos" } as const;
  const kind = body.kind as keyof typeof folders;
  if (!body.seriesId || !folders[kind]) return jsonError("Файл мэдээлэл дутуу.");
  if (!allowed.has(contentType)) return jsonError("Энэ төрлийн файлыг зөвшөөрөхгүй.");
  const safe = (body.fileName || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
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
