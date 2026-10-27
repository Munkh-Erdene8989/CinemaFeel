import type { Series } from "./types";

const UB_OFFSET_MS = 8 * 60 * 60 * 1000;

export type PeriodView = {
  seriesId: string;
  uid: string;
  createdAt: number;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** Ulaanbaatar calendar day. Salary halves change at local midnight, so the key must too. */
export function viewDayKey(ms: number) {
  const shifted = new Date(ms + UB_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

export function periodView(data: { seriesId?: unknown; uid?: unknown; createdAt?: unknown }): PeriodView | null {
  const seriesId = String(data.seriesId ?? "");
  const uid = String(data.uid ?? "");
  const createdAt = Number(data.createdAt) || 0;
  if (!seriesId || !uid || createdAt <= 0) return null;
  return { seriesId, uid, createdAt };
}

/** One viewer counts once per series inside [start, end), however many days they watched. */
export function countUniqueViews(events: PeriodView[], start: number, end: number) {
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  for (const event of events) {
    if (event.createdAt < start || event.createdAt >= end) continue;
    const key = `${event.seriesId}\0${event.uid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    counts.set(event.seriesId, (counts.get(event.seriesId) ?? 0) + 1);
  }
  return counts;
}

export function seriesInPeriod<T extends Pick<Series, "id">>(series: T[], events: PeriodView[], start: number, end: number): T[] {
  const counts = countUniqueViews(events, start, end);
  return series.map((item) => ({ ...item, uniqueViews: counts.get(item.id) ?? 0 }));
}
