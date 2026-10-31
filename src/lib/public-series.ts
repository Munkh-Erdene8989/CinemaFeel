import { unstable_cache } from "next/cache";
import { cache } from "react";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import { coverFilm } from "./mature";
import { seriesFromRecord } from "./series-doc";
import type { Series } from "./types";

function toSeries(docs: QueryDocumentSnapshot[]) {
  return docs.map((item) => seriesFromRecord(item.id, item.data()));
}

async function loadSeries(seriesId: string): Promise<Series | null> {
  try {
    const snap = await adminDb().collection("series").doc(seriesId).get();
    if (!snap.exists) return null;
    return seriesFromRecord(snap.id, snap.data() ?? {});
  } catch {
    return null;
  }
}

export const readSeries = cache(async (seriesId: string): Promise<Series | null> => {
  return unstable_cache(() => loadSeries(seriesId), ["public-series", seriesId], { revalidate: 300 })();
});

export const readHomeFeatured = cache(async (): Promise<Series | null> => {
  try {
    const snap = await adminDb().collection("series").where("status", "==", "Нийтлэгдсэн").get();
    const published = toSeries(snap.docs).sort((a, b) => b.createdAt - a.createdAt);
    return coverFilm(published) ?? null;
  } catch {
    return null;
  }
});
