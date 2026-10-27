"use client";

import { useEffect, useState } from "react";
import { checkoutListAmount, SUBSCRIPTION_DAYS } from "@/lib/entitlement";
import { WEEKLY_DAYS, WEEKLY_PRICE, type CheckoutMode, type QPayUrl, type Series } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { Icon, Modal } from "./icons";
import { StepMotion } from "./motion";
import { clientAuth } from "@/lib/firebase";

export function CheckoutModal({
  mode,
  film,
  monthlyPrice,
  initialCode = "",
  onClose,
  onPaid,
  onModeChange,
}: {
  mode: CheckoutMode;
  film: Series | null;
  monthlyPrice: number;
  initialCode?: string;
  onClose: () => void;
  onPaid: () => void;
  onModeChange?: (mode: CheckoutMode) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ code: string; percent: number; originalAmount: number; amount: number } | null>(null);
  const [invoice, setInvoice] = useState<{ senderInvoiceNo: string; qrImage: string; urls: QPayUrl[] } | null>(null);
  const weekly = mode === "weekly";
  const listPrice = checkoutListAmount(mode, { monthlyPrice, singlePrice: film?.price ?? 0 });
  const total = applied?.amount ?? listPrice;
  const title = mode === "single" ? film?.title : weekly ? "CinemaFeel 7 хоногийн эрх" : "CinemaFeel сарын эрх";
  const label = mode === "single" ? "Киноны эрх" : weekly ? `${WEEKLY_DAYS} хоногийн эрх` : `${SUBSCRIPTION_DAYS} хоногийн эрх`;

  useEffect(() => {
    setInvoice(null);
    setError("");
    setApplied(null);
    setCode(initialCode);
  }, [mode, film?.id, initialCode]);

  useEffect(() => {
    if (!initialCode) return;
    let cancel = false;
    const apply = async () => {
      const token = await clientAuth().currentUser?.getIdToken();
      if (!token || cancel) return;
      const response = await fetch("/api/discount/preview", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ mode, seriesId: film?.id ?? null, code: initialCode }),
      });
      const data = (await response.json()) as { error?: string; code?: string; percent?: number; originalAmount?: number; amount?: number };
      if (cancel) return;
      if (!response.ok || !data.code || data.amount == null || data.originalAmount == null || data.percent == null) {
        setApplied(null);
        setError(data.error || "Хөнгөлөлтийн код олдсонгүй.");
        return;
      }
      setError("");
      setApplied({ code: data.code, percent: data.percent, originalAmount: data.originalAmount, amount: data.amount });
    };
    void apply();
    return () => {
      cancel = true;
    };
  }, [initialCode, mode, film?.id]);

  const createInvoice = async () => {
    setLoading(true);
    setError("");
    const token = await clientAuth().currentUser?.getIdToken();
    if (!token) {
      setLoading(false);
      setError("Эхлээд нэвтэрнэ үү.");
      return;
    }
    const response = await fetch("/api/qpay/invoice", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ mode, seriesId: film?.id ?? null, code: applied?.code || code }),
    });
    const data = (await response.json()) as { error?: string; senderInvoiceNo?: string; qrImage?: string; urls?: QPayUrl[]; amount?: number; originalAmount?: number; discountCode?: string; discountPercent?: number };
    setLoading(false);
    if (!response.ok || !data.senderInvoiceNo) {
      setError(data.error || "Нэхэмжлэх үүсгэж чадсангүй.");
      return;
    }
    if (data.discountCode && data.amount != null && data.originalAmount != null && data.discountPercent != null) {
      setApplied({ code: data.discountCode, percent: data.discountPercent, originalAmount: data.originalAmount, amount: data.amount });
    }
    setInvoice({ senderInvoiceNo: data.senderInvoiceNo, qrImage: data.qrImage || "", urls: data.urls || [] });
  };

  const check = async () => {
    if (!invoice) return;
    setLoading(true);
    setError("");
    const token = await clientAuth().currentUser?.getIdToken();
    const response = await fetch("/api/qpay/check", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ senderInvoiceNo: invoice.senderInvoiceNo }),
    });
    const data = (await response.json()) as { error?: string; paid?: boolean };
    setLoading(false);
    if (!response.ok) {
      setError(data.error || "Төлбөр шалгаж чадсангүй.");
      return;
    }
    if (!data.paid) {
      setError("Төлбөр хараахан баталгаажаагүй байна. Төлсний дараа дахин шалгана уу.");
      return;
    }
    onPaid();
  };

  const applyCode = async () => {
    if (!code.trim()) {
      setError("Хөнгөлөлтийн код оруулна уу.");
      return;
    }
    setLoading(true);
    setError("");
    const token = await clientAuth().currentUser?.getIdToken();
    if (!token) {
      setLoading(false);
      setError("Эхлээд нэвтэрнэ үү.");
      return;
    }
    const response = await fetch("/api/discount/preview", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ mode, seriesId: film?.id ?? null, code }),
    });
    const data = (await response.json()) as { error?: string; code?: string; percent?: number; originalAmount?: number; amount?: number };
    setLoading(false);
    if (!response.ok || !data.code || data.amount == null || data.originalAmount == null || data.percent == null) {
      setApplied(null);
      setError(data.error || "Хөнгөлөлтийн код олдсонгүй.");
      return;
    }
    setApplied({ code: data.code, percent: data.percent, originalAmount: data.originalAmount, amount: data.amount });
  };

  return (
    <Modal onClose={onClose}>
      <StepMotion stepKey={invoice ? `pay-${mode}` : mode} className="p-7 sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff536a]">Төлбөр баталгаажуулах</p>
        <h2 className="mt-2 text-2xl font-black">{title}</h2>
        {mode !== "single" && onModeChange && !invoice && (
          <div className="mt-6 grid gap-3">
            <button onClick={() => onModeChange("subscription")} className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm ${mode === "subscription" ? "border-white/30 bg-white/[0.06] text-white" : "border-white/10 text-zinc-300"}`}>
              <span>Сарын эрх · 30 хоног</span>
              <span className="font-black">{formatMoney(monthlyPrice)}</span>
            </button>
            <button onClick={() => onModeChange("weekly")} className={`offer-glow flex items-center justify-between rounded-2xl border px-4 py-4 text-left ${weekly ? "border-[#ff8a9a]/60 bg-[#ff3d56]/15" : "border-white/10 bg-white/[0.03]"}`}>
              <span>
                <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-[#ff8a9a]">Онцлох · 7 хоног</span>
                <span className="mt-1 block text-sm font-bold text-white">Бүх киног үзэх</span>
              </span>
              <span className="text-2xl font-black">{formatMoney(WEEKLY_PRICE)}</span>
            </button>
          </div>
        )}
        {mode === "single" && onModeChange && !invoice && (
          <button onClick={() => onModeChange("weekly")} className="offer-glow mt-6 flex w-full items-center justify-between rounded-2xl border border-[#ff8a9a]/50 bg-[#ff3d56]/15 px-4 py-4 text-left">
            <span>
              <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-[#ff8a9a]">Шинэ · 7 хоног</span>
              <span className="mt-1 block text-sm font-bold">Бүх киног {formatMoney(WEEKLY_PRICE)}-өөр үзэх</span>
            </span>
            <span className="text-xl font-black">{formatMoney(WEEKLY_PRICE)}</span>
          </button>
        )}
        {!invoice && (
          <div className="mt-6">
            <span className="mb-2 block text-xs font-bold text-zinc-400">ХӨНГӨЛӨЛТИЙН КОД</span>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20));
                  setApplied(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && applyCode()}
                placeholder="PLUS20"
                className="h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm uppercase outline-none transition focus:border-[#ff536a]"
              />
              <button disabled={loading} onClick={applyCode} className="h-12 shrink-0 rounded-xl border border-white/15 px-4 text-xs font-extrabold disabled:opacity-60">Хэрэглэх</button>
            </div>
          </div>
        )}
        <div className={`mt-6 rounded-2xl p-4 ${weekly ? "offer-glow border border-[#ff8a9a]/40 bg-[#ff3d56]/10" : "bg-white/[0.04]"}`}>
          <div className="flex justify-between text-sm text-zinc-400">
            <span>{label}</span>
            <span className={applied ? "text-zinc-500 line-through" : weekly ? "text-lg font-black text-white" : ""}>{formatMoney(applied?.originalAmount ?? listPrice)}</span>
          </div>
          {applied && (
            <div className="mt-3 flex justify-between text-sm text-emerald-400">
              <span>{applied.code} · -{applied.percent}%</span>
              <span>-{formatMoney(applied.originalAmount - applied.amount)}</span>
            </div>
          )}
          <div className="mt-4 flex justify-between border-t border-white/10 pt-4 font-black">
            <span>Нийт</span>
            <span>{formatMoney(total)}</span>
          </div>
        </div>
        {!invoice ? (
          <button disabled={loading || Boolean(initialCode && !applied && !error)} onClick={createInvoice} className="mt-6 h-12 w-full rounded-xl bg-white text-sm font-extrabold text-black disabled:opacity-60">
            {loading ? "Нэхэмжлэх үүсгэж байна..." : `${formatMoney(total)} QPay-ээр төлөх`}
          </button>
        ) : (
          <div className="mt-6">
            {invoice.qrImage && (
              <img src={invoice.qrImage.startsWith("data:") ? invoice.qrImage : `data:image/png;base64,${invoice.qrImage}`} alt="QPay QR" className="mx-auto h-52 w-52 rounded-2xl bg-white p-3" />
            )}
            <div className="mt-4 grid max-h-52 grid-cols-3 gap-2 overflow-y-auto">
              {invoice.urls.map((item) => {
                const label = item.description || item.name;
                return (
                  <a
                    key={item.link}
                    href={item.link}
                    title={label}
                    aria-label={label}
                    className="grid h-16 place-items-center rounded-xl border border-white/10 bg-white/[0.04] px-2 hover:bg-white/10"
                  >
                    {item.logo ? (
                      <img src={item.logo} alt="" className="h-10 w-10 object-contain" />
                    ) : (
                      <span className="truncate text-[10px] font-bold text-zinc-300">{label}</span>
                    )}
                  </a>
                );
              })}
            </div>
            <button disabled={loading} onClick={check} className="mt-4 h-12 w-full rounded-xl bg-white text-sm font-extrabold text-black disabled:opacity-60">
              {loading ? "Төлбөр шалгаж байна..." : "Төлсөн, шалгах"}
            </button>
          </div>
        )}
        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
        <div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-zinc-600">
          <Icon name="lock" className="h-3 w-3" />
          Төлбөр QPay-ээр баталгаажна
        </div>
      </StepMotion>
    </Modal>
  );
}
