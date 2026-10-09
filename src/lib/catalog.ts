import { randomBytes, randomUUID } from "crypto";
import type { DocumentData } from "firebase-admin/firestore";
import { adminBucket, adminDb } from "./firebase-admin";
import type { Episode, Series, SeriesWithEpisodes } from "./types";

export function newId() {
  return randomBytes(6).toString("hex");
}

export function mapSeries(id: string, data: DocumentData): Series {
  return {
    id,
    title: String(data.title ?? ""),
    genre: String(data.genre ?? "Драма"),
    description: String(data.description ?? ""),
    episodes: Number(data.episodes ?? 0),
    price: Number(data.price ?? 0),
    access: Number(data.price ?? 0) === 0 || data.access === "free" ? "free" : "paid",
    image: String(data.image ?? ""),
    views: Number(data.views ?? 0),
    status: data.status === "Нийтлэгдсэн" ? "Нийтлэгдсэн" : "Ноорог",
    featured: Boolean(data.featured),
    year: Number(data.year ?? new Date().getFullYear()),
    age: String(data.age ?? "13+"),
    createdAt: Number(data.createdAt ?? Date.now()),
  };
}

export function seriesPayload(body: Record<string, unknown>, createdAt = Date.now()) {
  const price = Number(body.price ?? 0);
  return {
    title: String(body.title ?? "").trim(),
    genre: String(body.genre ?? "Драма"),
    description: String(body.description ?? ""),
    episodes: Math.max(1, Number(body.episodes ?? 1)),
    price,
    access: price === 0 ? "free" : "paid",
    image: String(body.image ?? ""),
    views: Number(body.views ?? 0),
    status: body.status === "Нийтлэгдсэн" ? "Нийтлэгдсэн" : "Ноорог",
    featured: Boolean(body.featured),
    year: Number(body.year ?? new Date().getFullYear()),
    age: String(body.age ?? "13+"),
    createdAt,
  };
}

export async function listSeries(): Promise<SeriesWithEpisodes[]> {
  const snap = await adminDb().collection("series").get();
  const series = await Promise.all(
    snap.docs.map(async (item) => {
      const episodes = await item.ref.collection("episodes").get();
      const episodeList: Episode[] = episodes.docs
        .map((episode) => ({ id: episode.id, ...(episode.data() as Omit<Episode, "id">) }))
        .sort((a, b) => a.number - b.number);
      return { ...mapSeries(item.id, item.data()), episodeList };
    }),
  );
  return series.sort((a, b) => b.createdAt - a.createdAt);
}

export async function posterUrl(storagePath: string) {
  const token = randomUUID();
  const file = adminBucket().file(storagePath);
  await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
  const bucket = adminBucket().name;
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}
