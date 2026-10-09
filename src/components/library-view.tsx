"use client";

import { FilmCard } from "./film-card";
import { useSite } from "./site-provider";

export function LibraryView() {
  const { series, owned, subscribed, openFilm } = useSite();
  const available = series.filter((film) => film.access === "free" || owned.includes(film.id) || subscribed);
  return (
    <section className="mx-auto min-h-screen max-w-[1440px] px-5 pb-24 pt-32 md:px-10 lg:px-16">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[#ff536a]">Миний контент</p>
      <h1 className="mt-2 text-4xl font-black">Миний сан</h1>
      <p className="mt-3 text-sm text-zinc-500">{subscribed ? "Plus эрх идэвхтэй — бүх контент нээлттэй." : `${owned.length} худалдан авсан болон үнэгүй кино.`}</p>
      <div className="mt-10 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 md:gap-x-5">
        {available.map((film) => (
          <FilmCard key={film.id} film={film} owned={owned.includes(film.id) || subscribed} onClick={() => openFilm(film)} />
        ))}
      </div>
      {!available.length && <p className="py-16 text-sm text-zinc-500">Үзэх эрхтэй кино одоогоор алга.</p>}
    </section>
  );
}
