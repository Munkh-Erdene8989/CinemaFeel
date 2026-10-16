"use client";

import type { MouseEvent } from "react";
import { animate } from "animejs";
import type { Series } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { Icon } from "./icons";
import { prefersReducedMotion } from "./motion";

function canHover() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches && !prefersReducedMotion();
}

export function FilmCard({ film, owned, onClick, delay = 0 }: { film: Series; owned: boolean; onClick: () => void; delay?: number }) {
  const hover = (event: MouseEvent<HTMLButtonElement>, entering: boolean) => {
    if (!canHover()) return;
    const img = event.currentTarget.querySelector("img");
    const play = event.currentTarget.querySelector("[data-play]");
    if (img) animate(img, { scale: entering ? 1.07 : 1, duration: entering ? 700 : 480, ease: entering ? "outQuart" : "outQuad", composition: "replace" });
    if (play) animate(play, { opacity: entering ? 1 : 0, y: entering ? 0 : 8, duration: entering ? 380 : 260, ease: "outCubic", composition: "replace" });
  };

  return (
    <button data-rise data-delay={String(delay)} onClick={onClick} onMouseEnter={(event) => hover(event, true)} onMouseLeave={(event) => hover(event, false)} className="group min-w-0 text-left">
      <div className="relative aspect-[3/4.1] overflow-hidden rounded-2xl bg-zinc-900">
        {film.image ? <img src={film.image} alt={`${film.title} постер`} className="h-full w-full origin-center object-cover motion-reduce:transition motion-reduce:duration-700 motion-reduce:group-hover:scale-105" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
        <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-black backdrop-blur-md ${film.access === "free" ? "bg-emerald-400 text-black" : "bg-black/55 text-white"}`}>
          {owned ? "АВСАН" : film.access === "free" ? "ҮНЭГҮЙ" : formatMoney(film.price)}
        </span>
        <span data-play className="absolute bottom-3 right-3 grid h-10 w-10 translate-y-2 place-items-center rounded-full bg-white text-black opacity-0 shadow-xl motion-reduce:transition motion-reduce:duration-300 motion-reduce:group-hover:translate-y-0 motion-reduce:group-hover:opacity-100">
          <Icon name="play" className="h-4 w-4" fill />
        </span>
      </div>
      <h3 className="mt-3 truncate text-[15px] font-bold">{film.title}</h3>
      <p className="mt-1 text-xs text-zinc-500">{film.genre} · {film.episodes} анги</p>
    </button>
  );
}
