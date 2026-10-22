export const SESSION_TTL_SEC = 60 * 60 * 24 * 7;

export function sessionExpired(authTimeSec: number | undefined, now = Date.now()) {
  if (typeof authTimeSec !== "number" || !Number.isFinite(authTimeSec)) return true;
  return now >= (authTimeSec + SESSION_TTL_SEC) * 1000;
}

export function sessionRemainingMs(authTimeSec: number, now = Date.now()) {
  return Math.max(0, (authTimeSec + SESSION_TTL_SEC) * 1000 - now);
}
