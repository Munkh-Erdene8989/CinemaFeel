"use client";

import { useEffect, useState } from "react";
import { clientAuth } from "@/lib/firebase";
import { WEEKLY_PRICE, type CheckoutMode } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { useSite } from "./site-provider";

type Offer = {
  code: string;
  percent: number;
  expiresAt: number;
  used: boolean;
  expired: boolean;
};

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

function discounted(amount: number, percent: number) {
  return Math.max(1, Math.round((amount * (100 - percent)) / 100));
}

function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

export function RenewView({ code }: { code: string }) {
  const { user, profile, ready, settings, openAuth, beginCheckout } = useSite();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [offerError, setOfferError] = useState("");
  const [loadingOffer, setLoadingOffer] = useState(Boolean(code));
  const live = Boolean(offer && !offer.used && !offer.expired);
  const now = useNow(live);
  const monthly = Number(settings.price || 14900);
  const percent = live ? offer?.percent || 0 : 0;
  const left = offer ? offer.expiresAt - now : 0;
  const expired = Boolean(offer && (offer.expired || offer.used || left <= 0));

  useEffect(() => {
    if (!code || !user) {
      setLoadingOffer(false);
      return;
    }
    let cancel = false;
    const load = async () => {
      setLoadingOffer(true);
      const token = await clientAuth().currentUser?.getIdToken();
      if (!token || cancel) return;
      const response = await fetch(`/api/renewal?code=${encodeURIComponent(code)}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = (await response.json()) as Offer & { error?: string };
      if (cancel) return;
      setLoadingOffer(false);
      if (!response.ok) {
        setOffer(null);
        setOfferError(data.error || "Хөнгөлөлт олдсонгүй.");
        return;
      }
      setOfferError("");
      setOffer(data);
    };
    void load();
    return () => {
      cancel = true;
    };
  }, [code, user]);

  const renew = (mode: CheckoutMode) => {
    if (!user) {
      openAuth();
      return;
    }
    beginCheckout(mode, null, live && offer ? offer.code : "");
  };

  const offerVisit = Boolean(code) && !offerError && !expired;
  const title = offerVisit ? "Чамд 20% үлдээсэн" : "Багцаа үргэлжлүүлэх үү";
  const copy = offerVisit
    ? "Зөвхөн чамд багцаа 20% хөнгөлөлттэй сунгах боломж нээлттэй. Таалагдвал ашиглаарай, үгүй бол орхиход болно."
    : "Яарах зүйл байхгүй. Үзсээр баймаар санагдвал эндээс сунгаад болно.";

  return (
    <section className="mx-auto grid min-h-screen max-w-xl place-items-center px-5 pb-24 pt-28 text-center">
      <div data-rise>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff536a]">Багц</p>
        <h1 className="mt-3 text-4xl font-black">{title}</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-zinc-400">{profile?.status === "Түр зогссон" ? "Бүртгэл чинь түр зогссон байна." : copy}</p>
        {live && offer && (
          <div className="mt-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">24 цаг</p>
            <p className="mt-2 font-mono text-5xl font-black tracking-wider">{clock(left)}</p>
          </div>
        )}
        {offerVisit && !user && ready && <p className="mt-6 text-sm text-zinc-500">Нэвтэрсний дараа 24 цагийн тоолуур энд гарна.</p>}
        {loadingOffer && code && user && <p className="mt-6 text-sm text-zinc-500">Хөнгөлөлтийг шалгаж байна...</p>}
        {offerError && <p className="mt-6 text-sm text-zinc-400">{offerError}</p>}
        {expired && code && <p className="mt-6 text-sm text-zinc-400">Энэ саналын 24 цаг дууссан. Хүсвэл ердийн үнээр үргэлжлүүлж болно.</p>}
        {!ready ? (
          <p className="mt-8 text-sm text-zinc-500">Ачааллаж байна...</p>
        ) : (
          <div className="mt-8 grid gap-3 text-left">
            <button onClick={() => renew("subscription")} className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/[0.04] px-5 py-4">
              <span>
                <span className="block text-sm font-bold">Сарын эрх</span>
                <span className="mt-1 block text-xs text-zinc-500">30 хоног</span>
              </span>
              <span className="text-right">
                {percent > 0 && <span className="block text-xs text-zinc-500 line-through">{formatMoney(monthly)}</span>}
                <span className="text-lg font-black">{formatMoney(percent > 0 ? discounted(monthly, percent) : monthly)}</span>
              </span>
            </button>
            <button onClick={() => renew("weekly")} className="offer-glow flex items-center justify-between rounded-2xl border border-[#ff8a9a]/50 bg-[#ff3d56]/15 px-5 py-4">
              <span>
                <span className="block text-sm font-bold">7 хоног</span>
                <span className="mt-1 block text-xs text-[#ffc1ca]">Бүх киног үзэх</span>
              </span>
              <span className="text-right">
                {percent > 0 && <span className="block text-xs text-[#ffc1ca] line-through">{formatMoney(WEEKLY_PRICE)}</span>}
                <span className="text-lg font-black">{formatMoney(percent > 0 ? discounted(WEEKLY_PRICE, percent) : WEEKLY_PRICE)}</span>
              </span>
            </button>
          </div>
        )}
        {!user && ready && <button onClick={openAuth} className="mt-6 text-xs font-bold text-zinc-400">Эхлээд нэвтрэх</button>}
      </div>
    </section>
  );
}
