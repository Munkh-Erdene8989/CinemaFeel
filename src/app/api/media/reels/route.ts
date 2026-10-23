import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { jsonError } from "@/lib/http";
import { isMature } from "@/lib/mature";
import { REEL_LIMIT, fileClip, shuffle, type ReelClip } from "@/lib/reels";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snap = await adminDb().collection("series").where("status", "==", "Нийтлэгдсэн").get();
    const clips = shuffle(
      snap.docs
        .filter((doc) => !isMature({ age: doc.data().age, genre: doc.data().genre }))
        .map((doc) => fileClip(doc.id, doc.data()))
        .filter((clip): clip is ReelClip => Boolean(clip)),
    ).slice(0, REEL_LIMIT);
    return NextResponse.json({ clips }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.warn("Reel уншиж чадсангүй.", error);
    return jsonError("Богино бичлэг уншиж чадсангүй.", 500);
  }
}
