const usernamePattern = /^[a-z0-9._-]{3,32}$/;

export const CORNER_NAME_LIMIT = 2;

export type PublicCreator = {
  id: string;
  name: string;
  username: string;
  contentType: string;
};

export type CornerProfile = {
  username: string;
  cornerName: string;
  edits: number;
};

export function normalizeCornerName(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function validCornerName(value: string) {
  return /^[\p{L}\p{N}][\p{L}\p{N} .'_-]{1,39}$/u.test(value);
}

export function creatorCornerTitle(username: string, cornerName?: unknown) {
  const custom = normalizeCornerName(cornerName);
  return custom || username;
}

export function nextCornerRename(current: CornerProfile, requested: unknown): { cornerName: string; edits: number; changed: boolean } | { error: string } {
  const next = normalizeCornerName(requested);
  if (!validCornerName(next)) return { error: "Кино булангийн нэр 2–40 тэмдэгт, үсэг эсвэл тоогоор эхэлнэ." };
  const shown = creatorCornerTitle(current.username, current.cornerName);
  if (next === shown) return { cornerName: normalizeCornerName(current.cornerName), edits: current.edits, changed: false };
  if (current.edits >= CORNER_NAME_LIMIT) return { error: "Кино булангийн нэрийг 2 удаа сольсон байна." };
  return { cornerName: next === current.username ? "" : next, edits: current.edits + 1, changed: true };
}

export function creatorUsernameParam(value: string) {
  let raw = value;
  try {
    raw = decodeURIComponent(value);
  } catch {
    return "";
  }
  const username = raw.trim().toLowerCase();
  return usernamePattern.test(username) ? username : "";
}

export function creatorUsernameFromPath(pathname: string) {
  const match = pathname.match(/^\/c\/([^/]+)\/?$/);
  if (!match) return "";
  return creatorUsernameParam(match[1]);
}

export function creatorPath(username: string) {
  return `/c/${username}`;
}

export function creatorCatalog<T extends { ownerId?: string }>(series: T[], ownerId: string) {
  if (!ownerId) return [];
  return series.filter((item) => item.ownerId === ownerId);
}
