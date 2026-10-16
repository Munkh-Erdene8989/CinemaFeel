import { randomBytes, randomUUID } from "crypto";
import type { DocumentData, DocumentReference } from "firebase-admin/firestore";
import { adminBucket, adminDb } from "./firebase-admin";
import { seriesFromRecord, seriesWritePayload } from "./series-doc";
import type { AdminSession, Episode, SeriesWithEpisodes } from "./types";

const shareAlphabet = "abcdefghjkmnpqrstuvwxyz23456789";

export function newId() {
  return randomBytes(6).toString("hex");
}

function randomShareCode(length: number) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => shareAlphabet[byte % shareAlphabet.length]).join("");
}

export async function uniqueShareCode(reserved = new Set<string>()) {
  for (let length = 4; length <= 5; length += 1) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const code = randomShareCode(length);
      if (reserved.has(code)) continue;
      const existing = await adminDb().collection("series").where("shareCode", "==", code).limit(1).get();
      if (existing.empty) return code;
    }
  }
  return randomShareCode(6);
}

export function mapSeries(id: string, data: DocumentData) {
  return seriesFromRecord(id, data);
}

export function seriesPayload(body: Record<string, unknown>, createdAt = Date.now()) {
  return seriesWritePayload(body, createdAt);
}

export async function listSeries(): Promise<SeriesWithEpisodes[]> {
  const snap = await adminDb().collection("series").get();
  const shareCodes = new Map<string, string>();
  const reserved = new Set<string>();
  for (const item of snap.docs) {
    const code = String(item.data().shareCode ?? "");
    if (!code) continue;
    reserved.add(code);
    shareCodes.set(item.id, code);
  }
  for (const item of snap.docs) {
    if (shareCodes.has(item.id)) continue;
    const shareCode = await uniqueShareCode(reserved);
    reserved.add(shareCode);
    shareCodes.set(item.id, shareCode);
    await item.ref.set({ shareCode }, { merge: true });
  }
  const series = await Promise.all(
    snap.docs.map(async (item) => {
      const episodes = await item.ref.collection("episodes").get();
      const episodeList: Episode[] = episodes.docs
        .map((episode) => ({ id: episode.id, ...(episode.data() as Omit<Episode, "id">) }))
        .sort((a, b) => a.number - b.number);
      return { ...mapSeries(item.id, { ...item.data(), shareCode: shareCodes.get(item.id) ?? "" }), episodeList };
    }),
  );
  return series.sort((a, b) => b.createdAt - a.createdAt);
}

export async function readManageableSeries(session: AdminSession, id: string) {
  const ref = adminDb().collection("series").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false as const, error: "Кино олдсонгүй.", status: 404 as const };
  if (session.role !== "super" && snap.data()?.ownerId !== session.adminId) {
    return { ok: false as const, error: "Энэ контентыг засах эрхгүй.", status: 403 as const };
  }
  return { ok: true as const, ref, snap };
}

export async function posterUrl(storagePath: string) {
  const token = randomUUID();
  const file = adminBucket().file(storagePath);
  await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
  const bucket = adminBucket().name;
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

export async function deleteEpisodeMedia(seriesRef: DocumentReference, episodeId: string, data: DocumentData) {
  const playbackRef = seriesRef.collection("playback").doc(episodeId);
  const playback = await playbackRef.get();
  const paths = [String(data.storagePath ?? ""), String(playback.data()?.subtitlePath ?? "")].filter(Boolean);
  await Promise.all(paths.map((filePath) => adminBucket().file(filePath).delete({ ignoreNotFound: true })));
  if (playback.exists) await playbackRef.delete();
}
