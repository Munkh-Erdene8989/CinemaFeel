import { adminDb } from "../src/lib/firebase-admin.ts";
import { createAssetFromStorage, muxConfigured } from "../src/lib/mux.ts";

if (!muxConfigured()) {
  console.error("MUX_TOKEN_ID, MUX_TOKEN_SECRET, MUX_SIGNING_KEY, MUX_PRIVATE_KEY хэрэгтэй.");
  process.exit(1);
}

const snap = await adminDb().collection("series").where("status", "==", "Нийтлэгдсэн").get();
let queued = 0;
for (const series of snap.docs) {
  const episodes = await series.ref.collection("episodes").get();
  for (const episode of episodes.docs) {
    const data = episode.data();
    const storagePath = String(data.storagePath || "");
    if (!storagePath || data.source === "youtube" || data.muxAssetId) continue;
    const fields = await createAssetFromStorage({
      storagePath,
      subtitlePath: String(data.subtitlePath || "") || undefined,
      passthrough: `episode:${series.id}:${episode.id}`,
    });
    await episode.ref.set(fields, { merge: true });
    queued += 1;
    console.log(`анги ${series.get("title")} #${data.number} ${fields.muxStatus}`);
  }
  const reelPath = String(series.get("reelPreviewPath") || "");
  if (reelPath && !series.get("reelMuxAssetId")) {
    const fields = await createAssetFromStorage({ storagePath: reelPath, passthrough: `reel:${series.id}` });
    await series.ref.set({
      reelMuxAssetId: fields.muxAssetId,
      reelMuxPlaybackId: fields.muxPlaybackId,
      reelMuxStatus: fields.muxStatus,
    }, { merge: true });
    queued += 1;
    console.log(`reel ${series.get("title")} ${fields.muxStatus}`);
  }
}
console.log(`дараалалд ${queued}`);
