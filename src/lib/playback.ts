export function playbackDenial(signedIn: boolean, allowed: boolean) {
  if (!signedIn) return { error: "Үзэхийн тулд нэвтэрнэ үү.", code: "auth" as const, status: 401 as const };
  if (!allowed) return { error: "Энэ киног үзэх эрхгүй байна.", code: "paywall" as const, status: 403 as const };
  return null;
}

export function retrySubscribedPaywall(code: string | undefined, subscribed: boolean, retried: boolean) {
  return code === "paywall" && subscribed && !retried;
}
