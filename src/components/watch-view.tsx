"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import type { Episode, Series } from "@/lib/types";
import { clientAuth, clientDb, firebaseConfigured } from "@/lib/firebase";
import { Icon } from "./icons";
import { useSite } from "./site-provider";

export function WatchView({ seriesId, episodeNumber }: { seriesId: string; episodeNumber: number }) {
  const router = useRouter();
  const { series, user, openAuth, openFilm, beginCheckout } = useSite();
  const film = series.find((item) => item.id === seriesId) ?? null;
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [needsAuth, setNeedsAuth] = useState(false);
  const [needsPay, setNeedsPay] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseConfigured() || !film) return;
    getDocs(collection(clientDb(), "series", seriesId, "episodes")).then((snap) => {
      const list = snap.docs
        .map((item) => ({ id: item.id, ...(item.data() as Omit<Episode, "id">) }))
        .sort((a, b) => a.number - b.number);
      setEpisodes(list);
    });
  }, [seriesId, film]);

  const current = episodes.find((item) => item.number === episodeNumber) ?? episodes[0];

  useEffect(() => {
    if (!film) return;
    if (!current) {
      setLoading(false);
      setUrl("");
      setNeedsAuth(false);
      setNeedsPay(false);
      return;
    }
    if (!current.storagePath) {
      setLoading(false);
      setUrl("");
      setNeedsAuth(false);
      setNeedsPay(false);
      setError("Энэ ангийн видео оруулаагүй байна.");
      return;
    }
    if (!user) {
      setLoading(false);
      setUrl("");
      setNeedsPay(false);
      setNeedsAuth(true);
      setError("");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setNeedsAuth(false);
      setNeedsPay(false);
      const token = await clientAuth().currentUser?.getIdToken();
      const response = await fetch("/api/media/play", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ seriesId, episodeId: current.id }),
      });
      const data = (await response.json()) as { error?: string; url?: string; code?: string };
      if (cancelled) return;
      setLoading(false);
      if (data.code === "auth") {
        setNeedsAuth(true);
        return;
      }
      if (data.code === "paywall") {
        setNeedsPay(true);
        return;
      }
      if (!response.ok || !data.url) {
        setUrl("");
        setError(data.error || "Видео нээж чадсангүй.");
        return;
      }
      setUrl(data.url);
    })();
    return () => {
      cancelled = true;
    };
  }, [film, user, current?.id, seriesId, episodes.length]);

  const saveProgress = (seconds: number) => {
    if (!user || !current) return;
    setDoc(doc(clientDb(), "users", user.uid, "progress", seriesId), {
      episodeNumber: current.number,
      seconds,
      updatedAt: Date.now(),
    }, { merge: true }).catch(() => undefined);
  };

  if (!film && series.length > 0) {
    return (
      <section className="mx-auto min-h-screen max-w-3xl px-5 pt-32">
        <h1 className="text-3xl font-black">Кино олдсонгүй</h1>
        <a href="/" className="mt-6 inline-block text-sm font-bold text-[#ff6679]">Нүүр лүү буцах</a>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-screen max-w-[1440px] px-5 pb-24 pt-28 md:px-10 lg:px-16">
      <button onClick={() => film && openFilm(film)} className="text-xs font-bold text-zinc-500 hover:text-white">← {film?.title || "Кино"}</button>
      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(280px,420px)_1fr]">
        <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-3xl bg-black">
          <div className="relative aspect-[9/16] bg-zinc-900">
            {url ? (
              <video
                key={url}
                src={url}
                controls
                controlsList="nodownload"
                disablePictureInPicture
                playsInline
                className="h-full w-full object-contain"
                onContextMenu={(event) => event.preventDefault()}
                onTimeUpdate={(event) => {
                  const seconds = Math.floor(event.currentTarget.currentTime);
                  if (seconds > 0 && seconds % 5 === 0) saveProgress(seconds);
                }}
              />
            ) : (
              <div className="grid h-full place-items-center px-6 text-center text-sm text-zinc-400">
                {film?.image && !loading && <img src={film.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />}
                <div className="relative">
                  {loading ? "Ачааллаж байна..." : needsAuth ? "Үзэхийн тулд нэвтэрнэ үү." : needsPay ? "Энэ ангийг үзэх эрхгүй байна." : error || "Видео оруулаагүй байна."}
                  {needsAuth && (
                    <button onClick={openAuth} className="mt-4 flex h-11 items-center gap-2 rounded-full bg-white px-5 text-xs font-extrabold text-black">
                      <Icon name="play" className="h-4 w-4" fill />
                      Нэвтэрч үзэх
                    </button>
                  )}
                  {needsPay && film && (
                    <div className="mt-4 grid gap-2">
                      <button onClick={() => beginCheckout("single", film)} className="h-11 rounded-full bg-white px-5 text-xs font-extrabold text-black">Кино авах</button>
                      <button onClick={() => beginCheckout("subscription", film)} className="h-11 rounded-full border border-white/20 px-5 text-xs font-extrabold">Сарын эрх авах</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#ff536a]">{film?.genre}</p>
          <h1 className="mt-2 text-3xl font-black">{film?.title}</h1>
          <p className="mt-3 text-sm leading-7 text-zinc-400">{film?.description}</p>
          <h2 className="mt-8 text-sm font-black uppercase tracking-[.16em] text-zinc-500">Ангиуд</h2>
          <div className="mt-4 space-y-2">
            {episodes.map((episode) => (
              <button key={episode.id} onClick={() => router.push(`/watch/${seriesId}/${episode.number}`)} className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left ${episode.id === current?.id ? "border-[#ff536a] bg-[#ff3d56]/10" : "border-white/10"}`}>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-black"><Icon name="play" className="h-3.5 w-3.5" fill /></span>
                <span>
                  <b className="block text-sm">{episode.number}-р анги</b>
                  <span className="text-xs text-zinc-500">{episode.title || "Анги"}{episode.storagePath ? "" : " · видеогүй"}</span>
                </span>
              </button>
            ))}
            {!episodes.length && !loading && <p className="text-sm text-zinc-500">Анги хараахан алга.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
