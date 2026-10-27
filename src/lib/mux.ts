import Mux from "@mux/mux-node";
import type { InputSettings } from "@mux/mux-node/resources/video/assets";
import { adminBucket, adminDb } from "./firebase-admin";

export type MuxFields = {
  muxAssetId: string;
  muxPlaybackId: string;
  muxStatus: string;
};

let client: Mux | null = null;

export function muxConfigured() {
  return Boolean(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET && process.env.MUX_SIGNING_KEY && process.env.MUX_PRIVATE_KEY);
}

export function muxClient() {
  if (!muxConfigured()) throw new Error("Mux тохируулаагүй.");
  if (!client) {
    client = new Mux({
      tokenId: process.env.MUX_TOKEN_ID,
      tokenSecret: process.env.MUX_TOKEN_SECRET,
      jwtSigningKey: process.env.MUX_SIGNING_KEY,
      jwtPrivateKey: process.env.MUX_PRIVATE_KEY,
      webhookSecret: process.env.MUX_WEBHOOK_SECRET,
    });
  }
  return client;
}

export async function signedReadUrl(path: string) {
  const [url] = await adminBucket().file(path).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 12 * 60 * 60 * 1000,
  });
  return url;
}

export async function playbackToken(playbackId: string) {
  return muxClient().jwt.signPlaybackId(playbackId, { expiration: "2h", type: "video" });
}

export function readAsset(asset: { id?: string; status?: string; playback_ids?: Array<{ id?: string; policy?: string }> | null }): MuxFields {
  const playback = asset.playback_ids?.find((item) => item.policy === "signed") ?? asset.playback_ids?.[0];
  return {
    muxAssetId: String(asset.id ?? ""),
    muxPlaybackId: String(playback?.id ?? ""),
    muxStatus: String(asset.status ?? "preparing"),
  };
}

export async function createAssetFromStorage(options: { storagePath: string; subtitlePath?: string; passthrough: string }) {
  const inputs: InputSettings[] = [{ url: await signedReadUrl(options.storagePath) }];
  if (options.subtitlePath) {
    inputs.push({
      url: await signedReadUrl(options.subtitlePath),
      type: "text",
      text_type: "subtitles",
      language_code: "mn",
      name: "Монгол",
    });
  }
  const asset = await muxClient().video.assets.create({
    inputs,
    playback_policies: ["signed"],
    video_quality: "basic",
    max_resolution_tier: "1080p",
    passthrough: options.passthrough.slice(0, 255),
  });
  return readAsset(asset);
}

export async function syncAsset(assetId: string) {
  const asset = await muxClient().video.assets.retrieve(assetId);
  return readAsset(asset);
}

export async function deleteAsset(assetId: string) {
  if (!assetId || !muxConfigured()) return;
  await muxClient().video.assets.delete(assetId).catch((error) => console.warn("Mux хөрөнгө устгагдсангүй.", error));
}

export async function applyMuxUpdate(passthrough: string, fields: MuxFields) {
  if (passthrough.startsWith("episode:")) {
    const [, seriesId, episodeId] = passthrough.split(":");
    if (!seriesId || !episodeId) return;
    await adminDb().collection("series").doc(seriesId).collection("episodes").doc(episodeId).set(fields, { merge: true });
    return;
  }
  if (passthrough.startsWith("reel:")) {
    const seriesId = passthrough.slice("reel:".length);
    if (!seriesId) return;
    await adminDb().collection("series").doc(seriesId).set({
      reelMuxAssetId: fields.muxAssetId,
      reelMuxPlaybackId: fields.muxPlaybackId,
      reelMuxStatus: fields.muxStatus,
    }, { merge: true });
  }
}
