export const SESSION_TTL_SEC = 60 * 60 * 24 * 90;
const SESSION_CHECK_MAX_MS = 2_147_483_647;

export function sessionExpired(authTimeSec: number | undefined, now = Date.now()) {
  if (typeof authTimeSec !== "number" || !Number.isFinite(authTimeSec)) return true;
  return now >= (authTimeSec + SESSION_TTL_SEC) * 1000;
}

export function sessionRemainingMs(authTimeSec: number, now = Date.now()) {
  return Math.max(0, (authTimeSec + SESSION_TTL_SEC) * 1000 - now);
}

export function sessionCheckDelayMs(authTimeSec: number, now = Date.now()) {
  return Math.min(sessionRemainingMs(authTimeSec, now), SESSION_CHECK_MAX_MS);
}
