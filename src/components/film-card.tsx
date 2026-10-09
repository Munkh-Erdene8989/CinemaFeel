"use client";

import type { Series } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { Icon } from "./icons";

export function FilmCard({ film, owned, onClick }: { film: Series; owned: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group min-w-0 text-left">
      <div className="relative aspect-[3/4.1] overflow-hidden rounded-2xl bg-zinc-900">
        <img src={film.image} alt={`${film.title} постер`} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
        <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-black backdrop-blur-md ${film.access === "free" ? "bg-emerald-400 text-black" : "bg-black/55 text-white"}`}>
          {owned ? "АВСАН" : film.access === "free" ? "ҮНЭГҮЙ" : formatMoney(film.price)}
        </span>
        <span className="absolute bottom-3 right-3 grid h-10 w-10 translate-y-2 place-items-center rounded-full bg-white text-black opacity-0 shadow-xl transition group-hover:translate-y-0 group-hover:opacity-100">
          <Icon name="play" className="h-4 w-4" fill />
        </span>
      </div>
      <h3 className="mt-3 truncate text-[15px] font-bold">{film.title}</h3>
      <p className="mt-1 text-xs text-zinc-500">{film.genre} · {film.episodes} анги</p>
    </button>
  );
}
