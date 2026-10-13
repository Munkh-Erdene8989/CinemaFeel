"use client";

import { useEffect, useState } from "react";
import type { Lesson } from "@/lib/types";
import { AdminField, FilePicker, Icon, Modal } from "./icons";

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

function fileType(file: File) {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".webm")) return "video/webm";
  if (name.endsWith(".mov")) return "video/quicktime";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

async function uploadLessonFile(file: File, kind: "video" | "poster", lessonId: string) {
  const contentType = fileType(file);
  const created = await adminFetch<{ uploadUrl: string; storagePath: string }>("/api/admin/upload-url", {
    method: "POST",
    body: JSON.stringify({ kind, lessonId, contentType, fileName: file.name }),
  });
  const put = await fetch(created.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!put.ok) throw new Error("Файл Firebase руу хуулагдаж чадсангүй.");
  return created.storagePath;
}

export function KnowledgeAdmin({ lessons, manage, reload, notify }: { lessons: Lesson[]; manage: boolean; reload: () => Promise<void>; notify: (message: string) => void }) {
  const [editing, setEditing] = useState<Lesson | "new" | null>(null);
  const [watching, setWatching] = useState<Lesson | null>(null);
  const [busyId, setBusyId] = useState("");

  const visible = manage ? lessons : lessons.filter((lesson) => lesson.hasVideo);

  const move = async (lesson: Lesson, direction: "up" | "down") => {
    setBusyId(lesson.id);
    try {
      await adminFetch(`/api/admin/lessons/${lesson.id}`, { method: "PATCH", body: JSON.stringify({ move: direction }) });
      await reload();
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Дарааллыг өөрчилж чадсангүй.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">Мэдлэг</h2>
          <p className="mt-1 text-sm text-zinc-600">{manage ? `${lessons.length} хичээл · ${lessons.filter((lesson) => lesson.hasVideo).length} видеотой` : "Системээ хэрхэн ашиглахаа эдгээр хичээлээс суралцана."}</p>
        </div>
        {manage && (
          <button onClick={() => setEditing("new")} className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-extrabold text-black">
            <Icon name="plus" className="h-4 w-4" />
            Шинэ хичээл
          </button>
        )}
      </div>
      <div className="mt-6 space-y-3">
        {visible.map((lesson, index) => (
          <article key={lesson.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/[.07] bg-[#141419] p-4">
            <div className="grid h-16 w-28 shrink-0 place-items-center overflow-hidden rounded-xl bg-black/40 text-zinc-600">
              {lesson.cover ? <img src={lesson.cover} alt="" className="h-full w-full object-cover" /> : <Icon name="play" className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[.16em] text-zinc-600">{index + 1}-р хичээл</p>
              <h3 className="mt-1 truncate text-sm font-black">{lesson.title}</h3>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{lesson.description || "Тайлбаргүй"}</p>
            </div>
            {manage ? (
              <>
                <span className={`rounded-full px-2 py-1 text-[9px] font-black ${lesson.hasVideo ? "bg-emerald-400/10 text-emerald-400" : "bg-amber-400/10 text-amber-400"}`}>
                  {lesson.hasVideo ? "Видеотой" : "Видеогүй"}
                </span>
                <div className="flex items-center gap-2">
                  <button disabled={index === 0 || busyId === lesson.id} onClick={() => move(lesson, "up")} className="rounded-lg border border-white/10 px-3 py-2 text-[11px] font-bold text-zinc-400 disabled:opacity-30">Дээш</button>
                  <button disabled={index === visible.length - 1 || busyId === lesson.id} onClick={() => move(lesson, "down")} className="rounded-lg border border-white/10 px-3 py-2 text-[11px] font-bold text-zinc-400 disabled:opacity-30">Доош</button>
                  <button onClick={() => setEditing(lesson)} className="rounded-lg bg-white px-3 py-2 text-[11px] font-extrabold text-black">Засах</button>
                </div>
              </>
            ) : (
              <button disabled={!lesson.hasVideo} onClick={() => setWatching(lesson)} className="rounded-lg bg-white px-3 py-2 text-[11px] font-extrabold text-black disabled:opacity-40">
                {lesson.hasVideo ? "Үзэх" : "Видеогүй"}
              </button>
            )}
          </article>
        ))}
        {!visible.length && (
          <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
            <p className="text-sm font-bold text-zinc-400">{manage ? "Видео хичээл алга." : "Хичээл хараахан ороогүй байна."}</p>
            <p className="mt-2 text-xs text-zinc-600">{manage ? "Шинэ хичээл нэмж, видеог энд байршуулна." : "Сургалт нэмэгдэхэд эндээс үзэж суралцана."}</p>
          </div>
        )}
      </div>
      {watching && <LessonPlayer lesson={watching} lessons={visible} onClose={() => setWatching(null)} onOpen={setWatching} />}
      {manage && editing && (
        <LessonEditor
          lesson={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async (message) => {
            setEditing(null);
            await reload();
            notify(message);
          }}
        />
      )}
    </div>
  );
}

function LessonPlayer({ lesson, lessons, onClose, onOpen }: { lesson: Lesson; lessons: Lesson[]; onClose: () => void; onOpen: (lesson: Lesson) => void }) {
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const index = lessons.findIndex((item) => item.id === lesson.id);
  const previous = lessons.slice(0, index).reverse().find((item) => item.hasVideo);
  const next = lessons.slice(index + 1).find((item) => item.hasVideo);

  useEffect(() => {
    let cancelled = false;
    setPreview("");
    setError("");
    adminFetch<{ url: string }>(`/api/admin/lessons/${lesson.id}/preview`, { method: "POST" })
      .then((data) => {
        if (!cancelled) setPreview(data.url);
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      });
    return () => {
      cancelled = true;
    };
  }, [lesson.id]);

  return (
    <Modal onClose={onClose} wide>
      <div className="max-h-[85vh] overflow-y-auto p-7 md:p-9">
        <p className="text-xs font-black uppercase tracking-[.18em] text-[#ff536a]">{index + 1}-р хичээл</p>
        <h2 className="mt-2 text-2xl font-black">{lesson.title}</h2>
        {lesson.description && <p className="mt-3 text-sm leading-6 text-zinc-400">{lesson.description}</p>}
        <div className="mt-6">
          {preview ? (
            <video key={preview} src={preview} controls autoPlay className="aspect-video w-full rounded-xl bg-black" />
          ) : (
            <div className="grid aspect-video place-items-center rounded-xl border border-dashed border-white/15 text-xs text-zinc-600">
              {error || "Видео ачаалж байна..."}
            </div>
          )}
        </div>
        <div className="mt-6 flex gap-3">
          <button disabled={!previous} onClick={() => previous && onOpen(previous)} className="rounded-xl border border-white/10 px-4 py-3 text-xs font-bold text-zinc-300 disabled:opacity-30">Өмнөх</button>
          <button disabled={!next} onClick={() => next && onOpen(next)} className="rounded-xl bg-white px-4 py-3 text-xs font-extrabold text-black disabled:opacity-30">Дараах</button>
        </div>
      </div>
    </Modal>
  );
}

function LessonEditor({ lesson, onClose, onSaved }: { lesson: Lesson | null; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [description, setDescription] = useState(lesson?.description ?? "");
  const [cover, setCover] = useState(lesson?.cover ?? "");
  const [lessonId, setLessonId] = useState(lesson?.id ?? "");
  const [hasVideo, setHasVideo] = useState(lesson?.hasVideo ?? false);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [fileKey, setFileKey] = useState(0);
  const [videoTick, setVideoTick] = useState(0);

  useEffect(() => {
    if (!lessonId || !hasVideo) return;
    let cancelled = false;
    adminFetch<{ url: string }>(`/api/admin/lessons/${lessonId}/preview`, { method: "POST" })
      .then((data) => {
        if (!cancelled) setPreview(data.url);
      })
      .catch(() => {
        if (!cancelled) setPreview("");
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId, hasVideo, videoTick]);

  const saveMeta = async () => {
    setBusy("Хадгалж байна...");
    setError("");
    try {
      const payload = { title, description };
      if (!lessonId) {
        const created = await adminFetch<{ id: string }>("/api/admin/lessons", { method: "POST", body: JSON.stringify(payload) });
        setLessonId(created.id);
        setBusy("");
        return created.id;
      }
      await adminFetch(`/api/admin/lessons/${lessonId}`, { method: "PATCH", body: JSON.stringify(payload) });
      setBusy("");
      return lessonId;
    } catch (cause) {
      setBusy("");
      setError(cause instanceof Error ? cause.message : "Хадгалж чадсангүй.");
      return "";
    }
  };

  const onVideo = async (file: File) => {
    const id = lessonId || (await saveMeta());
    if (!id) return;
    setBusy("Видео хуулж байна...");
    setError("");
    try {
      const storagePath = await uploadLessonFile(file, "video", id);
      const saved = await adminFetch<{ hasVideo: boolean }>(`/api/admin/lessons/${id}`, { method: "PATCH", body: JSON.stringify({ title, description, storagePath }) });
      setHasVideo(saved.hasVideo);
      setPreview("");
      setVideoTick((value) => value + 1);
      setFileKey((value) => value + 1);
      setBusy("");
    } catch (cause) {
      setBusy("");
      setError(cause instanceof Error ? cause.message : "Видео хуулж чадсангүй.");
    }
  };

  const onCover = async (file: File) => {
    const id = lessonId || (await saveMeta());
    if (!id) return;
    setBusy("Ковер хуулж байна...");
    setError("");
    try {
      const coverPath = await uploadLessonFile(file, "poster", id);
      const saved = await adminFetch<{ cover: string }>(`/api/admin/lessons/${id}`, { method: "PATCH", body: JSON.stringify({ title, description, coverPath }) });
      setCover(saved.cover);
      setFileKey((value) => value + 1);
      setBusy("");
    } catch (cause) {
      setBusy("");
      setError(cause instanceof Error ? cause.message : "Ковер хуулж чадсангүй.");
    }
  };

  return (
    <Modal onClose={onClose} wide>
      <div className="max-h-[85vh] overflow-y-auto p-7 md:p-9">
        <p className="text-xs font-black uppercase tracking-[.18em] text-[#ff536a]">{lesson ? "Хичээл засах" : "Шинэ хичээл"}</p>
        <h2 className="mt-2 text-2xl font-black">{title || "Видео хичээл"}</h2>
        <div className="mt-7 grid gap-5">
          <AdminField label="Нэр">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Хичээлийн нэр" className="admin-input" />
          </AdminField>
          <AdminField label="Тайлбар">
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Энэ хичээлээр юу үзэх вэ" className="admin-input h-24 py-3" />
          </AdminField>
          <AdminField label="Ковер">
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
              {cover ? <img src={cover} alt="" className="aspect-video w-full object-cover" /> : <div className="grid aspect-video place-items-center text-xs text-zinc-600">Ковер заавал биш</div>}
            </div>
            <FilePicker key={`cover-${fileKey}`} accept="image/jpeg,image/png,image/webp" buttonLabel="Зураг сонгох" emptyLabel="Зураг сонгоогүй" onFile={(file) => file && onCover(file)} />
          </AdminField>
          <AdminField label="Видео">
            {preview ? (
              <video key={preview} src={preview} controls className="aspect-video w-full rounded-xl bg-black" />
            ) : (
              <div className="grid aspect-video place-items-center rounded-xl border border-dashed border-white/15 text-xs text-zinc-600">
                {hasVideo ? "Видео ачаалж байна..." : "MP4, WebM эсвэл MOV"}
              </div>
            )}
            <FilePicker key={`video-${fileKey}`} accept="video/mp4,video/webm,video/quicktime" buttonLabel="Видео сонгох" emptyLabel="Видео сонгоогүй" onFile={(file) => file && onVideo(file)} />
          </AdminField>
        </div>
        {busy && <p className="mt-4 text-xs font-bold text-[#ff6679]">{busy}</p>}
        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
        <div className="mt-7 flex flex-wrap justify-between gap-3">
          {lessonId ? (
            <button
              disabled={Boolean(busy)}
              onClick={async () => {
                setBusy("Устгаж байна...");
                setError("");
                try {
                  await adminFetch(`/api/admin/lessons/${lessonId}`, { method: "DELETE" });
                  await onSaved("Хичээл устгагдлаа.");
                } catch (cause) {
                  setBusy("");
                  setError(cause instanceof Error ? cause.message : "Устгаж чадсангүй.");
                }
              }}
              className="rounded-xl border border-red-500/20 px-5 py-3 text-xs font-bold text-red-400 disabled:opacity-40"
            >
              Устгах
            </button>
          ) : <span />}
          <div className="flex gap-3">
            <button onClick={onClose} className="rounded-xl border border-white/10 px-5 py-3 text-xs font-bold text-zinc-400">Хаах</button>
            <button
              disabled={title.trim().length < 2 || Boolean(busy)}
              onClick={async () => {
                const id = await saveMeta();
                if (id) await onSaved(lesson ? "Хичээл шинэчлэгдлээ." : "Шинэ хичээл нэмэгдлээ.");
              }}
              className="rounded-xl bg-white px-5 py-3 text-xs font-extrabold text-black disabled:opacity-40"
            >
              Хадгалах
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
