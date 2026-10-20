"use client";

import { alreadyEntitled } from "@/lib/entitlement";
import { isMature } from "@/lib/mature";
import { FilmGridSkeleton } from "./content-skeleton";
import { FilmCard } from "./film-card";
import { useMatureConsent } from "./mature-gate";
import { useSite } from "./site-provider";

export function LibraryView() {
  const { series, owned, subscribed, openFilm, ready, profile } = useSite();
  const { allowed } = useMatureConsent();
  const covered = (film: (typeof series)[number]) => film.access === "free" || alreadyEntitled(film, { ownedIds: owned, subscribed, creatorId: profile?.creatorId });
  const available = series.filter((film) => covered(film) && (allowed || !isMature(film)));
  return (
    <section className="mx-auto min-h-screen max-w-[1440px] px-5 pb-24 pt-32 md:px-10 lg:px-16">
      <div data-rise>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#ff536a]">Миний контент</p>
        <h1 className="mt-2 text-4xl font-black">Миний сан</h1>
        {ready ? <p className="mt-3 text-sm text-zinc-500">{subscribed ? "Plus эрх идэвхтэй — бүх контент нээлттэй." : `${owned.length} худалдан авсан болон үнэгүй кино.`}</p> : <div className="mt-3 h-4 w-64 animate-pulse rounded-full bg-white/[0.07] motion-reduce:animate-none" />}
      </div>
      {ready ? (
        <>
          <div className="mt-10 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 md:gap-x-5">
            {available.map((film, index) => (
              <FilmCard key={film.id} film={film} owned={alreadyEntitled(film, { ownedIds: owned, subscribed, creatorId: profile?.creatorId })} delay={(index % 6) * 0.05} onClick={() => openFilm(film)} />
            ))}
          </div>
          {!available.length && <p data-rise className="py-16 text-sm text-zinc-500">Үзэх эрхтэй кино одоогоор алга.</p>}
        </>
      ) : (
        <FilmGridSkeleton />
      )}
    </section>
  );
}
