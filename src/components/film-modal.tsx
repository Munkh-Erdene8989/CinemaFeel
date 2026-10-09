"use client";

import type { CheckoutMode, Series } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { Icon, Modal } from "./icons";

export function FilmModal({
  film,
  monthlyPrice,
  onClose,
  isOwned,
  subscribed,
  onCheckout,
  onWatch,
}: {
  film: Series;
  monthlyPrice: number;
  onClose: () => void;
  isOwned: boolean;
  subscribed: boolean;
  onCheckout: (mode: CheckoutMode) => void;
  onWatch: () => void;
}) {
  const available = film.access === "free" || isOwned || subscribed;
  return (
    <Modal onClose={onClose} wide>
      <div className="grid md:grid-cols-[.8fr_1.2fr]">
        <div className="relative min-h-72 md:min-h-[520px]">
          <img src={film.image} alt={film.title} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#151519] via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-[#151519]" />
        </div>
        <div className="relative flex flex-col justify-center p-7 md:p-10">
          <div className="flex gap-2">
            {film.access === "free" && <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-400">Үнэгүй</span>}
            <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-300">{film.year}</span>
          </div>
          <h2 className="mt-5 text-3xl font-black tracking-tight">{film.title}</h2>
          <p className="mt-3 text-xs font-semibold text-zinc-500">{film.genre} · {film.episodes} анги · {film.age}</p>
          <p className="mt-5 text-sm leading-7 text-zinc-400">{film.description}</p>
          <div className="mt-7 border-t border-white/[0.07] pt-6">
            {available ? (
              <button onClick={onWatch} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-extrabold text-black">
                <Icon name="play" className="h-4 w-4" fill /> Одоо үзэх
              </button>
            ) : (
              <>
                <button onClick={() => onCheckout("single")} className="flex h-12 w-full items-center justify-between rounded-xl bg-white px-5 text-sm font-extrabold text-black">
                  <span>Энэ киног авах</span>
                  <span>{formatMoney(film.price)}</span>
                </button>
                <div className="my-4 flex items-center gap-3 text-[10px] font-bold text-zinc-600">
                  <span className="h-px flex-1 bg-white/10" />
                  ЭСВЭЛ
                  <span className="h-px flex-1 bg-white/10" />
                </div>
                <button onClick={() => onCheckout("subscription")} className="h-12 w-full rounded-xl border border-[#ff536a]/40 bg-[#ff3d56]/10 text-sm font-extrabold text-[#ff697c]">
                  Бүх киног сарын {formatMoney(monthlyPrice)}-өөр үзэх
                </button>
              </>
            )}
          </div>
          <p className="mt-4 text-center text-[10px] leading-4 text-zinc-600">{available ? "Таны эрх идэвхтэй байна." : "Нэгж худалдан авалт хугацаагүй. Сарын эрх 30 хоног үргэлжилнэ."}</p>
        </div>
      </div>
    </Modal>
  );
}
