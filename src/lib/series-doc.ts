import { isMature, normalizeAge } from "./mature";
import type { Access, Series, SeriesStatus } from "./types";

export type SeriesRecord = Record<string, unknown>;

export function seriesAccess(price: number, access?: unknown): Access {
  return price === 0 || access === "free" ? "free" : "paid";
}

export function seriesStatus(status: unknown): SeriesStatus {
  return status === "Нийтлэгдсэн" ? "Нийтлэгдсэн" : "Ноорог";
}

export function seriesFromRecord(id: string, data: SeriesRecord, now = Date.now()): Series {
  const price = Number(data.price ?? 0);
  return {
    id,
    title: String(data.title ?? ""),
    genre: String(data.genre ?? "Драма"),
    description: String(data.description ?? ""),
    episodes: Number(data.episodes ?? 0),
    price,
    access: seriesAccess(price, data.access),
    image: String(data.image ?? ""),
    cover: String(data.cover ?? ""),
    shareCode: String(data.shareCode ?? ""),
    views: Number(data.views ?? 0),
    uniqueViews: Number(data.uniqueViews ?? 0),
    ownerId: String(data.ownerId ?? ""),
    ownerName: String(data.ownerName ?? ""),
    status: seriesStatus(data.status),
    featured: Boolean(data.featured),
    year: Number(data.year ?? new Date(now).getFullYear()),
    age: normalizeAge(data.age),
    createdAt: Number(data.createdAt ?? now),
  };
}

export function seriesWritePayload(body: SeriesRecord, createdAt = Date.now()) {
  const price = Number(body.price ?? 0);
  const genre = String(body.genre ?? "Драма");
  const age = normalizeAge(body.age);
  const mature = isMature({ age, genre });
  return {
    title: String(body.title ?? "").trim(),
    genre,
    description: String(body.description ?? ""),
    episodes: Math.max(1, Number(body.episodes ?? 1)),
    price,
    access: seriesAccess(price),
    image: String(body.image ?? ""),
    cover: mature ? "" : String(body.cover ?? ""),
    status: seriesStatus(body.status),
    featured: mature ? false : Boolean(body.featured),
    year: Number(body.year ?? new Date().getFullYear()),
    age,
    createdAt,
  };
}
