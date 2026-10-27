import { checkoutListAmount, viewerCheckoutMode } from "./entitlement";
import { adminDb } from "./firebase-admin";
import { asRenewalOffer, renewalOfferError } from "./renewal-mail";
import type { CheckoutMode, Discount } from "./types";

export function normalizeDiscountCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function validDiscountCode(code: string) {
  return /^[A-Z0-9]{3,20}$/.test(code);
}

export function validDiscountPercent(value: unknown) {
  const percent = Number(value);
  return Number.isInteger(percent) && percent >= 1 && percent <= 99;
}

export function discountedAmount(amount: number, percent: number) {
  return Math.max(1, Math.round((amount * (100 - percent)) / 100));
}

export function asDiscount(code: string, data: Record<string, unknown> | undefined): Discount {
  return {
    code,
    percent: Number(data?.percent ?? 0),
    active: data?.active !== false,
    usedCount: Number(data?.usedCount ?? 0),
    createdAt: Number(data?.createdAt ?? 0),
  };
}

export async function loadDiscount(code: string) {
  const normalized = normalizeDiscountCode(code);
  if (!validDiscountCode(normalized)) return null;
  const snap = await adminDb().collection("discounts").doc(normalized).get();
  if (!snap.exists) return null;
  return asDiscount(normalized, snap.data() as Record<string, unknown> | undefined);
}

type QuoteInput = {
  mode?: string;
  seriesId?: string | null;
  code?: string;
  monthlyPrice: number;
  uid?: string;
};

async function loadRenewalOffer(code: string) {
  const snap = await adminDb().collection("renewalOffers").doc(code).get();
  if (!snap.exists) return null;
  return asRenewalOffer(code, snap.data() as Record<string, unknown> | undefined);
}

export async function viewerCheckoutQuote(input: QuoteInput): Promise<
  | {
      ok: true;
      mode: CheckoutMode;
      amount: number;
      originalAmount: number;
      product: string;
      seriesId: string | null;
      discountCode: string;
      discountPercent: number;
    }
  | { ok: false; error: string; status: number }
> {
  const mode = viewerCheckoutMode(input.mode);
  let originalAmount = checkoutListAmount(mode, { monthlyPrice: input.monthlyPrice });
  let product = mode === "weekly" ? "CinemaFeel 7 хоног" : "CinemaFeel Plus";
  let seriesId: string | null = null;

  if (mode === "single") {
    if (!input.seriesId) return { ok: false, error: "Кино сонгоно уу.", status: 400 };
    const series = await adminDb().collection("series").doc(input.seriesId).get();
    if (!series.exists || series.data()?.status !== "Нийтлэгдсэн") return { ok: false, error: "Кино олдсонгүй.", status: 404 };
    originalAmount = checkoutListAmount("single", { monthlyPrice: input.monthlyPrice, singlePrice: Number(series.data()?.price ?? 0) });
    if (originalAmount <= 0) return { ok: false, error: "Энэ кино үнэгүй.", status: 400 };
    product = String(series.data()?.title ?? "Кино");
    seriesId = input.seriesId;
  }

  const rawCode = input.code?.trim() ?? "";
  if (!rawCode) {
    return { ok: true, mode, amount: originalAmount, originalAmount, product, seriesId, discountCode: "", discountPercent: 0 };
  }

  const discount = await loadDiscount(rawCode);
  if (!discount?.active || !validDiscountPercent(discount.percent)) {
    const offerCode = normalizeDiscountCode(rawCode);
    const offer = offerCode ? await loadRenewalOffer(offerCode) : null;
    if (!offer) return { ok: false, error: "Хөнгөлөлтийн код олдсонгүй эсвэл идэвхгүй байна.", status: 400 };
    const reason = renewalOfferError(offer, { uid: input.uid ?? "", mode, now: Date.now() });
    if (reason) return { ok: false, error: reason, status: 400 };
    return {
      ok: true,
      mode,
      amount: discountedAmount(originalAmount, offer.percent),
      originalAmount,
      product,
      seriesId,
      discountCode: offer.code,
      discountPercent: offer.percent,
    };
  }

  return {
    ok: true,
    mode,
    amount: discountedAmount(originalAmount, discount.percent),
    originalAmount,
    product,
    seriesId,
    discountCode: discount.code,
    discountPercent: discount.percent,
  };
}
