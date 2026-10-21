"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { alreadyEntitled } from "@/lib/entitlement";
import { WEEKLY_PRICE, type Series } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { MATURE_CATEGORY, coverFilm, isMatureLabel, matureCatalog, publicCatalog, readMatureConsent } from "@/lib/mature";
import { FilmCard } from "./film-card";
import { MediaImage } from "./media-image";
import { CatalogSkeleton, HeroSkeleton } from "./content-skeleton";
import { Icon } from "./icons";
import { MatureGate, useMatureConsent } from "./mature-gate";
import { prefersReducedMotion } from "./motion";
import { useSite } from "./site-provider";

export function HomeView({ initialFeatured = null }: { initialFeatured?: Series | null }) {
  const { series, owned, subscribed, openFilm, beginCheckout, settings, ready, profile } = useSite();
  const { allowed, allow } = useMatureConsent();
  const [category, setCategory] = useState("Бүгд");
  const [askMature, setAskMature] = useState(false);
  const categories = ["Бүгд", ...settings.genres.filter((genre) => !isMatureLabel(genre)), MATURE_CATEGORY];
  const active = categories.includes(category) ? category : "Бүгд";
  const safe = publicCatalog(series);
  const visible = active === MATURE_CATEGORY ? (allowed ? matureCatalog(series) : []) : active === "Бүгд" ? safe : safe.filter((film) => film.genre === active);
  const featured = ready ? (coverFilm(series) ?? null) : initialFeatured;
  const cover = featured?.cover || featured?.image || "";
  const titleWords = featured?.title.split(" ").filter(Boolean) ?? [];
  const titleLead = titleWords.length > 1 ? titleWords.slice(0, -1).join(" ") : featured?.title ?? "";
  const titleAccent = titleWords.length > 1 ? titleWords[titleWords.length - 1] : "";
  const monthly = Number(settings.price || 14900);
  const heroRef = useRef<HTMLElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const filterKey = useRef<string | null>(null);
  const [heroPainted, setHeroPainted] = useState(false);

  useEffect(() => {
    setHeroPainted(false);
    const img = mediaRef.current?.querySelector("img");
    if (img?.complete && img.naturalWidth > 0) setHeroPainted(true);
  }, [cover]);

  useGSAP(() => {
    if (prefersReducedMotion() || !featured || !heroRef.current) return;
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.from("[data-hero='kicker']", { opacity: 0, x: -18, duration: 0.55, clearProps: "transform,opacity" }, 0.15);
    tl.from("[data-hero='rule']", { scaleX: 0, duration: 0.45, transformOrigin: "left center", clearProps: "transform" }, 0.15);
    tl.from("[data-hero='title']", { opacity: 0, y: 42, duration: 0.85, clearProps: "transform,opacity" }, 0.28);
    if (featured.description) tl.from("[data-hero='copy']", { opacity: 0, y: 18, duration: 0.6, clearProps: "transform,opacity" }, 0.48);
    tl.from("[data-hero='actions'] > *", { opacity: 0, y: 14, duration: 0.45, stagger: 0.08, clearProps: "transform,opacity" }, 0.62);
  }, { scope: heroRef, dependencies: [featured?.id] });

  useGSAP(() => {
    if (prefersReducedMotion() || !cover || !heroPainted || !heroRef.current) return;
    const tl = gsap.timeline();
    tl.from("[data-hero='media']", { scale: 1.14, duration: 1.6, ease: "power2.out" }, 0);
    tl.to("[data-hero='media']", { scale: 1.07, duration: 16, ease: "sine.inOut", repeat: -1, yoyo: true }, 1.6);
  }, { scope: heroRef, dependencies: [featured?.id, cover, heroPainted] });

  useGSAP(() => {
    if (filterKey.current === null || filterKey.current === active) {
      filterKey.current = active;
      return;
    }
    filterKey.current = active;
    if (prefersReducedMotion() || !gridRef.current) return;
    gsap.from(gridRef.current, { opacity: 0, y: 12, duration: 0.35, ease: "power2.out", clearProps: "transform,opacity" });
  }, { dependencies: [active], scope: gridRef });

  if (!featured && !ready) {
    return (
      <>
        <HeroSkeleton />
        <CatalogSkeleton />
      </>
    );
  }

  return (
    <>
      <section ref={heroRef} className="relative min-h-[710px] overflow-hidden bg-[#101014] pt-[72px]">
        {cover ? (
          <div ref={mediaRef} data-hero="media" className="absolute inset-0 origin-center will-change-transform">
            <MediaImage src={cover} alt="" fill priority sizes="100vw" className="object-cover object-[62%_center]" onLoad={() => setHeroPainted(true)} onError={() => setHeroPainted(true)} />
          </div>
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#08080a_0%,rgba(8,8,10,.9)_38%,rgba(8,8,10,.15)_75%),linear-gradient(0deg,#08080a_0%,transparent_55%)]" />
        <div className="relative mx-auto flex min-h-[638px] max-w-[1440px] items-center px-5 pb-16 pt-16 md:px-10 lg:px-16">
          <div className="max-w-2xl">
            {featured ? (
              <>
                <div data-hero="kicker" className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-[#ff6679]">
                  <span data-hero="rule" className="h-px w-8 origin-left bg-[#ff3d56]" />
                  Энэ долоо хоногийн онцлох
                </div>
                <h1 data-hero="title" className="max-w-xl text-5xl font-black leading-[.95] tracking-[-.055em] sm:text-6xl md:text-7xl lg:text-[88px]">
                  {titleLead}{titleAccent ? " " : ""}
                  {titleAccent ? <span className="font-serif italic text-[#ff3d56]">{titleAccent}</span> : null}
                </h1>
                {featured.description ? <p data-hero="copy" className="mt-6 max-w-lg text-sm leading-7 text-zinc-300 md:text-base">{featured.description}</p> : null}
                <div data-hero="actions" className="mt-8 flex flex-wrap gap-3">
                  <button onClick={() => openFilm(featured)} className="flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-extrabold text-black">
                    <Icon name="play" className="h-4 w-4" fill />
                    Одоо үзэх
                  </button>
                  <span className="flex h-12 items-center rounded-full border border-white/15 bg-black/20 px-5 text-sm font-bold backdrop-blur-md">
                    {alreadyEntitled(featured, { ownedIds: owned, subscribed, creatorId: profile?.creatorId }) ? "Эрх нээлттэй" : featured.access === "free" ? "Үнэгүй" : `${formatMoney(featured.price)} · Нэг удаа`}
                  </span>
                </div>
              </>
            ) : (
              <div>
                <h1 className="text-4xl font-black tracking-tight md:text-5xl">{series.length ? "Нүүрэнд онцлох кино алга" : "Нийтлэгдсэн кино алга"}</h1>
                <p className="mt-4 max-w-md text-sm leading-7 text-zinc-500">{series.length ? "+18 контент тусдаа ангилалд байна." : "Шинэ контент нэмэгдэхэд энд харагдана."}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {ready && !subscribed && (
        <section data-rise data-delay="0.08" className="mx-auto -mt-7 max-w-[1312px] px-5 md:px-10">
          <div className="relative z-10 flex flex-col items-start justify-between gap-5 overflow-hidden rounded-3xl border border-[#ff536a]/20 bg-[linear-gradient(100deg,#251015,#141418)] p-6 md:flex-row md:items-center md:p-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#ff6679]">CinemaFeel Plus</p>
              <h2 className="mt-2 text-xl font-black md:text-2xl">Бүх premium киног хязгааргүй үз</h2>
              <p className="mt-2 text-xs text-zinc-400">7 хоног {formatMoney(WEEKLY_PRICE)} · Сард {formatMoney(monthly)} · Шинэ анги нэмэгдэнэ</p>
            </div>
            <button onClick={() => beginCheckout("weekly", featured ?? null)} className="offer-glow shrink-0 rounded-full bg-[#ff3d56] px-6 py-3 text-sm font-extrabold">
              7 хоног · {formatMoney(WEEKLY_PRICE)}
            </button>
          </div>
        </section>
      )}

      {ready ? <section className="mx-auto max-w-[1440px] px-5 py-16 md:px-10 lg:px-16">
        <div data-rise className="flex items-end justify-between">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[.2em] text-[#ff536a]">Сонголтоо хийгээрэй</p>
            <h2 className="text-2xl font-black md:text-3xl">Одоо трэнд болж буй</h2>
          </div>
          <span className="text-xs text-zinc-600">Шинэ анги өдөр бүр</span>
        </div>
        <div className="scrollbar-none mt-7 flex gap-2 overflow-x-auto pb-2">
          {categories.map((item, index) => (
            <button
              key={item}
              data-rise
              data-delay={String((index % 8) * 0.04)}
              onClick={(event) => {
                if (item === MATURE_CATEGORY && !allowed) {
                  if (readMatureConsent()) {
                    allow();
                    setCategory(item);
                  } else setAskMature(true);
                  return;
                }
                setCategory(item);
                if (!prefersReducedMotion()) animate(event.currentTarget, { scale: [0.94, 1], duration: 320, ease: "outBack", composition: "replace" });
              }}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${active === item ? "bg-white text-black" : "border border-white/10 text-zinc-500"}`}
            >
              {item}
            </button>
          ))}
        </div>
        <div ref={gridRef} className="mt-6 grid grid-cols-3 gap-x-2 gap-y-6 sm:gap-x-3 md:gap-x-5 lg:grid-cols-6">
          {visible.map((film, index) => (
            <FilmCard key={film.id} film={film} owned={alreadyEntitled(film, { ownedIds: owned, subscribed, creatorId: profile?.creatorId })} delay={(index % 6) * 0.05} onClick={() => openFilm(film)} />
          ))}
        </div>
        {!visible.length && <p data-rise className="py-16 text-center text-sm text-zinc-500">Энэ ангилалд нийтлэгдсэн кино алга.</p>}
      </section> : <CatalogSkeleton />}
      {askMature && (
        <MatureGate
          onDecline={() => setAskMature(false)}
          onAccept={() => {
            allow();
            setAskMature(false);
            setCategory(MATURE_CATEGORY);
          }}
        />
      )}
    </>
  );
}
