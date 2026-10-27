export const OFFER_WINDOW_MS = 24 * 60 * 60 * 1000;
export const RENEWAL_OFFER_PERCENT = 20;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type RenewalKind = "d3" | "d1" | "offer";

export type RenewalOffer = {
  code: string;
  uid: string;
  percent: number;
  cycle: string;
  createdAt: number;
  expiresAt: number;
  usedAt: number;
};

export function ubDateKey(ts: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ts);
}

export function shiftDateKey(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, (month || 1) - 1, (day || 1) + days));
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function renewalKind(expiresAt: number, now: number): RenewalKind | null {
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return null;
  const expiry = ubDateKey(expiresAt);
  const today = ubDateKey(now);
  if (expiry === shiftDateKey(today, 3)) return "d3";
  if (expiry === shiftDateKey(today, 1)) return "d1";
  if (expiry === shiftDateKey(today, -3)) return "offer";
  return null;
}

export function renewalRecipient(email: unknown, status: unknown) {
  const value = String(email ?? "").trim().toLowerCase();
  if (!value.includes("@") || /\s/.test(value)) return "";
  if (status === "Түр зогссон") return "";
  return value;
}

/** Quiet means they have not watched since the package ended. */
export function offerStillQuiet(lastWatchAt: number, expiresAt: number) {
  return lastWatchAt < expiresAt;
}

export function renewalOfferCodeFromBytes(bytes: Uint8Array) {
  let code = "R";
  for (let index = 0; index < 10; index += 1) {
    code += ALPHABET[(bytes[index % bytes.length] ?? 0) % ALPHABET.length];
  }
  return code;
}

export function asRenewalOffer(code: string, data: Record<string, unknown> | undefined): RenewalOffer {
  return {
    code,
    uid: String(data?.uid ?? ""),
    percent: Number(data?.percent ?? 0),
    cycle: String(data?.cycle ?? ""),
    createdAt: Number(data?.createdAt ?? 0),
    expiresAt: Number(data?.expiresAt ?? 0),
    usedAt: Number(data?.usedAt ?? 0),
  };
}

export function renewalOfferError(offer: RenewalOffer, input: { uid: string; mode: string; now: number }) {
  if (!input.uid || offer.uid !== input.uid) return "Энэ хөнгөлөлт зөвхөн чамд зориулагдсан.";
  if (offer.usedAt > 0) return "Энэ хөнгөлөлтийг аль хэдийн ашигласан.";
  if (!(offer.expiresAt > input.now)) return "Энэ хөнгөлөлтийн 24 цаг дууссан.";
  if (offer.percent !== RENEWAL_OFFER_PERCENT) return "Хөнгөлөлт олдсонгүй.";
  if (input.mode !== "subscription" && input.mode !== "weekly") return "Энэ хөнгөлөлт багц сунгахад л үйлчилнэ.";
  return "";
}

export function formatOfferDeadline(ts: number) {
  return new Intl.DateTimeFormat("mn-MN", {
    timeZone: "Asia/Ulaanbaatar",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(ts);
}
