"use client";

import { useEffect, useMemo, useState } from "react";
import CustomYouTubePlayer, { parseSrt } from "../../ExampleVD/CustomYouTubePlayer.jsx";
import { isMature } from "@/lib/mature";
import { parseYouTubeUrl } from "@/lib/youtube";
import type { SeriesWithEpisodes } from "@/lib/types";
import { AdminField, FilePicker, Modal } from "./icons";

async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (response.status === 401) {
    window.location.href = "/admin/login";
    throw new Error("Нэвтрэх шаардлагатай");
  }
  if (!response.ok) throw new Error(data.error || "Алдаа гарлаа");
  return data;
}

async function uploadAdminFile(file: File, kind: "poster" | "cover", seriesId: string) {
  const created = await adminFetch<{ uploadUrl: string; storagePath: string }>("/api/admin/upload-url", {
    method: "POST",
    body: JSON.stringify({ kind, seriesId, contentType: file.type || "application/octet-stream", fileName: file.name }),
  });
  const put = await fetch(created.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!put.ok) throw new Error("Зураг Firebase руу хуулагдаж чадсангүй.");
  return created.storagePath;
}

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

export function YoutubeEpisodeForm({
  content,
  genres,
  onClose,
  onSaved,
}: {
  content: SeriesWithEpisodes[];
  genres: string[];
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [seriesId, setSeriesId] = useState("new");
  const [nextNumber, setNextNumber] = useState(1);
  const [created, setCreated] = useState<{ id: string; title: string } | null>(null);
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState(genres[0] ?? "Драма");
  const [age, setAge] = useState("13+");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(0);
  const [status, setStatus] = useState("Ноорог");
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [subtitleText, setSubtitleText] = useState("");
  const [subtitleName, setSubtitleName] = useState("");
  const [offset, setOffset] = useState(0);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const posterPreview = useObjectUrl(posterFile);
  const coverPreview = useObjectUrl(coverFile);

  useEffect(() => {
    if (seriesId === "new") {
      setNextNumber(1);
      return;
    }
    let ignore = false;
    adminFetch<{ episodes: { id: string }[] }>(`/api/admin/series/${seriesId}/episodes`)
      .then((data) => {
        if (!ignore) setNextNumber(data.episodes.length + 1);
      })
      .catch(() => {
        if (!ignore) setNextNumber(1);
      });
    return () => {
      ignore = true;
    };
  }, [seriesId]);

  const parsed = youtubeUrl.trim() ? parseYouTubeUrl(youtubeUrl) : null;
  const cueCount = useMemo(() => (subtitleText.trim() ? parseSrt(subtitleText).length : 0), [subtitleText]);
  const selected = content.find((film) => film.id === seriesId);
  const options = created && !content.some((film) => film.id === created.id) ? [{ id: created.id, title: created.title }, ...content] : content;
  const posterSrc = posterPreview || (seriesId !== "new" ? selected?.image : "") || "";
  const coverSrc = coverPreview || (seriesId !== "new" ? selected?.cover : "") || "";
  const mature = seriesId === "new" ? isMature({ age, genre }) : isMature(selected ?? { age, genre });
  const playerTitle = (seriesId === "new" ? title : selected?.title || title).trim();

  const onSrtFile = async (file: File) => {
    setSubtitleText(await file.text());
    setSubtitleName(file.name);
    setError("");
  };

  const save = async () => {
    if (!parsed) {
      setError("YouTube линк буруу байна.");
      return;
    }
    setBusy("Хадгалж байна...");
    setError("");
    try {
      let id = seriesId;
      if (seriesId === "new") {
        if (!title.trim()) throw new Error("Киноны нэр оруулна уу.");
        const made = await adminFetch<{ id: string }>("/api/admin/series", {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            genre,
            description,
            price: Number(price) || 0,
            status,
            age,
            episodes: 1,
          }),
        });
        id = made.id;
        setSeriesId(made.id);
        setCreated({ id: made.id, title: title.trim() });
      }
      if (posterFile) {
        setBusy("Постер хуулж байна...");
        const storagePath = await uploadAdminFile(posterFile, "poster", id);
        await adminFetch(`/api/admin/series/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ posterPath: storagePath }),
        });
      }
      if (coverFile && !mature) {
        setBusy("Вэбсайт ковер хуулж байна...");
        const storagePath = await uploadAdminFile(coverFile, "cover", id);
        await adminFetch(`/api/admin/series/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ coverPath: storagePath }),
        });
      }
      const listed = await adminFetch<{ episodes: { id: string }[] }>(`/api/admin/series/${id}/episodes`);
      const number = listed.episodes.length + 1;
      setBusy("Анги хадгалж байна...");
      const saved = await adminFetch<{ telegramSent?: boolean; telegramError?: string; telegramPending?: string }>(`/api/admin/series/${id}/episodes`, {
        method: "POST",
        body: JSON.stringify({
          number,
          title: episodeTitle.trim() || `${number}-р анги`,
          youtubeUrl,
          subtitleText,
          subtitleOffsetMs: offset,
          duration: 0,
        }),
      });
      const telegram = saved.telegramSent
        ? "Telegram сувагт шинэ ангийн мэдэгдэл илгээлээ."
        : saved.telegramError || saved.telegramPending || "";
      setBusy("");
      await onSaved(telegram ? `YouTube анги нэмэгдлээ. ${telegram}` : "YouTube анги нэмэгдлээ.");
    } catch (cause) {
      setBusy("");
      setError(cause instanceof Error ? cause.message : "Хадгалж чадсангүй.");
    }
  };

  return (
    <Modal onClose={onClose} size="xl">
      <div className="max-h-[88vh] overflow-y-auto p-7 md:p-9">
        <p className="text-xs font-black uppercase tracking-[.18em] text-[#ff536a]">YouTube</p>
        <h2 className="mt-2 text-2xl font-black">YouTube-оос анги нэмэх</h2>
        <p className="mt-2 text-sm text-zinc-500">Линк болон SRT-ээ оруулахад хадмал видеоны цагтай зэрэгцэн харагдана.</p>
        <div className="mt-7 grid items-start gap-8 lg:grid-cols-2">
          <div className="grid gap-5">
            <AdminField label="Контент">
              <select value={seriesId} onChange={(event) => setSeriesId(event.target.value)} className="admin-input">
                <option value="new">Шинэ контент</option>
                {options.map((film) => (
                  <option key={film.id} value={film.id}>{film.title}</option>
                ))}
              </select>
            </AdminField>
            {seriesId === "new" && (
              <>
                <AdminField label="Нэр">
                  <input value={title} onChange={(event) => setTitle(event.target.value)} className="admin-input" placeholder="Киноны нэр" />
                </AdminField>
                <AdminField label="Төрөл">
                  <select value={genre} onChange={(event) => setGenre(event.target.value)} className="admin-input">
                    {(genres.includes(genre) ? genres : [genre, ...genres]).map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </AdminField>
                <AdminField label="Нас">
                  <select value={age} onChange={(event) => setAge(event.target.value)} className="admin-input">
                    <option>13+</option>
                    <option>16+</option>
                    <option>18+</option>
                  </select>
                </AdminField>
                <AdminField label="Тайлбар">
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="admin-input h-24 py-3" placeholder="Товч тайлбар" />
                </AdminField>
                <div className="grid gap-5 sm:grid-cols-2">
                  <AdminField label="Үнэ (0 = үнэгүй)">
                    <input value={price} onChange={(event) => setPrice(Number(event.target.value))} type="number" min="0" className="admin-input" />
                  </AdminField>
                  <AdminField label="Төлөв">
                    <select value={status} onChange={(event) => setStatus(event.target.value)} className="admin-input">
                      <option>Ноорог</option>
                      <option>Нийтлэгдсэн</option>
                    </select>
                  </AdminField>
                </div>
              </>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <AdminField label="Постер зураг">
                <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
                  {posterSrc ? (
                    <img src={posterSrc} alt="" className="aspect-[2/3] w-full object-cover" />
                  ) : (
                    <div className="grid aspect-[2/3] place-items-center px-4 text-center text-xs text-zinc-600">Босоо постер. Карт дээр харагдана.</div>
                  )}
                </div>
                <FilePicker accept="image/jpeg,image/png,image/webp" buttonLabel="Зураг сонгох" emptyLabel="Зураг сонгоогүй" fileName={posterFile?.name ?? ""} onFile={setPosterFile} />
              </AdminField>
              <AdminField label="Вэбсайт ковер">
                {mature ? (
                  <p className="rounded-xl border border-white/10 px-4 py-3 text-xs leading-5 text-zinc-500">+18 контент нүүрний ковер дээр гарахгүй.</p>
                ) : (
                  <>
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
                      {coverSrc ? (
                        <img src={coverSrc} alt="" className="aspect-[21/9] w-full object-cover" />
                      ) : (
                        <div className="grid aspect-[21/9] place-items-center px-4 text-center text-xs text-zinc-600">Өргөн ковер. Нүүр хуудсанд харагдана.</div>
                      )}
                    </div>
                    <FilePicker accept="image/jpeg,image/png,image/webp" buttonLabel="Ковер сонгох" emptyLabel="Ковер сонгоогүй" fileName={coverFile?.name ?? ""} onFile={setCoverFile} />
                  </>
                )}
              </AdminField>
            </div>
            <AdminField label="Ангийн нэр">
              <input value={episodeTitle} onChange={(event) => setEpisodeTitle(event.target.value)} className="admin-input" placeholder={`${nextNumber}-р анги`} />
            </AdminField>
            <AdminField label="YouTube URL">
              <input value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} className="admin-input" placeholder="https://www.youtube.com/watch?v=..." />
            </AdminField>
            <AdminField label="SRT хадмал">
              <FilePicker accept=".srt,text/plain" buttonLabel="SRT сонгох" emptyLabel="SRT сонгоогүй" fileName={subtitleName} onFile={(file) => file && onSrtFile(file)} />
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                <span>{subtitleName ? `${subtitleName}${cueCount ? ` · ${cueCount} мөр` : ""}` : "SRT сонгоогүй"}</span>
                {subtitleText && (
                  <button
                    type="button"
                    onClick={() => {
                      setSubtitleText("");
                      setSubtitleName("");
                    }}
                    className="font-bold text-zinc-500 hover:text-white"
                  >
                    Хасах
                  </button>
                )}
              </div>
            </AdminField>
            <AdminField label="Хадмалын зөрүү (мс)">
              <input value={offset} onChange={(event) => setOffset(Number(event.target.value) || 0)} type="number" step="50" className="admin-input" />
            </AdminField>
          </div>
          <div className="lg:sticky lg:top-0">
            <p className="text-xs font-black uppercase tracking-[.16em] text-zinc-500">Урьдчилан үзэх</p>
            <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black">
              {parsed ? (
                <CustomYouTubePlayer
                  key={`${parsed.videoId}:${parsed.startAt}:${subtitleName}`}
                  videoId={parsed.videoId}
                  startAt={parsed.startAt}
                  subtitleText={subtitleText}
                  subtitleOffsetMs={offset}
                  title={playerTitle || undefined}
                  episodeLabel={episodeTitle.trim() || undefined}
                />
              ) : (
                <div className="grid aspect-video place-items-center px-6 text-center text-sm text-zinc-500">
                  {youtubeUrl.trim() ? "YouTube URL буруу байна." : "YouTube URL оруулна уу."}
                </div>
              )}
            </div>
            {parsed && (
              <p className="mt-3 text-xs leading-5 text-zinc-500">
                {parsed.videoId}
                {parsed.startAt > 0 ? ` · ${parsed.startAt} секундээс эхэлнэ` : " · эхнээс эхэлнэ"}
                {cueCount ? ` · ${cueCount} хадмал` : " · хадмалгүй"}
              </p>
            )}
          </div>
        </div>
        {busy && <p className="mt-4 text-xs font-bold text-[#ff6679]">{busy}</p>}
        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
        <div className="mt-7 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-xl border border-white/10 px-5 py-3 text-xs font-bold text-zinc-400">Хаах</button>
          <button disabled={!parsed || Boolean(busy) || (seriesId === "new" && !title.trim())} onClick={save} className="rounded-xl bg-white px-5 py-3 text-xs font-extrabold text-black disabled:opacity-40">
            Хадгалах
          </button>
        </div>
      </div>
    </Modal>
  );
}
