type HeaderSource = { headers: { get(name: string): string | null } };

export function cronAuthorized(request: HeaderSource) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  return bearer === secret || request.headers.get("x-cron-secret") === secret;
}

/** Vercel removes the Authorization header before it reaches the function. Its own cron caller is identified by user agent. */
export function rollupAuthorized(request: HeaderSource) {
  return cronAuthorized(request) || request.headers.get("user-agent") === "vercel-cron/1.0";
}
