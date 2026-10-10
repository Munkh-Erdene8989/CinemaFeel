"use client";

import { useEffect, useState } from "react";
import type { AppUser, Episode, Payment, SeriesWithEpisodes, Settings } from "@/lib/types";
import { defaultSettings, genres } from "@/lib/types";
import { formatMoney, formatViews } from "@/lib/format";
import { AdminField, Icon, Logo, Modal } from "./icons";

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

function shareHref(code: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/s/${code}`;
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  }
}

async function uploadAdminFile(file: File, kind: "poster" | "cover" | "video", seriesId: string) {
  const created = await adminFetch<{ uploadUrl: string; storagePath: string }>("/api/admin/upload-url", {
    method: "POST",
    body: JSON.stringify({ kind, seriesId, contentType: file.type || "application/octet-stream", fileName: file.name }),
  });
  const put = await fetch(created.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!put.ok) throw new Error("Файл Firebase руу хуулагдаж чадсангүй.");
  return created.storagePath;
}

export function AdminApp() {
  const [section, setSection] = useState("Хяналтын самбар");
  const [content, setContent] = useState<SeriesWithEpisodes[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [notice, setNotice] = useState("");
  const menu = [["Хяналтын самбар", "chart"], ["Контент", "film"], ["Хэрэглэгчид", "users"], ["Төлбөр", "card"], ["Тохиргоо", "settings"]];

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  };

  const reload = async () => {
    const [seriesData, userData, paymentData, settingsData] = await Promise.all([
      adminFetch<{ series: SeriesWithEpisodes[] }>("/api/admin/series"),
      adminFetch<{ users: AppUser[] }>("/api/admin/users"),
      adminFetch<{ payments: Payment[] }>("/api/admin/payments"),
      adminFetch<{ settings: Settings }>("/api/admin/settings"),
    ]);
    setContent(seriesData.series);
    setUsers(userData.users);
    setPayments(paymentData.payments);
    setSettings(settingsData.settings);
  };

  useEffect(() => {
    reload().catch((error: Error) => notify(error.message));
  }, []);

  return (
    <div className="min-h-screen bg-[#0c0c0f] text-white">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/[.07] bg-[#101014] p-5 lg:block">
        <Logo href="/" />
        <p className="mt-9 px-3 text-[10px] font-black uppercase tracking-[.2em] text-zinc-600">Удирдлага</p>
        <nav className="mt-3 space-y-1">
          {menu.map(([label, icon]) => (
            <button key={label} onClick={() => setSection(label)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold ${section === label ? "bg-white text-black" : "text-zinc-500 hover:bg-white/5 hover:text-white"}`}>
              <Icon name={icon} className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        <a href="/" className="absolute bottom-6 left-5 right-5 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-zinc-500 hover:text-white">
          <Icon name="logout" className="h-4 w-4" />
          Сайт руу буцах
        </a>
      </aside>
      <main className="lg:ml-64">
        <header className="flex h-20 items-center justify-between border-b border-white/[.07] px-5 md:px-8">
          <div>
            <p className="text-xs text-zinc-600">{settings.name} Admin</p>
            <h1 className="mt-1 text-lg font-black">{section}</h1>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="text-xs font-bold text-zinc-500 lg:hidden">Сайт руу буцах</a>
            <button onClick={() => fetch("/api/admin/logout", { method: "POST" }).then(() => (window.location.href = "/admin/login"))} className="text-xs font-bold text-zinc-500">Гарах</button>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#ff3d56] text-xs font-black">A</span>
          </div>
        </header>
        <div className="p-5 md:p-8">
          <div className="scrollbar-none mb-6 flex gap-2 overflow-x-auto lg:hidden">
            {menu.map(([label]) => (
              <button key={label} onClick={() => setSection(label)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${section === label ? "bg-white text-black" : "border border-white/10 text-zinc-500"}`}>{label}</button>
            ))}
          </div>
          {section === "Хяналтын самбар" && <Dashboard content={content} users={users} payments={payments} />}
          {section === "Контент" && <ContentAdmin content={content} reload={reload} notify={notify} />}
          {section === "Хэрэглэгчид" && <UsersAdmin users={users} reload={reload} notify={notify} />}
          {section === "Төлбөр" && <PaymentsAdmin payments={payments} reload={reload} notify={notify} />}
          {section === "Тохиргоо" && <SettingsAdmin settings={settings} reload={reload} notify={notify} />}
        </div>
      </main>
      {notice && (
        <div className="fixed bottom-6 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-extrabold text-black shadow-2xl">
          <Icon name="check" className="h-4 w-4 text-emerald-600" />
          {notice}
        </div>
      )}
    </div>
  );
}

function Dashboard({ content, users, payments }: { content: SeriesWithEpisodes[]; users: AppUser[]; payments: Payment[] }) {
  const [range, setRange] = useState("7");
  const days = Number(range);
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const recent = payments.filter((payment) => payment.createdAt >= since && payment.status === "Амжилттай");
  const revenue = recent.reduce((sum, payment) => sum + payment.amount, 0);
  const buckets = Array.from({ length: 7 }, (_, index) => {
    const start = since + ((days / 7) * index * 24 * 60 * 60 * 1000);
    const end = since + ((days / 7) * (index + 1) * 24 * 60 * 60 * 1000);
    return recent.filter((payment) => payment.createdAt >= start && payment.createdAt < end).reduce((sum, payment) => sum + payment.amount, 0);
  });
  const max = Math.max(...buckets, 1);
  const stats = [
    ["Нийт орлого", `₮${Math.round(revenue).toLocaleString("mn-MN")}`, `${recent.length} гүйлгээ`, "chart"],
    ["Идэвхтэй эрх", users.filter((user) => user.plan === "Plus" && user.status === "Идэвхтэй").length.toString(), `${users.length} хэрэглэгч`, "users"],
    ["Нийт үзэлт", formatViews(content.reduce((sum, film) => sum + film.views, 0)), "бодит тоолуур", "play"],
    ["Контент", content.length.toString(), `${content.filter((film) => film.status === "Нийтлэгдсэн").length} нийтлэгдсэн`, "film"],
  ];
  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black">Ерөнхий тойм</h2>
          <p className="mt-1 text-sm text-zinc-600">Firestore дээрх бодит өгөгдөл</p>
        </div>
        <select value={range} onChange={(e) => setRange(e.target.value)} className="rounded-xl border border-white/10 bg-[#141419] px-4 py-2 text-xs font-bold outline-none">
          <option value="7">7 хоног</option>
          <option value="30">30 хоног</option>
          <option value="90">90 хоног</option>
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, change, icon]) => (
          <div key={label} className="rounded-2xl border border-white/[.07] bg-[#141419] p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500">{label}</span>
              <Icon name={icon} className="h-4 w-4 text-zinc-600" />
            </div>
            <p className="mt-5 text-2xl font-black">{value}</p>
            <p className="mt-2 text-xs font-bold text-emerald-400">{change}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-white/[.07] bg-[#141419] p-6">
          <div className="flex justify-between">
            <div>
              <h2 className="font-black">Орлогын үзүүлэлт</h2>
              <p className="mt-1 text-xs text-zinc-600">Сүүлийн {range} хоног</p>
            </div>
            <span className="text-xs text-zinc-500">₮{Math.round(revenue).toLocaleString("mn-MN")}</span>
          </div>
          <div className="mt-8 flex h-52 items-end gap-3">
            {buckets.map((amount, index) => (
              <div key={index} className="flex flex-1 flex-col items-center gap-2">
                <div className="w-full rounded-t-md bg-gradient-to-t from-[#ff3d56]/30 to-[#ff536a]" style={{ height: `${Math.max(8, (amount / max) * 100)}%` }} />
                <span className="text-[9px] text-zinc-700">{index + 1}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/[.07] bg-[#141419] p-6">
          <h2 className="font-black">Шилдэг контент</h2>
          <div className="mt-5 space-y-4">
            {content.slice().sort((a, b) => b.views - a.views).slice(0, 4).map((film, index) => (
              <div key={film.id} className="flex items-center gap-4">
                <span className="w-4 text-xs font-black text-zinc-600">0{index + 1}</span>
                <img src={film.image} className="h-11 w-9 rounded-md object-cover" alt="" />
                <div>
                  <p className="text-sm font-bold">{film.title}</p>
                  <p className="mt-1 text-[10px] text-zinc-600">{film.genre}</p>
                </div>
                <span className="ml-auto text-xs font-bold">{formatViews(film.views)} үзэлт</span>
              </div>
            ))}
            {!content.length && <p className="text-sm text-zinc-600">Контент алга.</p>}
          </div>
        </div>
      </div>
    </>
  );
}

function ContentAdmin({ content, reload, notify }: { content: SeriesWithEpisodes[]; reload: () => Promise<void>; notify: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Бүгд");
  const [editing, setEditing] = useState<SeriesWithEpisodes | "new" | null>(null);
  const visible = content.filter((film) => film.title.toLowerCase().includes(query.toLowerCase()) && (filter === "Бүгд" || film.status === filter));
  const toggleStatus = async (film: SeriesWithEpisodes) => {
    await adminFetch(`/api/admin/series/${film.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: film.status === "Нийтлэгдсэн" ? "Ноорог" : "Нийтлэгдсэн" }),
    });
    await reload();
    notify("Контентын төлөв шинэчлэгдлээ.");
  };
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">Контентын сан</h2>
          <p className="mt-1 text-sm text-zinc-600">{content.length} цуврал · {content.reduce((sum, film) => sum + film.episodeList.length, 0)} анги</p>
        </div>
        <button onClick={() => setEditing("new")} className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-extrabold text-black">
          <Icon name="plus" className="h-4 w-4" />
          Шинэ контент
        </button>
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-[#141419] px-4">
          <Icon name="search" className="h-4 w-4 text-zinc-600" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Нэрээр хайх..." className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-700" />
        </label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-11 rounded-xl border border-white/10 bg-[#141419] px-4 text-xs font-bold outline-none">
          <option>Бүгд</option>
          <option>Нийтлэгдсэн</option>
          <option>Ноорог</option>
        </select>
      </div>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/[.07] bg-[#141419]">
        <table className="w-full min-w-[820px] text-left text-xs">
          <thead className="border-b border-white/[.07] text-zinc-600">
            <tr>{["КОНТЕНТ", "ТӨРӨЛ", "ҮНЭ", "ҮЗЭЛТ", "ТӨЛӨВ", "ҮЙЛДЭЛ"].map((heading) => <th key={heading} className="px-5 py-4 font-bold">{heading}</th>)}</tr>
          </thead>
          <tbody>
            {visible.map((film) => (
              <tr key={film.id} className="border-b border-white/[.05] last:border-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <img src={film.image} className="h-12 w-9 rounded object-cover" alt="" />
                    <div>
                      <b className="text-sm">{film.title}</b>
                      <p className="mt-1 text-zinc-600">{film.episodeList.length || film.episodes} анги</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 text-zinc-400">{film.genre}</td>
                <td className="px-5 font-bold">{film.price ? formatMoney(film.price) : "Үнэгүй"}</td>
                <td className="px-5 text-zinc-400">{formatViews(film.views)}</td>
                <td className="px-5">
                  <button onClick={() => toggleStatus(film)} className={`rounded-full px-2 py-1 text-[9px] font-black ${film.status === "Нийтлэгдсэн" ? "bg-emerald-400/10 text-emerald-400" : "bg-amber-400/10 text-amber-400"}`}>{film.status}</button>
                </td>
                <td className="px-5">
                  <div className="flex gap-3">
                    <button
                      disabled={!film.shareCode}
                      onClick={() => {
                        if (!film.shareCode) return;
                        copyText(shareHref(film.shareCode)).then((copied) => notify(copied ? "Хуваалцах линк хуулагдлаа." : "Линкийг гараар хуулна уу."));
                      }}
                      className="font-bold text-zinc-500 hover:text-white disabled:opacity-40"
                    >
                      Линк
                    </button>
                    <button onClick={() => setEditing(film)} className="font-bold text-zinc-500 hover:text-white">Засах</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && <p className="py-12 text-center text-sm text-zinc-600">Илэрц олдсонгүй.</p>}
      </div>
      {editing && (
        <ContentEditor
          film={editing === "new" ? null : editing}
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

function ContentEditor({ film, onClose, onSaved }: { film: SeriesWithEpisodes | null; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [form, setForm] = useState({
    title: film?.title ?? "",
    genre: film?.genre ?? "Романтик",
    description: film?.description ?? "",
    price: film?.price ?? 0,
    image: film?.image ?? "",
    cover: film?.cover ?? "",
    status: film?.status ?? "Ноорог",
    featured: film?.featured ?? false,
    year: film?.year ?? 2026,
    age: film?.age ?? "13+",
  });
  const [episodes, setEpisodes] = useState<Episode[]>(film?.episodeList ?? []);
  const [seriesId, setSeriesId] = useState(film?.id ?? "");
  const [shareCode, setShareCode] = useState(film?.shareCode ?? "");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const update = (key: string, value: string | number | boolean) => setForm((current) => ({ ...current, [key]: value }));

  const saveMeta = async () => {
    setBusy("Хадгалж байна...");
    setError("");
    try {
      const payload = { ...form, access: Number(form.price) === 0 ? "free" : "paid", episodes: episodes.length || 1 };
      if (!seriesId) {
        const created = await adminFetch<{ id: string; shareCode: string }>("/api/admin/series", { method: "POST", body: JSON.stringify(payload) });
        setSeriesId(created.id);
        setShareCode(created.shareCode);
        setBusy("");
        return created.id;
      }
      const saved = await adminFetch<{ shareCode?: string }>(`/api/admin/series/${seriesId}`, { method: "PATCH", body: JSON.stringify(payload) });
      if (saved.shareCode) setShareCode(saved.shareCode);
      setBusy("");
      return seriesId;
    } catch (cause) {
      setBusy("");
      setError(cause instanceof Error ? cause.message : "Хадгалж чадсангүй.");
      return "";
    }
  };

  const onPoster = async (file: File) => {
    const id = seriesId || (await saveMeta());
    if (!id) return;
    setBusy("Постер хуулж байна...");
    try {
      const storagePath = await uploadAdminFile(file, "poster", id);
      const saved = await adminFetch<{ image: string }>(`/api/admin/series/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ posterPath: storagePath }),
      });
      update("image", saved.image);
      setBusy("");
    } catch (cause) {
      setBusy("");
      setError(cause instanceof Error ? cause.message : "Постер хуулж чадсангүй.");
    }
  };

  const onCover = async (file: File) => {
    const id = seriesId || (await saveMeta());
    if (!id) return;
    setBusy("Вэбсайт ковер хуулж байна...");
    try {
      const storagePath = await uploadAdminFile(file, "cover", id);
      const saved = await adminFetch<{ cover: string; shareCode?: string }>(`/api/admin/series/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ coverPath: storagePath }),
      });
      update("cover", saved.cover);
      if (saved.shareCode) setShareCode(saved.shareCode);
      setBusy("");
    } catch (cause) {
      setBusy("");
      setError(cause instanceof Error ? cause.message : "Ковер хуулж чадсангүй.");
    }
  };

  const addEpisode = async (file: File, title: string) => {
    const id = seriesId || (await saveMeta());
    if (!id) return;
    setBusy("Видео Firebase руу хуулж байна...");
    try {
      const storagePath = await uploadAdminFile(file, "video", id);
      const number = episodes.length + 1;
      const created = await adminFetch<{ episode: Episode }>(`/api/admin/series/${id}/episodes`, {
        method: "POST",
        body: JSON.stringify({ number, title: title || `${number}-р анги`, storagePath, duration: 0 }),
      });
      setEpisodes((current) => [...current, created.episode]);
      setBusy("");
    } catch (cause) {
      setBusy("");
      setError(cause instanceof Error ? cause.message : "Видео хуулж чадсангүй.");
    }
  };

  const removeEpisode = async (episode: Episode) => {
    if (!seriesId) return;
    await adminFetch(`/api/admin/series/${seriesId}/episodes/${episode.id}`, { method: "DELETE" });
    setEpisodes((current) => current.filter((item) => item.id !== episode.id));
  };

  return (
    <Modal onClose={onClose} wide>
      <div className="max-h-[85vh] overflow-y-auto p-7 md:p-9">
        <p className="text-xs font-black uppercase tracking-[.18em] text-[#ff536a]">{film ? "Контент засах" : "Шинэ контент"}</p>
        <h2 className="mt-2 text-2xl font-black">{form.title || "Мэдээлэл оруулах"}</h2>
        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <AdminField label="Нэр"><input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Киноны нэр" className="admin-input" /></AdminField>
          <AdminField label="Төрөл">
            <select value={form.genre} onChange={(e) => update("genre", e.target.value)} className="admin-input">{genres.map((genre) => <option key={genre}>{genre}</option>)}</select>
          </AdminField>
          <AdminField label="Үнэ (0 = үнэгүй)"><input value={form.price} onChange={(e) => update("price", Number(e.target.value))} type="number" min="0" className="admin-input" /></AdminField>
          <AdminField label="Он"><input value={form.year} onChange={(e) => update("year", Number(e.target.value))} type="number" className="admin-input" /></AdminField>
          <div className="sm:col-span-2">
            <AdminField label="Тайлбар"><textarea value={form.description} onChange={(e) => update("description", e.target.value)} className="admin-input h-24 py-3" /></AdminField>
          </div>
          <AdminField label="Постерын URL"><input value={form.image} onChange={(e) => update("image", e.target.value)} className="admin-input" /></AdminField>
          <AdminField label="Постер файл"><input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onPoster(e.target.files[0])} className="admin-input pt-2" /></AdminField>
          <div className="sm:col-span-2">
            <AdminField label="Вэбсайт ковер">
              <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
                {form.cover ? (
                  <img src={form.cover} alt="" className="aspect-[21/9] w-full object-cover" />
                ) : (
                  <div className="grid aspect-[21/9] place-items-center px-6 text-center text-xs text-zinc-600">Нүүр хуудсын өргөн ковер. Онцлох контент дээр харагдана.</div>
                )}
              </div>
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onCover(e.target.files[0])} className="admin-input mt-3 pt-2" />
            </AdminField>
          </div>
          <div className="sm:col-span-2">
            <AdminField label="Хуваалцах линк">
              {shareCode ? (
                <div className="flex gap-2">
                  <input readOnly value={shareHref(shareCode)} className="admin-input" />
                  <button
                    type="button"
                    onClick={() => {
                      copyText(shareHref(shareCode)).then((ok) => {
                        if (!ok) return;
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1600);
                      });
                    }}
                    className="shrink-0 rounded-xl bg-white px-4 text-xs font-extrabold text-black"
                  >
                    {copied ? "Хуулсан" : "Хуулах"}
                  </button>
                </div>
              ) : (
                <p className="rounded-xl border border-white/10 px-4 py-3 text-xs text-zinc-500">Хадгалсны дараа богино линк гарна.</p>
              )}
            </AdminField>
            {shareCode && form.status !== "Нийтлэгдсэн" && <p className="mt-2 text-[11px] text-zinc-600">Ноорог үед линк хаагдсан байна. Нийтэлсний дараа нээгдэнэ.</p>}
          </div>
          <AdminField label="Төлөв">
            <select value={form.status} onChange={(e) => update("status", e.target.value)} className="admin-input"><option>Ноорог</option><option>Нийтлэгдсэн</option></select>
          </AdminField>
          <AdminField label="Онцлох">
            <select value={form.featured ? "Тийм" : "Үгүй"} onChange={(e) => update("featured", e.target.value === "Тийм")} className="admin-input"><option>Үгүй</option><option>Тийм</option></select>
          </AdminField>
        </div>
        <div className="mt-8">
          <h3 className="text-sm font-black">Ангиуд</h3>
          <div className="mt-3 space-y-2">
            {episodes.map((episode) => (
              <div key={episode.id} className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-sm">
                <span>{episode.number}. {episode.title} {episode.storagePath ? "" : "· видеогүй"}</span>
                <button onClick={() => removeEpisode(episode)} className="text-xs font-bold text-red-400">Устгах</button>
              </div>
            ))}
          </div>
          <EpisodeUpload onUpload={addEpisode} />
        </div>
        {busy && <p className="mt-4 text-xs font-bold text-[#ff6679]">{busy}</p>}
        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
        <div className="mt-7 flex flex-wrap justify-between gap-3">
          {seriesId ? (
            <button onClick={async () => { await adminFetch(`/api/admin/series/${seriesId}`, { method: "DELETE" }); await onSaved("Контент устгагдлаа."); }} className="rounded-xl border border-red-500/20 px-5 py-3 text-xs font-bold text-red-400">Устгах</button>
          ) : <span />}
          <div className="flex gap-3">
            <button onClick={onClose} className="rounded-xl border border-white/10 px-5 py-3 text-xs font-bold text-zinc-400">Хаах</button>
            <button disabled={!form.title.trim() || Boolean(busy)} onClick={async () => { const id = await saveMeta(); if (id) await onSaved(film ? "Контент шинэчлэгдлээ." : "Шинэ контент нэмэгдлээ."); }} className="rounded-xl bg-white px-5 py-3 text-xs font-extrabold text-black disabled:opacity-40">Хадгалах</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function EpisodeUpload({ onUpload }: { onUpload: (file: File, title: string) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  return (
    <div className="mt-4 grid gap-3 rounded-2xl border border-dashed border-white/15 p-4 sm:grid-cols-[1fr_1fr_auto]">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ангийн нэр" className="admin-input" />
      <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="admin-input pt-2" />
      <button disabled={!file} onClick={() => file && onUpload(file, title).then(() => { setTitle(""); setFile(null); })} className="rounded-xl bg-white px-4 text-xs font-extrabold text-black disabled:opacity-40">Видео нэмэх</button>
    </div>
  );
}

function UsersAdmin({ users, reload, notify }: { users: AppUser[]; reload: () => Promise<void>; notify: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Бүгд");
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState("");
  const visible = users.filter((user) => user.email.toLowerCase().includes(query.toLowerCase()) && (filter === "Бүгд" || user.plan === filter));
  const updateUser = async (uid: string, patch: Partial<AppUser>) => {
    await adminFetch(`/api/admin/users/${uid}`, { method: "PATCH", body: JSON.stringify(patch) });
    await reload();
    notify("Хэрэглэгчийн мэдээлэл шинэчлэгдлээ.");
  };
  return (
    <div>
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">Хэрэглэгчид</h2>
          <p className="mt-1 text-sm text-zinc-600">Нийт {users.length.toLocaleString("mn-MN")} бүртгэлтэй хэрэглэгч</p>
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-extrabold text-black"><Icon name="plus" className="h-4 w-4" />Хэрэглэгч нэмэх</button>
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-[#141419] px-4">
          <Icon name="search" className="h-4 w-4 text-zinc-600" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Email-ээр хайх..." className="w-full bg-transparent text-sm outline-none" />
        </label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-xl border border-white/10 bg-[#141419] px-4 text-xs font-bold"><option>Бүгд</option><option>Plus</option><option>Үндсэн</option></select>
      </div>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/[.07] bg-[#141419]">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="border-b border-white/[.07] text-zinc-600"><tr>{["EMAIL", "ЭРХ", "БҮРТГҮҮЛСЭН", "ТӨЛӨВ", "ҮЙЛДЭЛ"].map((heading) => <th key={heading} className="px-5 py-4">{heading}</th>)}</tr></thead>
          <tbody>
            {visible.map((user) => (
              <tr key={user.uid} className="border-b border-white/[.05] last:border-0">
                <td className="px-5 py-5 font-bold">{user.email}</td>
                <td className="px-5">
                  <select value={user.plan} onChange={(e) => updateUser(user.uid, { plan: e.target.value as AppUser["plan"] })} className="rounded-lg bg-white/[.05] px-2 py-1 outline-none"><option>Үндсэн</option><option>Plus</option></select>
                </td>
                <td className="px-5 text-zinc-500">{user.joined}</td>
                <td className={`px-5 font-bold ${user.status === "Идэвхтэй" ? "text-emerald-400" : "text-amber-400"}`}>{user.status}</td>
                <td className="px-5"><button onClick={() => updateUser(user.uid, { status: user.status === "Идэвхтэй" ? "Түр зогссон" : "Идэвхтэй" })} className="text-zinc-500 hover:text-white">{user.status === "Идэвхтэй" ? "Түр зогсоох" : "Идэвхжүүлэх"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding && (
        <Modal onClose={() => setAdding(false)}>
          <div className="p-8">
            <h2 className="text-2xl font-black">Хэрэглэгч нэмэх</h2>
            <AdminField label="EMAIL ХАЯГ"><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="name@example.com" className="admin-input mt-6" /></AdminField>
            <button disabled={!email.includes("@")} onClick={async () => { await adminFetch("/api/admin/users", { method: "POST", body: JSON.stringify({ email }) }); setAdding(false); setEmail(""); await reload(); notify("Хэрэглэгч нэмэгдлээ."); }} className="mt-5 h-12 w-full rounded-xl bg-white text-xs font-extrabold text-black disabled:opacity-40">Нэмэх</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PaymentsAdmin({ payments, reload, notify }: { payments: Payment[]; reload: () => Promise<void>; notify: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Бүгд");
  const visible = payments.filter((payment) => (payment.id.toLowerCase().includes(query.toLowerCase()) || payment.email.toLowerCase().includes(query.toLowerCase())) && (status === "Бүгд" || payment.status === status));
  const exportCsv = () => {
    const csv = [["Дугаар", "Email", "Дүн", "Бүтээгдэхүүн", "Огноо", "Хэлбэр", "Төлөв"], ...visible.map((payment) => [payment.id, payment.email, payment.amount, payment.product, payment.date, payment.method, payment.status])].map((row) => row.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    link.download = "cinemafeel-payments.csv";
    link.click();
    notify("CSV тайлан татагдлаа.");
  };
  const refund = async (payment: Payment) => {
    await adminFetch(`/api/admin/payments/${payment.id}/refund`, { method: "POST" });
    await reload();
    notify("Төлбөр буцаагдлаа.");
  };
  return (
    <div>
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">Төлбөрүүд</h2>
          <p className="mt-1 text-sm text-zinc-600">Амжилттай орлого {formatMoney(payments.filter((payment) => payment.status === "Амжилттай").reduce((sum, payment) => sum + payment.amount, 0))}</p>
        </div>
        <button onClick={exportCsv} className="rounded-xl bg-white px-4 py-3 text-xs font-extrabold text-black">CSV тайлан татах</button>
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-[#141419] px-4">
          <Icon name="search" className="h-4 w-4 text-zinc-600" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Дугаар эсвэл email..." className="w-full bg-transparent text-sm outline-none" />
        </label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-white/10 bg-[#141419] px-4 text-xs font-bold"><option>Бүгд</option><option>Хүлээгдэж буй</option><option>Амжилттай</option><option>Буцаагдсан</option></select>
      </div>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/[.07] bg-[#141419]">
        <table className="w-full min-w-[850px] text-left text-xs">
          <thead className="border-b border-white/[.07] text-zinc-600"><tr>{["ДУГААР", "ХЭРЭГЛЭГЧ", "ДҮН", "БҮТЭЭГДЭХҮҮН", "ОГНОО", "ТӨЛӨВ", ""].map((heading) => <th key={heading} className="px-5 py-4">{heading}</th>)}</tr></thead>
          <tbody>
            {visible.map((payment) => (
              <tr key={payment.id} className="border-b border-white/[.05] last:border-0">
                <td className="px-5 py-5 font-bold">{payment.senderInvoiceNo}</td>
                <td className="px-5 text-zinc-400">{payment.email}</td>
                <td className="px-5 font-bold">{formatMoney(payment.amount)}</td>
                <td className="px-5 text-zinc-400">{payment.product}<small className="block text-zinc-700">{payment.method}</small></td>
                <td className="px-5 text-zinc-500">{payment.date}</td>
                <td className={`px-5 font-bold ${payment.status === "Амжилттай" ? "text-emerald-400" : "text-amber-400"}`}>{payment.status}</td>
                <td className="px-5">{payment.status === "Амжилттай" && <button onClick={() => refund(payment)} className="text-zinc-500 hover:text-red-400">Буцаах</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsAdmin({ settings, reload, notify }: { settings: Settings; reload: () => Promise<void>; notify: (message: string) => void }) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);
  const update = (key: keyof Settings, value: string | boolean) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => {
    await adminFetch("/api/admin/settings", { method: "PUT", body: JSON.stringify(draft) });
    await reload();
    notify("Тохиргоо амжилттай хадгалагдлаа.");
  };
  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-black">Ерөнхий тохиргоо</h2>
      <p className="mt-1 text-sm text-zinc-600">Платформын үндсэн мэдээлэл болон төлөвийг удирдана.</p>
      <div className="mt-7 space-y-5 rounded-2xl border border-white/[.07] bg-[#141419] p-6">
        <AdminField label="Платформын нэр"><input value={draft.name} onChange={(e) => update("name", e.target.value)} className="admin-input" /></AdminField>
        <AdminField label="Дэмжлэгийн email"><input value={draft.email} onChange={(e) => update("email", e.target.value)} type="email" className="admin-input" /></AdminField>
        <AdminField label="Сарын эрхийн үнэ"><input value={draft.price} onChange={(e) => update("price", e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="admin-input" /></AdminField>
        <div className="border-t border-white/[.07] pt-5">
          {([
            ["registration", "Шинэ бүртгэл зөвшөөрөх", "Хэрэглэгч Google эсвэл email-ээр шинээр бүртгүүлж болно."],
            ["notifications", "Email мэдэгдэл", "Шинэ анги болон төлбөрийн мэдээлэл илгээхэд бэлэн."],
            ["maintenance", "Засварын горим", "Хэрэглэгчдэд түр хаалттай хуудас харуулна."],
          ] as const).map(([key, label, help]) => (
            <div key={key} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-bold">{label}</p>
                <p className="mt-1 text-xs text-zinc-600">{help}</p>
              </div>
              <button onClick={() => update(key, !draft[key])} className={`relative h-6 w-11 rounded-full transition ${draft[key] ? "bg-[#ff3d56]" : "bg-zinc-700"}`}>
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${draft[key] ? "left-6" : "left-1"}`} />
              </button>
            </div>
          ))}
        </div>
        <button onClick={save} className="rounded-xl bg-white px-5 py-3 text-xs font-extrabold text-black">Өөрчлөлт хадгалах</button>
      </div>
    </div>
  );
}
