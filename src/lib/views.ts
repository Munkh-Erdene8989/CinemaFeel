import { randomInt } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import { SUPER_ADMIN_ID } from "./types";

/** Spread play bursts across this many documents. One document sustains about one write per second. */
export const VIEW_SHARD_COUNT = 32;

export function viewShardId() {
  return String(randomInt(VIEW_SHARD_COUNT));
}

export function sumShards(shards: { views?: unknown; uniqueViews?: unknown }[]) {
  return shards.reduce(
    (sum, shard) => ({
      views: sum.views + Math.max(0, Number(shard.views) || 0),
      uniqueViews: sum.uniqueViews + Math.max(0, Number(shard.uniqueViews) || 0),
    }),
    { views: 0, uniqueViews: 0 },
  );
}

export function isAlreadyExists(error: unknown) {
  const code = (error as { code?: number | string }).code;
  return code === 6 || code === "already-exists" || code === "ALREADY_EXISTS";
}

export function isRetryableWrite(error: unknown) {
  const code = (error as { code?: number | string }).code;
  return code === 4 || code === 8 || code === 10 || code === 14 || code === "aborted" || code === "deadline-exceeded" || code === "unavailable" || code === "resource-exhausted";
}

async function incrementShard(seriesId: string, counts: { views: number; uniqueViews: number }) {
  const db = adminDb();
  let last: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const ref = db.collection("series").doc(seriesId).collection("viewShards").doc(viewShardId());
    try {
      const patch: Record<string, FieldValue> = {};
      if (counts.views) patch.views = FieldValue.increment(counts.views);
      if (counts.uniqueViews) patch.uniqueViews = FieldValue.increment(counts.uniqueViews);
      await ref.set(patch, { merge: true });
      return;
    } catch (error) {
      last = error;
      if (!isRetryableWrite(error)) throw error;
    }
  }
  throw last;
}

export async function recordPlaybackView(seriesId: string, uid: string, ownerId: string) {
  const db = adminDb();
  const viewRef = db.collection("views").doc(`${seriesId}_${uid}`);
  let unique = false;
  try {
    await viewRef.create({
      seriesId,
      uid,
      ownerId: ownerId || SUPER_ADMIN_ID,
      createdAt: Date.now(),
    });
    unique = true;
  } catch (error) {
    if (!isAlreadyExists(error)) throw error;
  }
  await incrementShard(seriesId, { views: 1, uniqueViews: unique ? 1 : 0 });
}

export async function rollupSeriesViews(seriesId: string) {
  const db = adminDb();
  const seriesRef = db.collection("series").doc(seriesId);
  const snap = await seriesRef.get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  if (!data.viewsSharded) {
    await db.runTransaction(async (tx) => {
      const current = await tx.get(seriesRef);
      if (!current.exists || current.data()?.viewsSharded) return;
      tx.set(
        seriesRef.collection("viewShards").doc("base"),
        {
          views: FieldValue.increment(Math.max(0, Number(current.data()?.views ?? 0))),
          uniqueViews: FieldValue.increment(Math.max(0, Number(current.data()?.uniqueViews ?? 0))),
        },
        { merge: true },
      );
      tx.set(seriesRef, { viewsSharded: true }, { merge: true });
    });
  }
  const shards = await seriesRef.collection("viewShards").get();
  const totals = sumShards(shards.docs.map((item) => item.data()));
  if (Number(data.views ?? 0) !== totals.views || Number(data.uniqueViews ?? 0) !== totals.uniqueViews) {
    await seriesRef.set({ views: totals.views, uniqueViews: totals.uniqueViews }, { merge: true });
  }
  return totals;
}

export async function withRolledViews<T extends { id: string; views: number; uniqueViews: number }>(series: T[]) {
  return Promise.all(
    series.map(async (item) => {
      try {
        const totals = await rollupSeriesViews(item.id);
        return totals ? { ...item, views: totals.views, uniqueViews: totals.uniqueViews } : item;
      } catch (error) {
        console.warn("Үзэлтийн тоолуурыг нэгтгэж чадсангүй.", item.id, error);
        return item;
      }
    }),
  );
}
