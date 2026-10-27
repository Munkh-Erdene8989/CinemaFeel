import { NextResponse } from "next/server";
import type { DocumentData } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { jsonError } from "@/lib/http";
import { isMature } from "@/lib/mature";
import { muxConfigured, playbackToken } from "@/lib/mux";
import { REEL_LIMIT, fileClip, shuffle, type ReelClip } from "@/lib/reels";

async function withMux(clip: ReelClip, data: DocumentData) {
  const playbackId = String(data.reelMuxPlaybackId ?? "");
  if (String(data.reelMuxStatus ?? "") !== "ready" || !playbackId || !muxConfigured()) return clip;
  try {
    return { ...clip, muxPlaybackId: playbackId, muxToken: await playbackToken(playbackId) };
  } catch (error) {
    console.warn("Reel Mux токен үүссэнгүй.", error);
    return clip;
  }
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snap = await adminDb().collection("series").where("status", "==", "Нийтлэгдсэн").get();
    const rows = shuffle(
      snap.docs
        .filter((doc) => !isMature({ age: doc.data().age, genre: doc.data().genre }))
        .flatMap((doc) => {
          const clip = fileClip(doc.id, doc.data());
          return clip ? [{ clip, data: doc.data() }] : [];
        }),
    ).slice(0, REEL_LIMIT);
    const clips = await Promise.all(rows.map(({ clip, data }) => withMux(clip, data)));
    return NextResponse.json({ clips }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.warn("Reel уншиж чадсангүй.", error);
    return jsonError("Богино бичлэг уншиж чадсангүй.", 500);
  }
}
