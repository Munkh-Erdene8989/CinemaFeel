import { NextRequest, NextResponse } from "next/server";
import { adminBucket, adminDb } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  const seriesId = request.nextUrl.searchParams.get("seriesId") ?? "";
  const episodeId = request.nextUrl.searchParams.get("episodeId") ?? "";
  if (!/^[a-zA-Z0-9]{4,40}$/.test(seriesId) || !/^[a-zA-Z0-9]{4,40}$/.test(episodeId)) {
    return new NextResponse(null, { status: 404 });
  }

  const seriesSnap = await adminDb().collection("series").doc(seriesId).get();
  if (!seriesSnap.exists || seriesSnap.data()?.status !== "Нийтлэгдсэн") return new NextResponse(null, { status: 404 });

  const episode = await seriesSnap.ref.collection("episodes").doc(episodeId).get();
  let subtitlePath = String(episode.data()?.subtitlePath ?? "");
  if (!subtitlePath) {
    const playback = await seriesSnap.ref.collection("playback").doc(episodeId).get();
    subtitlePath = String(playback.data()?.subtitlePath ?? "");
  }
  if (!subtitlePath) return new NextResponse(null, { status: 404 });

  try {
    const [buffer] = await adminBucket().file(subtitlePath).download();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
