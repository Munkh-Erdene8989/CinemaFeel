"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";
import { FilmCard } from "./film-card";
import { Icon } from "./icons";
import { useSite } from "./site-provider";

const photos = {
  hero: "https://images.unsplash.com/photo-1791130842298-570209b82b73?auto=format&fit=crop&w=1800&q=90",
};

export function HomeView() {
  const { series, owned, subscribed, openFilm, beginCheckout, settings } = useSite();
  const [category, setCategory] = useState("Бүгд");
  const categories = ["Бүгд", "Романтик", "Драма", "Өшөө авалт", "Уран зөгнөлт"];
  const visible = category === "Бүгд" ? series : series.filter((film) => film.genre === category);
  const featured = series.find((film) => film.featured) ?? series[0];
  const monthly = Number(settings.price || 14900);

  return (
    <>
      <section className="relative min-h-[710px] overflow-hidden pt-[72px]">
        <img src={featured?.image || photos.hero} alt="Онцлох кино" className="absolute inset-0 h-full w-full object-cover object-[62%_center]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#08080a_0%,rgba(8,8,10,.9)_38%,rgba(8,8,10,.15)_75%),linear-gradient(0deg,#08080a_0%,transparent_55%)]" />
        <div className="relative mx-auto flex min-h-[638px] max-w-[1440px] items-center px-5 pb-16 pt-16 md:px-10 lg:px-16">
          <div className="max-w-2xl">
            <div className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-[#ff6679]">
              <span className="h-px w-8 bg-[#ff3d56]" />
              Энэ долоо хоногийн онцлох
            </div>
            <h1 className="max-w-xl text-5xl font-black leading-[.95] tracking-[-.055em] sm:text-6xl md:text-7xl lg:text-[88px]">
              {featured ? featured.title.split(" ").slice(0, -1).join(" ") || featured.title : "Шөнийн"}{" "}
              <span className="font-serif italic text-[#ff3d56]">{featured ? featured.title.split(" ").slice(-1) : "амлалт"}</span>
            </h1>
            <p className="mt-6 max-w-lg text-sm leading-7 text-zinc-300 md:text-base">
              {featured?.description || "Хоёр өөр ертөнцийн хүмүүс нэгэн шөнийн нууцаар холбогдоно. Өглөө болоход тэдний амьдрал эргэж буцахгүйгээр өөрчлөгджээ."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button disabled={!featured} onClick={() => featured && openFilm(featured)} className="flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-extrabold text-black disabled:opacity-50">
                <Icon name="play" className="h-4 w-4" fill />
                Одоо үзэх
              </button>
              {featured && (
                <span className="flex h-12 items-center rounded-full border border-white/15 bg-black/20 px-5 text-sm font-bold backdrop-blur-md">
                  {featured.access === "free" ? "Үнэгүй" : `${formatMoney(featured.price)} · Нэг удаа`}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {!subscribed && (
        <section className="mx-auto -mt-7 max-w-[1312px] px-5 md:px-10">
          <div className="relative z-10 flex flex-col items-start justify-between gap-5 overflow-hidden rounded-3xl border border-[#ff536a]/20 bg-[linear-gradient(100deg,#251015,#141418)] p-6 md:flex-row md:items-center md:p-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#ff6679]">CinemaFeel Plus</p>
              <h2 className="mt-2 text-xl font-black md:text-2xl">Бүх premium киног хязгааргүй үз</h2>
              <p className="mt-2 text-xs text-zinc-400">Сард {formatMoney(monthly)} · 30 хоног · Шинэ анги нэмэгдэнэ</p>
            </div>
            <button onClick={() => beginCheckout("subscription", featured ?? null)} className="shrink-0 rounded-full bg-[#ff3d56] px-6 py-3 text-sm font-extrabold shadow-[0_10px_30px_rgba(255,61,86,.25)]">
              Сарын эрх авах
            </button>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-[1440px] px-5 py-16 md:px-10 lg:px-16">
        <div className="flex items-end justify-between">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[.2em] text-[#ff536a]">Сонголтоо хийгээрэй</p>
            <h2 className="text-2xl font-black md:text-3xl">Одоо трэнд болж буй</h2>
          </div>
          <span className="text-xs text-zinc-600">Шинэ анги өдөр бүр</span>
        </div>
        <div className="scrollbar-none mt-7 flex gap-2 overflow-x-auto pb-2">
          {categories.map((item) => (
            <button key={item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${category === item ? "bg-white text-black" : "border border-white/10 text-zinc-500"}`}>
              {item}
            </button>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 md:gap-x-5 lg:grid-cols-6">
          {visible.map((film) => (
            <FilmCard key={film.id} film={film} owned={owned.includes(film.id) || subscribed} onClick={() => openFilm(film)} />
          ))}
        </div>
        {!visible.length && <p className="py-16 text-center text-sm text-zinc-500">Энэ ангилалд нийтлэгдсэн кино алга.</p>}
      </section>
    </>
  );
}
