import { randomInt } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import { periodView, viewDayKey, type PeriodView } from "./period-views";
import { SUPER_ADMIN_ID } from "./types";

/** Spread play bursts across this many documents. One document sustains about one write per second. */
export const VIEW_SHARD_COUNT = 32;

export function viewShardId() {
  return String(randomInt(VIEW_SHARD_COUNT));
}

export function sumShards(shards: { views?: unknown; uniqueViews?: unknown }[]) {
  return shards.reduce<{ views: number; uniqueViews: number }>(
    (sum, shard) => ({
      views: sum.views + Math.max(0, Number(shard.views) || 0),
      uniqueViews: sum.uniqueViews + Math.max(0, Number(shard.uniqueViews) || 0),
    }),
    { views: 0, uniqueViews: 0 },
  );
}

/** Stored series fields lag the shard counters until a rollup runs. */
export function liveViewCounts(
  stored: { views?: unknown; uniqueViews?: unknown; viewsSharded?: unknown },
  shards: { id?: string; views?: unknown; uniqueViews?: unknown }[],
) {
  const summed = sumShards(shards);
  const views = Math.max(0, Number(stored.views) || 0);
  const uniqueViews = Math.max(0, Number(stored.uniqueViews) || 0);
  if (shards.length === 0) return { views, uniqueViews };
  const migrated = stored.viewsSharded === true || shards.some((shard) => shard.id === "base");
  if (migrated) return summed;
  return { views: summed.views + views, uniqueViews: summed.uniqueViews + uniqueViews };
}

export async function shardTotalsBySeries() {
  const snap = await adminDb().collectionGroup("viewShards").select("views", "uniqueViews").get();
  const bySeries = new Map<string, { id: string; views?: unknown; uniqueViews?: unknown }[]>();
  for (const item of snap.docs) {
    const seriesId = item.ref.parent.parent?.id;
    if (!seriesId) continue;
    const shards = bySeries.get(seriesId) ?? [];
    shards.push({ id: item.id, views: item.get("views"), uniqueViews: item.get("uniqueViews") });
    bySeries.set(seriesId, shards);
  }
  return bySeries;
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
  const now = Date.now();
  const viewRef = db.collection("views").doc(`${seriesId}_${uid}`);
  const dayRef = db.collection("viewDays").doc(`${seriesId}_${uid}_${viewDayKey(now)}`);
  let unique = false;
  try {
    await viewRef.create({
      seriesId,
      uid,
      ownerId: ownerId || SUPER_ADMIN_ID,
      createdAt: now,
    });
    unique = true;
  } catch (error) {
    if (!isAlreadyExists(error)) throw error;
  }
  try {
    await dayRef.create({ seriesId, uid, day: viewDayKey(now), createdAt: now });
  } catch (error) {
    if (!isAlreadyExists(error)) throw error;
  }
  await incrementShard(seriesId, { views: 1, uniqueViews: unique ? 1 : 0 });
}

export async function loadPeriodViews(since: number): Promise<PeriodView[]> {
  const [first, days] = await Promise.all([
    adminDb().collection("views").where("createdAt", ">=", since).select("seriesId", "uid", "createdAt").get(),
    adminDb().collection("viewDays").where("createdAt", ">=", since).select("seriesId", "uid", "createdAt").get(),
  ]);
  return [...first.docs, ...days.docs].flatMap((item) => {
    const view = periodView(item.data());
    return view ? [view] : [];
  });
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

export async function rollupAllSeriesViews() {
  const snap = await adminDb().collection("series").get();
  const ids = snap.docs.map((item) => item.id);
  let rolled = 0;
  let failed = 0;
  const queue = [...ids];
  async function worker() {
    for (;;) {
      const id = queue.shift();
      if (!id) return;
      try {
        const totals = await rollupSeriesViews(id);
        if (totals) rolled += 1;
      } catch (error) {
        failed += 1;
        console.warn("Үзэлтийн тоолуурыг нэгтгэж чадсангүй.", id, error);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, ids.length) }, () => worker()));
  return { series: ids.length, rolled, failed };
}
