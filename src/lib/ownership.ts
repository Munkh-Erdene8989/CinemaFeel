export function listedOwnership(ownedSeriesIds: unknown, seriesId: string): boolean | null {
  if (!Array.isArray(ownedSeriesIds)) return null;
  return ownedSeriesIds.some((item) => String(item) === seriesId);
}

export function collectOwnedSeriesIds(seriesIds: unknown[], extra = "") {
  const ids = new Set<string>();
  for (const value of seriesIds) {
    const id = String(value ?? "");
    if (id) ids.add(id);
  }
  if (extra) ids.add(extra);
  return [...ids];
}
