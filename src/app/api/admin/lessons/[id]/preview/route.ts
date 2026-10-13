import { NextRequest, NextResponse } from "next/server";
import { adminBucket } from "@/lib/firebase-admin";
import { readLesson } from "@/lib/lessons";
import { assertAdmin, jsonError } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  const session = await assertAdmin(request);
  if (!session) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const { id } = await context.params;
  const loaded = await readLesson(id);
  if (!loaded.ok) return jsonError(loaded.error, loaded.status);
  const storagePath = String(loaded.snap.data()?.storagePath ?? "");
  if (!storagePath) return jsonError("Энэ хичээлд видео оруулаагүй байна.", 404);
  const [url] = await adminBucket().file(storagePath).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 2 * 60 * 60 * 1000,
  });
  return NextResponse.json({ url, title: String(loaded.snap.data()?.title ?? "") });
}
