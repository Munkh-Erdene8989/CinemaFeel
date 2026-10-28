export function reorderGenres(current: readonly string[], requested: unknown) {
  if (!Array.isArray(requested) || requested.length !== current.length) return null;
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const item of requested) {
    const name = String(item ?? "").trim().replace(/\s+/g, " ");
    const match = current.find((genre) => genre.trim().toLocaleLowerCase("mn") === name.toLocaleLowerCase("mn"));
    if (!match) return null;
    const key = match.toLocaleLowerCase("mn");
    if (seen.has(key)) return null;
    seen.add(key);
    ordered.push(match);
  }
  return ordered;
}
