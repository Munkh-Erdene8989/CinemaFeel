import { NextRequest, NextResponse } from "next/server";
import { adminBucket } from "@/lib/firebase-admin";
import { assertAdmin, jsonError } from "@/lib/http";

const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg", "video/mp4", "video/webm", "video/quicktime"]);

export async function POST(request: NextRequest) {
  if (!assertAdmin(request)) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const body = (await request.json().catch(() => ({}))) as { kind?: string; seriesId?: string; contentType?: string; fileName?: string };
  const contentType = body.contentType || "application/octet-stream";
  if (!body.seriesId || (body.kind !== "poster" && body.kind !== "video")) return jsonError("Файл мэдээлэл дутуу.");
  if (!allowed.has(contentType)) return jsonError("Энэ төрлийн файлыг зөвшөөрөхгүй.");
  const safe = (body.fileName || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const storagePath = `${body.kind === "poster" ? "posters" : "videos"}/${body.seriesId}/${Date.now()}-${safe}`;
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
