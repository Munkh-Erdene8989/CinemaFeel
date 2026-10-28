"use client";

import { useEffect, useRef, useState } from "react";
import { type CheckoutMode, type Series } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import CustomYouTubePlayer from "../../ExampleVD/CustomYouTubePlayer.jsx";
import { Icon, Modal } from "./icons";

type YoutubePreview = {
  videoId: string;
  startAt: number;
  subtitleUrl: string;
  subtitleOffsetMs: number;
  episodeLabel: string;
  title: string;
};

export function FilmModal({
  film,
  monthlyPrice,
  weeklyPrice,
  onClose,
  isOwned,
  subscribed,
  signedIn,
  accessReady = true,
  onCheckout,
  onWatch,
  watermark = "",
}: {
  film: Series;
  monthlyPrice: number;
  weeklyPrice: number;
  onClose: () => void;
  isOwned: boolean;
  subscribed: boolean;
  signedIn: boolean;
  accessReady?: boolean;
  onCheckout: (mode: CheckoutMode) => void;
  onWatch: () => void;
  watermark?: string;
}) {
  const available = film.access === "free" || isOwned || subscribed;
  const checking = signedIn && !accessReady;
  const [preview, setPreview] = useState<YoutubePreview | null>(null);

  useEffect(() => {
    let ignore = false;
    setPreview(null);
    (async () => {
      const response = await fetch("/api/media/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesId: film.id }),
      });
      const data = (await response.json().catch(() => ({}))) as YoutubePreview & { youtube?: boolean };
      if (ignore || !response.ok || !data.youtube || !data.videoId) return;
      setPreview({
        videoId: data.videoId,
        startAt: Number(data.startAt ?? 0),
        subtitleUrl: data.subtitleUrl || "",
        subtitleOffsetMs: Number(data.subtitleOffsetMs ?? 0),
        episodeLabel: data.episodeLabel || "",
        title: data.title || film.title,
      });
    })();
    return () => {
      ignore = true;
    };
  }, [film.id, film.title]);

  return (
    <Modal onClose={onClose} wide flush size={preview ? "xl" : undefined}>
      <div className={preview ? "grid lg:grid-cols-[1.35fr_.9fr]" : "grid md:grid-cols-[.8fr_1.2fr]"}>
        {preview ? (
          <div className="bg-black p-3 sm:p-4">
            <CustomYouTubePlayer
              videoId={preview.videoId}
              startAt={preview.startAt}
              subtitleUrl={preview.subtitleUrl}
              subtitleOffsetMs={preview.subtitleOffsetMs}
              autoplay
              title={preview.title || film.title}
              episodeLabel={preview.episodeLabel}
              onBack={onClose}
              watermark={watermark}
            />
          </div>
        ) : (
        <div className="relative h-52 md:h-auto md:min-h-[520px]">
          <img src={film.image} alt={film.title} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#151519] via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-[#151519]" />
          {film.translation ? <span className="absolute bottom-4 left-4 rounded-full bg-[#ff3d56] px-2.5 py-1 text-[10px] font-black text-white">{film.translation}</span> : null}
          {!available && !checking && (
            <button
              onClick={() => onCheckout("weekly")}
              className="offer-glow absolute left-1/2 top-1/2 z-10 w-[min(15.5rem,78%)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-[#ff8a9a]/50 bg-[#14080c]/75 px-6 py-5 text-center backdrop-blur-md"
            >
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ff8a9a]">Шинэ · 7 хоног</span>
              <span className="mt-2 block text-4xl font-black tracking-tight text-white">{formatMoney(weeklyPrice)}</span>
              <span className="mt-2 block text-xs font-bold text-zinc-200">Бүх киног үзэх</span>
            </button>
          )}
        </div>
        )}
        <div className="relative flex flex-col justify-center p-5 md:p-10">
          <div className="flex gap-2">
            {film.access === "free" && <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-400">Үнэгүй</span>}
            <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-300">{film.year}</span>
            {film.translation ? <span className="rounded-full bg-[#ff3d56] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">{film.translation}</span> : null}
          </div>
          <h2 className="mt-5 text-3xl font-black tracking-tight">{film.title}</h2>
          <p className="mt-3 text-xs font-semibold text-zinc-500">{film.genre} · {film.episodes} анги · {film.age}</p>
          <FilmDescription key={film.id} text={film.description} />
          <div className="mt-7 border-t border-white/[0.07] pt-6">
            {checking ? (
              <p className="text-center text-sm font-bold text-zinc-400">Эрх шалгаж байна...</p>
            ) : available ? (
              <button onClick={onWatch} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-extrabold text-black">
                <Icon name="play" className="h-4 w-4" fill /> Одоо үзэх
              </button>
            ) : (
              <>
                <button onClick={() => onCheckout("subscription")} className="flex h-12 w-full items-center justify-between rounded-xl border border-white/15 bg-white/[0.06] px-5 text-sm font-extrabold text-white">
                  <span>Сарын эрх</span>
                  <span>{formatMoney(monthlyPrice)}</span>
                </button>
                <button onClick={() => onCheckout("weekly")} className="offer-glow mt-3 flex h-14 w-full items-center justify-between rounded-xl border border-[#ff8a9a]/50 bg-[#ff3d56] px-5 text-sm font-extrabold text-white">
                  <span>7 хоног · бүх кино</span>
                  <span>{formatMoney(weeklyPrice)}</span>
                </button>
                <div className="my-4 flex items-center gap-3 text-[10px] font-bold text-zinc-600">
                  <span className="h-px flex-1 bg-white/10" />
                  ЭСВЭЛ
                  <span className="h-px flex-1 bg-white/10" />
                </div>
                <button onClick={() => onCheckout("single")} className="flex h-12 w-full items-center justify-between rounded-xl bg-white px-5 text-sm font-extrabold text-black">
                  <span>Энэ киног авах</span>
                  <span>{formatMoney(film.price)}</span>
                </button>
              </>
            )}
          </div>
          <p className="mt-4 text-center text-[10px] leading-4 text-zinc-600">{checking ? "Идэвхтэй эрх байвал төлбөр дахин гарахгүй." : available && signedIn ? "Таны эрх идэвхтэй байна." : available ? "Тоглуулах үед нэвтрэлт шалгана." : "7 хоногийн эрх бүх кинонд. Нэгж худалдан авалт хугацаагүй. Сарын эрх 30 хоног."}</p>
        </div>
      </div>
    </Modal>
  );
}

export function FilmDescription({ text, className = "mt-5" }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  const copy = text.trim();
  const expandable = !open && overflows;

  useEffect(() => {
    const node = ref.current;
    if (!node || !copy) return;
    const check = () => {
      const desktop = window.matchMedia("(min-width: 768px)").matches;
      setOverflows(!desktop && !open && node.scrollHeight > node.clientHeight + 1);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(node);
    return () => observer.disconnect();
  }, [copy, open]);

  if (!copy) return null;

  const reveal = () => {
    if (!expandable) return;
    setOpen(true);
  };

  return (
    <div className={className}>
      <p
        ref={ref}
        onClick={reveal}
        className={`text-sm leading-6 text-zinc-400 md:leading-7 ${open ? "" : "max-md:line-clamp-3"} ${expandable ? "cursor-pointer" : ""}`}
      >
        {copy}
      </p>
      {expandable ? (
        <button type="button" onClick={reveal} className="mt-1 text-xs font-bold text-zinc-200 md:hidden">
          Дэлгэрэнгүй
        </button>
      ) : null}
    </div>
  );
}
