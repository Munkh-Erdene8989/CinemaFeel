import { NextRequest, NextResponse } from "next/server";
import { newId } from "@/lib/catalog";
import { adminDb } from "@/lib/firebase-admin";
import { assertAdmin, jsonError } from "@/lib/http";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!assertAdmin(request)) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const { id } = await context.params;
  const series = adminDb().collection("series").doc(id);
  if (!(await series.get()).exists) return jsonError("Кино олдсонгүй.", 404);
  const body = (await request.json().catch(() => ({}))) as { number?: number; title?: string; storagePath?: string; duration?: number };
  if (!body.storagePath) return jsonError("Видео файл оруулна уу.");
  const episodeId = newId();
  const episode = {
    number: Number(body.number ?? 1),
    title: String(body.title || `${body.number}-р анги`),
    storagePath: body.storagePath,
    duration: Number(body.duration ?? 0),
  };
  await series.collection("episodes").doc(episodeId).set(episode);
  const count = (await series.collection("episodes").get()).size;
  await series.set({ episodes: count }, { merge: true });
  return NextResponse.json({ episode: { id: episodeId, ...episode } });
}
