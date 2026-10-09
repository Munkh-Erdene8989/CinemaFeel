"use client";

import { useState } from "react";
import type { CheckoutMode, QPayUrl, Series } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { Icon, Modal } from "./icons";
import { clientAuth } from "@/lib/firebase";

export function CheckoutModal({
  mode,
  film,
  monthlyPrice,
  onClose,
  onPaid,
}: {
  mode: CheckoutMode;
  film: Series | null;
  monthlyPrice: number;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [invoice, setInvoice] = useState<{ senderInvoiceNo: string; qrImage: string; urls: QPayUrl[] } | null>(null);
  const total = mode === "single" ? film?.price ?? 0 : monthlyPrice;

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
      body: JSON.stringify({ mode, seriesId: film?.id ?? null }),
    });
    const data = (await response.json()) as { error?: string; senderInvoiceNo?: string; qrImage?: string; urls?: QPayUrl[] };
    setLoading(false);
    if (!response.ok || !data.senderInvoiceNo) {
      setError(data.error || "Нэхэмжлэх үүсгэж чадсангүй.");
      return;
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

  return (
    <Modal onClose={onClose}>
      <div className="p-7 sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff536a]">Төлбөр баталгаажуулах</p>
        <h2 className="mt-2 text-2xl font-black">{mode === "single" ? film?.title : "CinemaFeel сарын эрх"}</h2>
        <div className="mt-6 rounded-2xl bg-white/[0.04] p-4">
          <div className="flex justify-between text-sm text-zinc-400">
            <span>{mode === "single" ? "Киноны эрх" : "30 хоногийн эрх"}</span>
            <span>{formatMoney(total)}</span>
          </div>
          <div className="mt-4 flex justify-between border-t border-white/10 pt-4 font-black">
            <span>Нийт</span>
            <span>{formatMoney(total)}</span>
          </div>
        </div>
        {!invoice ? (
          <button disabled={loading} onClick={createInvoice} className="mt-6 h-12 w-full rounded-xl bg-white text-sm font-extrabold text-black disabled:opacity-60">
            {loading ? "Нэхэмжлэх үүсгэж байна..." : `${formatMoney(total)} QPay-ээр төлөх`}
          </button>
        ) : (
          <div className="mt-6">
            {invoice.qrImage && (
              <img src={invoice.qrImage.startsWith("data:") ? invoice.qrImage : `data:image/png;base64,${invoice.qrImage}`} alt="QPay QR" className="mx-auto h-52 w-52 rounded-2xl bg-white p-3" />
            )}
            <div className="mt-4 grid max-h-40 gap-2 overflow-y-auto">
              {invoice.urls.map((item) => (
                <a key={item.link} href={item.link} className="flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-zinc-200 hover:bg-white/5">
                  {item.logo && <img src={item.logo} alt="" className="h-6 w-6 rounded" />}
                  {item.description || item.name}
                </a>
              ))}
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
      </div>
    </Modal>
  );
}
