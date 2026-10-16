"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AdminRevenue, AdminSession, AppUser, Discount, Episode, Lesson, Payment, RevenueReport, SeriesWithEpisodes, Settings, StaffAdmin } from "@/lib/types";
import { isSubscriptionCheckout, revokePass } from "@/lib/entitlement";
import { CREATOR_FEE, defaultSettings } from "@/lib/types";
import { daysRemaining, formatDate, formatMoney, formatPhone, formatViews, subscriptionActive } from "@/lib/format";
import { CORNER_NAME_LIMIT, creatorCornerTitle } from "@/lib/creator-site";
import { isMature } from "@/lib/mature";
import { revenueForWindow, revenueWindow, revenueWindows, type RevenueWindow } from "@/lib/revenue";
import { CreatorGuide, creatorGuideSteps } from "./creator-guide";
import { CreatorTermsModal } from "./creator-terms-modal";
import { KnowledgeAdmin } from "./knowledge-admin";
import { YoutubeEpisodeForm } from "./youtube-episode-form";
import { AdminField, FilePicker, Icon, Logo, Modal } from "./icons";

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

type ReleaseNotice = {
  notified?: number;
  emailed?: number;
  smsed?: number;
  notifyError?: string;
  notifyPending?: string;
  telegramSent?: boolean;
  telegramError?: string;
  telegramPending?: string;
};

function releaseNote(saved: ReleaseNotice) {
  if (!saved.notified) return saved.notifyError || saved.notifyPending || "";
  const parts = [
    saved.emailed ? `${saved.emailed} имэйл` : "",
    saved.smsed ? `${saved.smsed} SMS` : "",
  ].filter(Boolean);
  const detail = parts.length ? ` (${parts.join(", ")})` : "";
  return `${saved.notified} бүртгэлтэй хэрэглэгч рүү шинэ контентийн мэдэгдэл илгээлээ${detail}.`;
}

function telegramNote(saved: ReleaseNotice) {
  const parts: string[] = [];
  if (saved.telegramSent) parts.push("Telegram сувагт шинэ ангийн мэдэгдэл илгээлээ.");
  if (saved.telegramError) parts.push(saved.telegramError);
  else if (!saved.telegramSent && saved.telegramPending) parts.push(saved.telegramPending);
  return parts.join(" ");
}

function shareHref(code: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/s/${code}`;
}

function creatorSiteHref(username: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/c/${username}`;
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

async function uploadAdminFile(file: File, kind: "poster" | "cover" | "video", seriesId: string, onProgress?: (percent: number) => void) {
  const contentType = file.type || "application/octet-stream";
  const created = await adminFetch<{ uploadUrl: string; storagePath: string }>("/api/admin/upload-url", {
    method: "POST",
    body: JSON.stringify({ kind, seriesId, contentType, fileName: file.name }),
  });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", created.uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable || event.total <= 0) return;
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      reject(new Error("Файл Firebase руу хуулагдаж чадсангүй."));
    };
    xhr.onerror = () => reject(new Error("Файл Firebase руу хуулагдаж чадсангүй."));
    xhr.send(file);
  });
  return created.storagePath;
}

export function AdminApp() {
  const [section, setSection] = useState("Хяналтын самбар");
  const [session, setSession] = useState<AdminSession | null>(null);
  const [content, setContent] = useState<SeriesWithEpisodes[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [creatorRevenue, setCreatorRevenue] = useState<RevenueReport | null>(null);
  const [revenueDays, setRevenueDays] = useState<RevenueWindow>(30);
  const [staff, setStaff] = useState<StaffAdmin[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [siteUsername, setSiteUsername] = useState("");
  const [cornerName, setCornerName] = useState("");
  const [cornerEdits, setCornerEdits] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [usersReady, setUsersReady] = useState(false);
  const [paymentsReady, setPaymentsReady] = useState(false);
  const [lessonsReady, setLessonsReady] = useState(false);
  const usersFull = useRef(false);
  const paymentsFull = useRef(false);
  const lessonsFull = useRef(false);
  const [notice, setNotice] = useState("");
  const termsAccepted = useRef(false);
  const guideDone = useRef(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsBusy, setTermsBusy] = useState(false);
  const [termsError, setTermsError] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [guideBusy, setGuideBusy] = useState(false);
  const [guideError, setGuideError] = useState("");
  const superAdmin = session?.role === "super";
  const menu = superAdmin
    ? [["Хяналтын самбар", "chart"], ["Контент", "film"], ["Мэдлэг", "play"], ["Орлого", "card"], ["Хэрэглэгчид", "users"], ["Төлбөр", "card"], ["Хөнгөлөлт", "spark"], ["Контент бүтээгчид", "users"], ["Тохиргоо", "settings"]]
    : [["Хяналтын самбар", "chart"], ["Контент", "film"], ["Мэдлэг", "play"], ["Орлого", "card"]];

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  };

  const loadCreatorRevenue = async (days: RevenueWindow) => {
    const report = await adminFetch<RevenueReport>(`/api/admin/revenue?days=${days}`);
    setCreatorRevenue(report);
  };

  const loadDirectory = async () => {
    if (usersFull.current) return;
    usersFull.current = true;
    try {
      const userData = await adminFetch<{ users: AppUser[] }>("/api/admin/users");
      setUsers(userData.users);
      setUsersReady(true);
    } catch (error) {
      usersFull.current = false;
      notify(error instanceof Error ? error.message : "Хэрэглэгчдийг ачаалж чадсангүй.");
    }
  };

  const loadPayments = async () => {
    if (paymentsFull.current) return;
    paymentsFull.current = true;
    try {
      const paymentData = await adminFetch<{ payments: Payment[] }>("/api/admin/payments");
      setPayments(paymentData.payments);
      setPaymentsReady(true);
    } catch (error) {
      paymentsFull.current = false;
      notify(error instanceof Error ? error.message : "Төлбөрийг ачаалж чадсангүй.");
    }
  };

  const refreshSeries = async () => {
    const seriesData = await adminFetch<{ series: SeriesWithEpisodes[] }>("/api/admin/series");
    setContent(seriesData.series);
    if (session?.role === "admin") await loadCreatorRevenue(revenueDays);
  };

  const refreshLessons = async () => {
    const lessonData = await adminFetch<{ lessons: Lesson[] }>("/api/admin/lessons");
    setLessons(lessonData.lessons);
  };

  const selectRevenueDays = async (days: RevenueWindow) => {
    const previous = revenueDays;
    setRevenueDays(days);
    if (session?.role === "super") return;
    try {
      await loadCreatorRevenue(days);
    } catch (error) {
      setRevenueDays(previous);
      notify(error instanceof Error ? error.message : "Орлогыг шүүж чадсангүй.");
    }
  };

  const superRevenue = useMemo(() => {
    if (session?.role !== "super") return null;
    const { since } = revenueWindow(revenueDays);
    return revenueForWindow(content, payments, staff, since);
  }, [session?.role, staff, content, payments, revenueDays]);
  const revenue = session?.role === "super" ? superRevenue : creatorRevenue;

  const acceptTerms = async () => {
    setTermsBusy(true);
    setTermsError("");
    try {
      await adminFetch("/api/admin/terms", { method: "POST" });
      termsAccepted.current = true;
      setTermsOpen(false);
      if (!guideDone.current) {
        setGuideStep(0);
        setSection("Хяналтын самбар");
        setGuideOpen(true);
      }
    } catch (error) {
      setTermsError(error instanceof Error ? error.message : "Нөхцөлийг хадгалж чадсангүй.");
    } finally {
      setTermsBusy(false);
    }
  };

  const showGuideStep = (index: number) => {
    const next = creatorGuideSteps[index];
    if (!next) return;
    setGuideStep(index);
    setSection(next.section);
  };

  const finishGuide = async () => {
    setGuideBusy(true);
    setGuideError("");
    try {
      await adminFetch("/api/admin/guide", { method: "POST" });
      guideDone.current = true;
      setGuideOpen(false);
      setSection("Хяналтын самбар");
    } catch (error) {
      setGuideError(error instanceof Error ? error.message : "Зааврыг хадгалж чадсангүй.");
    } finally {
      setGuideBusy(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    adminFetch<{
      session: AdminSession & { inviteCode?: string; username?: string; cornerName?: string; cornerNameEdits?: number; termsSeen?: boolean; guideSeen?: boolean };
      series: SeriesWithEpisodes[];
      settings: Settings;
      payments: Payment[];
      users: AppUser[];
      userCount: number;
      staff: StaffAdmin[];
      revenue: RevenueReport | null;
    }>("/api/admin/bootstrap")
      .then((data) => {
        if (ignore) return;
        const creator = data.session.role === "admin";
        setSession(data.session);
        setInviteCode(data.session.inviteCode || "");
        setSiteUsername(data.session.username || "");
        setCornerName(data.session.cornerName || "");
        setCornerEdits(Number(data.session.cornerNameEdits || 0));
        if (!termsAccepted.current) setTermsOpen(creator && data.session.termsSeen !== true);
        if (!guideDone.current && creator && data.session.termsSeen === true && data.session.guideSeen !== true) setGuideOpen(true);
        setContent(data.series);
        setSettings(data.settings);
        setPayments(data.payments);
        setUsers(data.users);
        setUserCount(data.userCount);
        setStaff(data.staff);
        setCreatorRevenue(data.revenue);
        setReady(true);
      })
      .catch((error: Error) => {
        if (!ignore) notify(error.message);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || session?.role !== "super") return;
    if (section === "Хэрэглэгчид") void loadDirectory();
    if (section === "Төлбөр" || section === "Хэрэглэгчид" || section === "Контент бүтээгчид") void loadPayments();
    if ((section === "Мэдлэг" || section === "Контент бүтээгчид") && !lessonsFull.current) {
      lessonsFull.current = true;
      refreshLessons()
        .then(() => setLessonsReady(true))
        .catch((error: Error) => {
          lessonsFull.current = false;
          notify(error.message);
        });
    }
  }, [ready, section, session?.role]);

  const guiding = guideOpen && !termsOpen;
  const [pageSize, setPageSizeState] = useState<AdminPageSize>(20);
  useEffect(() => setPageSizeState(readAdminPageSize()), []);
  const setPageSize = (size: AdminPageSize) => {
    setPageSizeState(size);
    window.localStorage.setItem(adminPageSizeKey, String(size));
  };
  if (!ready) return <main className="grid min-h-screen place-items-center bg-[#0c0c0f] text-sm text-zinc-500">Ачааллаж байна...</main>;

  return (
    <AdminPageSizeContext.Provider value={{ pageSize, setPageSize }}>
    <div className="min-h-screen bg-[#0c0c0f] text-white">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/[.07] bg-[#101014] p-5 lg:block">
        <Logo href="/" />
        <p className="mt-9 px-3 text-[10px] font-black uppercase tracking-[.2em] text-zinc-600">Удирдлага</p>
        <nav className="mt-3 space-y-1">
          {menu.map(([label, icon]) => (
            <button key={label} onClick={() => (guiding ? showGuideStep(creatorGuideSteps.findIndex((item) => item.section === label)) : setSection(label))} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold ${section === label ? "bg-white text-black" : "text-zinc-500 hover:bg-white/5 hover:text-white"} ${guiding && creatorGuideSteps[guideStep]?.section === label ? "ring-2 ring-[#ff536a]" : ""}`}>
              <Icon name={icon} className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        <a href={siteUsername && !superAdmin ? `/c/${siteUsername}` : "/"} className="absolute bottom-6 left-5 right-5 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-zinc-500 hover:text-white">
          <Icon name="logout" className="h-4 w-4" />
          {siteUsername && !superAdmin ? "Миний сайт" : "Сайт руу буцах"}
        </a>
      </aside>
      <main className="lg:ml-64">
        <header className="flex h-20 items-center justify-between border-b border-white/[.07] px-5 md:px-8">
          <div>
            <p className="text-xs text-zinc-600">{settings.name} · {superAdmin ? "Super admin" : session?.name || "Контент бүтээгч"}</p>
            <h1 className="mt-1 text-lg font-black">{section}</h1>
          </div>
          <div className="flex items-center gap-3">
            <a href={siteUsername && !superAdmin ? `/c/${siteUsername}` : "/"} className="text-xs font-bold text-zinc-500 lg:hidden">{siteUsername && !superAdmin ? "Миний сайт" : "Сайт руу буцах"}</a>
            <button onClick={() => fetch("/api/admin/logout", { method: "POST" }).then(() => (window.location.href = "/admin/login"))} className="text-xs font-bold text-zinc-500">Гарах</button>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#ff3d56] text-xs font-black">{(superAdmin ? "S" : session?.name || "A").slice(0, 1).toUpperCase()}</span>
          </div>
        </header>
        <div className={`p-5 md:p-8 ${guiding ? "pb-96" : ""}`}>
          <div className="scrollbar-none mb-6 flex gap-2 overflow-x-auto lg:hidden">
            {menu.map(([label]) => (
              <button key={label} onClick={() => (guiding ? showGuideStep(creatorGuideSteps.findIndex((item) => item.section === label)) : setSection(label))} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${section === label ? "bg-white text-black" : "border border-white/10 text-zinc-500"} ${guiding && creatorGuideSteps[guideStep]?.section === label ? "ring-2 ring-[#ff536a]" : ""}`}>{label}</button>
            ))}
          </div>
          {section === "Хяналтын самбар" && superAdmin && <Dashboard content={content} users={users} payments={payments} userCount={usersReady ? users.length : userCount} />}
          {section === "Хяналтын самбар" && session && !superAdmin && <AdminHome content={content} mine={revenue?.admins[0]} days={revenueDays} inviteCode={inviteCode} username={siteUsername} cornerName={cornerName} cornerEdits={cornerEdits} onCorner={(name, edits) => { setCornerName(name); setCornerEdits(edits); }} notify={notify} />}
          {section === "Контент" && <ContentAdmin content={content} genres={settings.genres} showOwner={superAdmin} canManageGenres={superAdmin} refreshSeries={refreshSeries} onGenres={(genres) => setSettings((current) => ({ ...current, genres }))} onStatus={async (film) => {
            const status = film.status === "Нийтлэгдсэн" ? "Ноорог" : "Нийтлэгдсэн";
            const saved = await adminFetch<ReleaseNotice>(`/api/admin/series/${film.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
            setContent((current) => current.map((item) => item.id === film.id ? { ...item, status } : item));
            return saved;
          }} notify={notify} />}
          {section === "Мэдлэг" && lessonsReady && <KnowledgeAdmin lessons={lessons} manage={superAdmin} reload={refreshLessons} notify={notify} />}
          {section === "Мэдлэг" && !lessonsReady && <p className="text-sm text-zinc-500">Ачааллаж байна...</p>}
          {section === "Орлого" && <RevenueAdmin revenue={revenue} showOwners={superAdmin} days={revenueDays} onDays={selectRevenueDays} />}
          {section === "Хэрэглэгчид" && superAdmin && usersReady && paymentsReady && <UsersAdmin users={users} payments={payments} content={content} onUsers={setUsers} notify={notify} />}
          {section === "Хэрэглэгчид" && superAdmin && (!usersReady || !paymentsReady) && <p className="text-sm text-zinc-500">Ачааллаж байна...</p>}
          {section === "Хөнгөлөлт" && superAdmin && <DiscountsAdmin notify={notify} />}
          {section === "Төлбөр" && superAdmin && paymentsReady && <PaymentsAdmin payments={payments} notify={notify} onRefunded={(payment) => {
            setPayments((current) => current.map((item) => item.id === payment.id ? { ...item, status: "Буцаагдсан" } : item));
            if (isSubscriptionCheckout(payment.mode)) {
              const revoked = revokePass();
              setUsers((current) => current.map((user) => user.uid === payment.uid ? { ...user, ...revoked } : user));
            }
            if (payment.mode === "creator" && payment.creatorId) setStaff((current) => current.map((admin) => admin.id === payment.creatorId ? { ...admin, active: false, paid: false } : admin));
          }} />}
          {section === "Төлбөр" && superAdmin && !paymentsReady && <p className="text-sm text-zinc-500">Ачааллаж байна...</p>}
          {section === "Контент бүтээгчид" && superAdmin && <StaffAdmin staff={staff} content={content} lessons={lessons} revenue={revenue} payments={payments} onStaff={setStaff} notify={notify} />}
          {section === "Тохиргоо" && superAdmin && <SettingsAdmin settings={settings} onSaved={setSettings} notify={notify} />}
        </div>
      </main>
      {termsOpen && <CreatorTermsModal busy={termsBusy} error={termsError} onAccept={acceptTerms} />}
      {guiding && <CreatorGuide step={guideStep} busy={guideBusy} error={guideError} onStep={showGuideStep} onDone={finishGuide} />}
      {notice && (
        <div className="fixed bottom-6 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-extrabold text-black shadow-2xl">
          <Icon name="check" className="h-4 w-4 text-emerald-600" />
          {notice}
        </div>
      )}
    </div>
    </AdminPageSizeContext.Provider>
  );
}

function userLabel(user: AppUser) {
  return user.email || (user.phone ? formatPhone(user.phone) : user.displayName || "—");
}

function remainingTone(days: number) {
  if (days <= 0) return "text-zinc-500";
  if (days <= 3) return "text-amber-400";
  return "text-emerald-400";
}

const adminPageSizes = [10, 20, 50, 100] as const;
type AdminPageSize = (typeof adminPageSizes)[number];
const adminPageSizeKey = "cinemafeel-admin-page-size";

function readAdminPageSize(): AdminPageSize {
  if (typeof window === "undefined") return 20;
  const stored = Number(window.localStorage.getItem(adminPageSizeKey));
  return adminPageSizes.includes(stored as AdminPageSize) ? (stored as AdminPageSize) : 20;
}

const AdminPageSizeContext = createContext<{ pageSize: AdminPageSize; setPageSize: (size: AdminPageSize) => void }>({
  pageSize: 20,
  setPageSize: () => undefined,
});

function usePaged<T>(items: T[], resetKey = "") {
  const { pageSize, setPageSize } = useContext(AdminPageSizeContext);
  const [page, setPage] = useState(1);
  const resetToken = `${resetKey}|${pageSize}`;
  const [token, setToken] = useState(resetToken);
  let currentPage = page;
  if (token !== resetToken) {
    setToken(resetToken);
    currentPage = 1;
    if (page !== 1) setPage(1);
  }
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(currentPage, pages);
  const start = (current - 1) * pageSize;
  return {
    rows: items.slice(start, start + pageSize),
    page: current,
    pages,
    pageSize,
    setPage,
    setPageSize,
    total: items.length,
    from: items.length ? start + 1 : 0,
    to: Math.min(start + pageSize, items.length),
  };
}

function pageWindow(page: number, pages: number) {
  const marks = [1, pages, page - 1, page, page + 1].filter((item, index, list) => item >= 1 && item <= pages && list.indexOf(item) === index).sort((a, b) => a - b);
  const window: Array<number | "gap"> = [];
  marks.forEach((item, index) => {
    if (index > 0 && item - marks[index - 1] > 1) window.push("gap");
    window.push(item);
  });
  return window;
}

function PageSizeSetting() {
  const { pageSize, setPageSize } = useContext(AdminPageSizeContext);
  return (
    <div className="border-t border-white/[.07] pt-5">
      <AdminField label="ХУУДСАНД ХАРУУЛАХ МӨР">
        <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) as AdminPageSize)} className="admin-input">
          {adminPageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </AdminField>
      <p className="mt-2 text-xs text-zinc-600">Хэрэглэгч, төлбөр, контент, орлого болон бүтээгчийн жагсаалтад нэг хуудсанд гарах мөр. Сонголт энэ хөтөч дээр хадгалагдана.</p>
    </div>
  );
}

function TablePager({ pager }: { pager: ReturnType<typeof usePaged<unknown>> }) {
  if (!pager.total) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-zinc-500">{pager.from}–{pager.to} / {pager.total.toLocaleString("mn-MN")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs font-bold text-zinc-500">
          Хуудсанд
          <select value={pager.pageSize} onChange={(event) => pager.setPageSize(Number(event.target.value) as AdminPageSize)} className="rounded-lg border border-white/10 bg-[#141419] px-2 py-2 text-white outline-none">
            {adminPageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <button type="button" disabled={pager.page <= 1} onClick={() => pager.setPage(pager.page - 1)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 disabled:opacity-30">Өмнөх</button>
        {pageWindow(pager.page, pager.pages).map((item, index) => item === "gap" ? (
          <span key={`gap-${index}`} className="px-1 text-xs text-zinc-600">…</span>
        ) : (
          <button key={item} type="button" onClick={() => pager.setPage(item)} className={`grid h-9 min-w-9 place-items-center rounded-lg px-2 text-xs font-bold ${item === pager.page ? "bg-white text-black" : "border border-white/10 text-zinc-400"}`}>{item}</button>
        ))}
        <button type="button" disabled={pager.page >= pager.pages} onClick={() => pager.setPage(pager.page + 1)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 disabled:opacity-30">Дараах</button>
      </div>
    </div>
  );
}

const CHART_DAY = 24 * 60 * 60 * 1000;

function startOfLocalDay(time: number) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function chartMoney(amount: number) {
  return `₮${Math.round(amount).toLocaleString("mn-MN")}`;
}

function salesInRange(payments: Payment[], start: number, end: number) {
  let amount = 0;
  let count = 0;
  for (const payment of payments) {
    if (payment.createdAt < start || payment.createdAt >= end) continue;
    amount += payment.amount;
    count += 1;
  }
  return { amount, count };
}

function daySales(payments: Payment[], since: number, now: number) {
  const first = startOfLocalDay(since);
  const last = startOfLocalDay(now);
  const count = Math.round((last - first) / CHART_DAY) + 1;
  return Array.from({ length: count }, (_, index) => {
    const start = first + index * CHART_DAY;
    const date = new Date(start);
    const label = `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
    return { key: String(start), label, start, ...salesInRange(payments, start, start + CHART_DAY) };
  });
}

function hourSales(payments: Payment[], dayStart: number) {
  const hour = 60 * 60 * 1000;
  return Array.from({ length: 24 }, (_, index) => {
    const start = dayStart + index * hour;
    return { key: String(start), label: `${String(index).padStart(2, "0")}:00`, start, ...salesInRange(payments, start, start + hour) };
  });
}

function SalesChart({ title, hint, total, buckets, labelEvery }: { title: string; hint: string; total: number; buckets: { key: string; label: string; amount: number; count: number }[]; labelEvery: number }) {
  const max = Math.max(...buckets.map((bucket) => bucket.amount), 1);
  const sales = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black">{title}</h3>
          <p className="mt-1 text-xs text-zinc-600">{hint}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-black">{chartMoney(total)}</p>
          <p className="mt-1 text-[10px] text-zinc-600">{sales} борлуулалт</p>
        </div>
      </div>
      <div className="mt-2 overflow-x-auto px-2 pt-9">
        <div className="flex h-40 items-end gap-1" style={{ minWidth: Math.max(buckets.length * 22, 280) }}>
          {buckets.map((bucket, index) => (
            <div key={bucket.key} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end">
              <div className="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-[#0c0c0f] px-2 py-1 text-[10px] font-bold text-white group-hover:block">
                {bucket.label} · {chartMoney(bucket.amount)} · {bucket.count}
              </div>
              <div className="w-full rounded-t-md bg-gradient-to-t from-[#ff3d56]/25 to-[#ff536a]" style={{ height: `${bucket.amount ? Math.max(6, (bucket.amount / max) * 100) : 2}%`, opacity: bucket.amount ? 1 : 0.35 }} title={`${bucket.label} · ${chartMoney(bucket.amount)} · ${bucket.count} борлуулалт`} />
              <span className={`mt-2 h-3 text-[9px] text-zinc-600 ${index % labelEvery === 0 ? "" : "invisible"}`}>{bucket.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Dashboard({ content, users, payments, userCount }: { content: SeriesWithEpisodes[]; users: AppUser[]; payments: Payment[]; userCount: number }) {
  const [range, setRange] = useState("7");
  const [hourDay, setHourDay] = useState(() => startOfLocalDay(Date.now()));
  const days = Number(range);
  const now = Date.now();
  const since = now - days * CHART_DAY;
  const recent = payments.filter((payment) => payment.createdAt >= since && payment.status === "Амжилттай");
  const revenue = recent.reduce((sum, payment) => sum + payment.amount, 0);
  const daysChart = daySales(recent, since, now);
  const selectedDay = daysChart.some((bucket) => bucket.start === hourDay) ? hourDay : (daysChart.at(-1)?.start ?? startOfLocalDay(now));
  const hoursChart = hourSales(recent, selectedDay);
  const monthly = users
    .filter((user) => user.plan === "Plus")
    .slice()
    .sort((a, b) => {
      const aLeft = daysRemaining(a.subscriptionExpiresAt);
      const bLeft = daysRemaining(b.subscriptionExpiresAt);
      if ((aLeft > 0) !== (bLeft > 0)) return aLeft > 0 ? -1 : 1;
      if (aLeft > 0) return aLeft - bLeft;
      return (b.subscriptionExpiresAt ?? 0) - (a.subscriptionExpiresAt ?? 0);
    });
  const activeMonthly = users.filter((user) => subscriptionActive(user)).length;
  const monthlyPage = usePaged(monthly, range);
  const stats = [
    ["Нийт орлого", `₮${Math.round(revenue).toLocaleString("mn-MN")}`, `${recent.length} гүйлгээ`, "chart"],
    ["Идэвхтэй эрх", activeMonthly.toString(), `${userCount} хэрэглэгч`, "users"],
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-black">Борлуулалтын орлого</h2>
              <p className="mt-1 text-xs text-zinc-600">Сүүлийн {range} хоногийн амжилттай гүйлгээ</p>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-500">
              Цагийн өдөр
              <select value={selectedDay} onChange={(event) => setHourDay(Number(event.target.value))} className="rounded-lg border border-white/10 bg-[#0c0c0f] px-3 py-2 text-xs font-bold text-white outline-none">
                {daysChart.map((bucket) => <option key={bucket.key} value={bucket.start}>{formatDate(bucket.start)}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-6 space-y-8">
            <SalesChart title="Өдрөөр" hint="Өдөр бүрийн орлого" total={daysChart.reduce((sum, bucket) => sum + bucket.amount, 0)} buckets={daysChart} labelEvery={daysChart.length > 16 ? Math.ceil(daysChart.length / 8) : 1} />
            <SalesChart title="Цагаар" hint={`${formatDate(selectedDay)} өдрийн цаг бүр`} total={hoursChart.reduce((sum, bucket) => sum + bucket.amount, 0)} buckets={hoursChart} labelEvery={3} />
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
      <div className="mt-5 rounded-2xl border border-white/[.07] bg-[#141419] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-black">Сарын эрх</h2>
            <p className="mt-1 text-xs text-zinc-600">Сарын эрх авсан хэрэглэгчийн үлдсэн хоног</p>
          </div>
          <span className="text-xs text-zinc-500">{activeMonthly} идэвхтэй</span>
        </div>
        <div className="mt-5 divide-y divide-white/[.05]">
          {monthlyPage.rows.map((user) => {
            const left = daysRemaining(user.subscriptionExpiresAt);
            return (
              <div key={user.uid} className="flex items-center gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{userLabel(user)}</p>
                  <p className="mt-1 text-[10px] text-zinc-600">{user.subscriptionExpiresAt ? `Дуусах: ${formatDate(user.subscriptionExpiresAt)}` : "Хугацаа тохируулаагүй"}</p>
                </div>
                <span className={`ml-auto shrink-0 text-xs font-bold ${remainingTone(left)}`}>{left > 0 ? `${left} хоног` : "Дууссан"}</span>
              </div>
            );
          })}
          {!monthly.length && <p className="text-sm text-zinc-600">Сарын эрхтэй хэрэглэгч алга.</p>}
        </div>
        <TablePager pager={monthlyPage} />
      </div>
    </>
  );
}

function AdminHome({ content, mine, days, inviteCode, username, cornerName, cornerEdits, onCorner, notify }: { content: SeriesWithEpisodes[]; mine?: AdminRevenue; days: RevenueWindow; inviteCode: string; username: string; cornerName: string; cornerEdits: number; onCorner: (cornerName: string, edits: number) => void; notify: (message: string) => void }) {
  const title = creatorCornerTitle(username, cornerName);
  const [draft, setDraft] = useState(title);
  const [savingCorner, setSavingCorner] = useState(false);
  const remaining = Math.max(0, CORNER_NAME_LIMIT - cornerEdits);
  const referrals = mine?.referrals ?? [];
  const stats = [
    ["Миний орлого", formatMoney(mine?.total ?? 0), "шууд 80% + сарын хувь + урилга", "card"],
    ["Шууд борлуулалт", formatMoney(mine?.direct ?? 0), "таны контентын үнийн 80%", "film"],
    ["Сарын эрхийн хувь", formatMoney(mine?.subscriptionShare ?? 0), `${(mine?.sharePercent ?? 0).toFixed(1)}% · ${formatViews(mine?.uniqueViews ?? 0)} үзэлт`, "chart"],
    ["Урилгын орлого", formatMoney(mine?.referral ?? 0), "урьсан бүтээгчийн борлуулалтын 10%", "users"],
  ];
  return (
    <>
      <h2 className="text-2xl font-black">Миний тойм</h2>
      <p className="mt-1 text-sm text-zinc-600">Сүүлийн {days} хоногийн орлого. Шууд борлуулалтын 80% танд, 20% платформд. Сарын эрхийн 50%-ийг нийт үзэлтээр хуваана. {content.length} контент.</p>
      {inviteCode && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[.07] bg-[#141419] px-5 py-4">
          <div>
            <p className="text-xs font-bold text-zinc-500">Таны урилгын код</p>
            <p className="mt-1 font-black tracking-[0.22em]">{inviteCode}</p>
          </div>
          <button onClick={() => copyText(inviteCode).then((copied) => notify(copied ? "Урилгын код хуулагдлаа." : "Кодыг гараар хуулна уу."))} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-zinc-300">Хуулах</button>
        </div>
      )}
      {username && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[.07] bg-[#141419] px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-zinc-500">Таны хуваалцах сайт</p>
            <p className="mt-1 truncate font-bold">{creatorSiteHref(username)}</p>
          </div>
          <div className="flex gap-2">
            <a href={`/c/${username}`} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-zinc-300">Нээх</a>
            <button onClick={() => copyText(creatorSiteHref(username)).then((copied) => notify(copied ? "Сайтын линк хуулагдлаа." : "Линкийг гараар хуулна уу."))} className="rounded-xl bg-white px-4 py-2 text-xs font-extrabold text-black">Хуулах</button>
          </div>
        </div>
      )}
      {username && (
        <div className="mt-5 rounded-2xl border border-white/[.07] bg-[#141419] px-5 py-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="min-w-0 flex-1">
              <span className="text-xs font-bold text-zinc-500">Кино булангийн нэр</span>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} disabled={remaining === 0} maxLength={40} className="admin-input mt-2" />
            </label>
            <button
              disabled={savingCorner || remaining === 0 || draft.trim().replace(/\s+/g, " ") === title}
              onClick={() => {
                setSavingCorner(true);
                adminFetch<{ cornerName: string; title: string; edits: number; remaining: number }>("/api/admin/corner", { method: "POST", body: JSON.stringify({ cornerName: draft }) })
                  .then((saved) => {
                    onCorner(saved.cornerName, saved.edits);
                    setDraft(saved.title);
                    notify(saved.edits === cornerEdits ? "Нэр хэвээрээ байна." : "Кино булангийн нэр солигдлоо.");
                  })
                  .catch((error: Error) => notify(error.message))
                  .finally(() => setSavingCorner(false));
              }}
              className="rounded-xl bg-white px-4 py-2 text-xs font-extrabold text-black disabled:opacity-40"
            >
              {savingCorner ? "Хадгалж байна..." : "Нэр солих"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-600">{remaining === 0 ? "2 удаа сольсон тул нэр түгжигдлээ." : `Одоо: ${title}. ${remaining} удаа солих боломжтой.`}</p>
        </div>
      )}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
      <div className="mt-5 rounded-2xl border border-white/[.07] bg-[#141419] p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-black">Урилгаар орж ирсэн орлого</h3>
          <span className="text-sm font-black">{formatMoney(mine?.referral ?? 0)}</span>
        </div>
        <p className="mt-1 text-xs text-zinc-600">Таны кодоор бүртгүүлсэн бүтээгчийн шууд борлуулалтын 10%. Сарын эрхэд хамаарахгүй.</p>
        <div className="mt-4 divide-y divide-white/[.06]">
          {referrals.map((item) => (
            <div key={item.creatorId} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-bold">{item.name}</p>
                <p className="mt-1 text-xs text-zinc-600">Борлуулалт {formatMoney(item.gross)}</p>
              </div>
              <p className="font-black">{formatMoney(item.reward)}</p>
            </div>
          ))}
          {!referrals.length && <p className="py-6 text-center text-sm text-zinc-600">Урилгаар орсон борлуулалт алга.</p>}
        </div>
      </div>
    </>
  );
}

function ContentAdmin({ content, genres, showOwner, canManageGenres, refreshSeries, onGenres, onStatus, notify }: { content: SeriesWithEpisodes[]; genres: string[]; showOwner: boolean; canManageGenres: boolean; refreshSeries: () => Promise<void>; onGenres: (genres: string[]) => void; onStatus: (film: SeriesWithEpisodes) => Promise<ReleaseNotice>; notify: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Бүгд");
  const [editing, setEditing] = useState<SeriesWithEpisodes | "new" | null>(null);
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [genreName, setGenreName] = useState("");
  const [genreError, setGenreError] = useState("");
  const addGenre = async () => {
    setGenreError("");
    try {
      const saved = await adminFetch<{ genres: string[]; name: string; created: boolean }>("/api/admin/genres", { method: "POST", body: JSON.stringify({ name: genreName }) });
      setGenreName("");
      onGenres(saved.genres);
      notify(saved.created ? "Төрөл нэмэгдлээ." : "Энэ төрөл аль хэдийн байна.");
    } catch (cause) {
      setGenreError(cause instanceof Error ? cause.message : "Төрөл нэмэгдсэнгүй.");
    }
  };
  const removeGenre = async (name: string) => {
    setGenreError("");
    try {
      const saved = await adminFetch<{ genres: string[] }>("/api/admin/genres", { method: "DELETE", body: JSON.stringify({ name }) });
      onGenres(saved.genres);
      notify("Төрөл хасагдлаа.");
    } catch (cause) {
      setGenreError(cause instanceof Error ? cause.message : "Төрөл хасагдсангүй.");
    }
  };
  const visible = content.filter((film) => film.title.toLowerCase().includes(query.toLowerCase()) && (filter === "Бүгд" || film.status === filter));
  const list = usePaged(visible, `${query}|${filter}`);
  const toggleStatus = async (film: SeriesWithEpisodes) => {
    try {
      const saved = await onStatus(film);
      const email = releaseNote(saved);
      const extra = [email, telegramNote(saved)].filter(Boolean).join(" ");
      notify(extra ? `Контентын төлөв шинэчлэгдлээ. ${extra}` : "Контентын төлөв шинэчлэгдлээ.");
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Төлөв шинэчлэгдсэнгүй.");
    }
  };
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">Контентын сан</h2>
          <p className="mt-1 text-sm text-zinc-600">{content.length} цуврал · {content.reduce((sum, film) => sum + film.episodes, 0)} анги</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setYoutubeOpen(true)} className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-xs font-extrabold text-white">
            <Icon name="play" className="h-4 w-4" />
            YouTube-оос
          </button>
          <button onClick={() => setEditing("new")} className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-extrabold text-black">
            <Icon name="plus" className="h-4 w-4" />
            Шинэ контент
          </button>
        </div>
      </div>
      {canManageGenres && (
        <div className="mt-6 rounded-2xl border border-white/[.07] bg-[#141419] p-5">
          <p className="text-xs font-black uppercase tracking-[.16em] text-zinc-500">Контентийн төрөл</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {genres.map((genre) => (
              <span key={genre} className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold">
                {genre}
                <button type="button" onClick={() => removeGenre(genre)} className="text-zinc-500 hover:text-red-400" aria-label={`${genre} төрлийг хасах`}>×</button>
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input value={genreName} onChange={(e) => setGenreName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && genreName.trim() && addGenre()} placeholder="Шинэ төрөл, жишээ нь Адал явдал" className="admin-input sm:max-w-xs" />
            <button disabled={!genreName.trim()} onClick={addGenre} className="h-12 rounded-xl bg-white px-4 text-xs font-extrabold text-black disabled:opacity-40">Төрөл нэмэх</button>
          </div>
          {genreError && <p className="mt-3 text-xs text-red-400">{genreError}</p>}
        </div>
      )}
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
            <tr>{["КОНТЕНТ", "ТӨРӨЛ", ...(showOwner ? ["БҮТЭЭГЧ"] : []), "ҮНЭ", "ҮЗЭЛТ", "1 ҮЗЭЛТ", "ТӨЛӨВ", "ҮЙЛДЭЛ"].map((heading) => <th key={heading} className="px-5 py-4 font-bold">{heading}</th>)}</tr>
          </thead>
          <tbody>
            {list.rows.map((film) => (
              <tr key={film.id} className="border-b border-white/[.05] last:border-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <img src={film.image} className="h-12 w-9 rounded object-cover" alt="" />
                    <div>
                      <b className="text-sm">{film.title}</b>
                      <p className="mt-1 text-zinc-600">{film.episodes} анги</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 text-zinc-400">{film.genre}</td>
                {showOwner && <td className="px-5 text-zinc-400">{film.ownerName || "Super admin"}</td>}
                <td className="px-5 font-bold">{film.price ? formatMoney(film.price) : "Үнэгүй"}</td>
                <td className="px-5 text-zinc-400">{formatViews(film.views)}</td>
                <td className="px-5 text-zinc-400">{formatViews(film.uniqueViews || 0)}</td>
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
      <TablePager pager={list} />
      {youtubeOpen && (
        <YoutubeEpisodeForm
          content={content}
          genres={genres}
          onClose={() => setYoutubeOpen(false)}
          onSaved={async (message) => {
            setYoutubeOpen(false);
            await refreshSeries();
            notify(message);
          }}
        />
      )}
      {editing && (
        <ContentEditor
          film={editing === "new" ? null : editing}
          genres={genres}
          canAddGenre={canManageGenres}
          onGenres={onGenres}
          onClose={() => setEditing(null)}
          onSaved={async (message) => {
            setEditing(null);
            await refreshSeries();
            notify(message);
          }}
        />
      )}
    </div>
  );
}

function ContentEditor({ film, genres, canAddGenre, onGenres, onClose, onSaved }: { film: SeriesWithEpisodes | null; genres: string[]; canAddGenre: boolean; onGenres: (genres: string[]) => void; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [form, setForm] = useState({
    title: film?.title ?? "",
    genre: film?.genre ?? genres[0] ?? defaultSettings.genres[0],
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
  useEffect(() => {
    if (!film?.id) return;
    let ignore = false;
    adminFetch<{ episodes: Episode[] }>(`/api/admin/series/${film.id}/episodes`)
      .then((data) => {
        if (!ignore) setEpisodes(data.episodes);
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, [film?.id]);
  const [seriesId, setSeriesId] = useState(film?.id ?? "");
  const [shareCode, setShareCode] = useState(film?.shareCode ?? "");
  const [copied, setCopied] = useState(false);
  const [newGenre, setNewGenre] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [mailed, setMailed] = useState("");
  const mailNote = useRef("");
  const genreOptions = genres.includes(form.genre) || !form.genre ? genres : [form.genre, ...genres];
  const mature = isMature(form);
  const update = (key: string, value: string | number | boolean) => setForm((current) => {
    const next = { ...current, [key]: value };
    return isMature(next) ? { ...next, featured: false } : next;
  });
  const rememberMail = (saved: ReleaseNotice) => {
    const email = releaseNote(saved);
    const note = [email, telegramNote(saved)].filter(Boolean).join(" ");
    if (!note) return;
    mailNote.current = note;
    setMailed(note);
  };

  const saveMeta = async () => {
    setBusy("Хадгалж байна...");
    setError("");
    try {
      const payload = { ...form, access: Number(form.price) === 0 ? "free" : "paid", episodes: episodes.length || 1 };
      if (!seriesId) {
        const created = await adminFetch<ReleaseNotice & { id: string; shareCode: string }>("/api/admin/series", { method: "POST", body: JSON.stringify(payload) });
        setSeriesId(created.id);
        setShareCode(created.shareCode);
        rememberMail(created);
        setBusy("");
        return created.id;
      }
      const saved = await adminFetch<ReleaseNotice & { shareCode?: string }>(`/api/admin/series/${seriesId}`, { method: "PATCH", body: JSON.stringify(payload) });
      if (saved.shareCode) setShareCode(saved.shareCode);
      rememberMail(saved);
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
      const saved = await adminFetch<{ image: string; notified?: number; notifyError?: string; notifyPending?: string }>(`/api/admin/series/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ posterPath: storagePath }),
      });
      update("image", saved.image);
      rememberMail(saved);
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
      const saved = await adminFetch<{ cover: string; shareCode?: string; notified?: number; notifyError?: string; notifyPending?: string }>(`/api/admin/series/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ coverPath: storagePath }),
      });
      update("cover", saved.cover);
      if (saved.shareCode) setShareCode(saved.shareCode);
      rememberMail(saved);
      setBusy("");
    } catch (cause) {
      setBusy("");
      setError(cause instanceof Error ? cause.message : "Ковер хуулж чадсангүй.");
    }
  };

  const addEpisode = async (file: File, title: string, onProgress?: (percent: number) => void) => {
    const id = seriesId || (await saveMeta());
    if (!id) return false;
    setBusy("Видео Firebase руу хуулж байна...");
    setError("");
    try {
      const storagePath = await uploadAdminFile(file, "video", id, onProgress);
      const number = episodes.length + 1;
      const created = await adminFetch<ReleaseNotice & { episode: Episode }>(`/api/admin/series/${id}/episodes`, {
        method: "POST",
        body: JSON.stringify({ number, title: title || `${number}-р анги`, storagePath, duration: 0 }),
      });
      setEpisodes((current) => [...current, created.episode]);
      rememberMail(created);
      setBusy("");
      return true;
    } catch (cause) {
      setBusy("");
      setError(cause instanceof Error ? cause.message : "Видео хуулж чадсангүй.");
      return false;
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
            <select value={form.genre} onChange={(e) => update("genre", e.target.value)} className="admin-input">{genreOptions.map((genre) => <option key={genre}>{genre}</option>)}</select>
            {canAddGenre && (
              <div className="mt-2 flex gap-2">
                <input value={newGenre} onChange={(e) => setNewGenre(e.target.value)} placeholder="Шинэ төрөл" className="admin-input" />
                <button
                  type="button"
                  disabled={!newGenre.trim() || Boolean(busy)}
                  onClick={async () => {
                    setError("");
                    setBusy("Төрөл нэмж байна...");
                    try {
                      const saved = await adminFetch<{ genres: string[]; name: string; created: boolean }>("/api/admin/genres", { method: "POST", body: JSON.stringify({ name: newGenre }) });
                      update("genre", saved.name);
                      setNewGenre("");
                      setBusy("");
                      onGenres(saved.genres);
                      if (!saved.created) setError("Энэ төрөл аль хэдийн байна.");
                    } catch (cause) {
                      setBusy("");
                      setError(cause instanceof Error ? cause.message : "Төрөл нэмэгдсэнгүй.");
                    }
                  }}
                  className="h-12 shrink-0 rounded-xl border border-white/10 px-3 text-xs font-bold text-zinc-300 disabled:opacity-40"
                >
                  Нэмэх
                </button>
              </div>
            )}
          </AdminField>
          <AdminField label="Үнэ (0 = үнэгүй)"><input value={form.price} onChange={(e) => update("price", Number(e.target.value))} type="number" min="0" className="admin-input" /></AdminField>
          <AdminField label="Он"><input value={form.year} onChange={(e) => update("year", Number(e.target.value))} type="number" className="admin-input" /></AdminField>
          <AdminField label="Нас">
            <select value={form.age} onChange={(e) => update("age", e.target.value)} className="admin-input">
              {(["13+", "16+", "18+"].includes(form.age) ? ["13+", "16+", "18+"] : [form.age, "13+", "16+", "18+"]).map((age) => <option key={age}>{age}</option>)}
            </select>
          </AdminField>
          <div className="sm:col-span-2">
            <AdminField label="Тайлбар"><textarea value={form.description} onChange={(e) => update("description", e.target.value)} className="admin-input h-24 py-3" /></AdminField>
          </div>
          <AdminField label="Постерын URL"><input value={form.image} onChange={(e) => update("image", e.target.value)} className="admin-input" /></AdminField>
          <AdminField label="Постер файл"><FilePicker accept="image/jpeg,image/png,image/webp" buttonLabel="Зураг сонгох" emptyLabel="Зураг сонгоогүй" onFile={(file) => file && onPoster(file)} /></AdminField>
          <div className="sm:col-span-2">
            <AdminField label="Вэбсайт ковер">
              {mature ? (
                <p className="rounded-xl border border-white/10 px-4 py-3 text-xs leading-5 text-zinc-500">+18 контент нүүрний ковер дээр гарахгүй. Постер нь зөвхөн +18 ангилалд харагдана.</p>
              ) : (
                <>
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
                    {form.cover ? (
                      <img src={form.cover} alt="" className="aspect-[21/9] w-full object-cover" />
                    ) : (
                      <div className="grid aspect-[21/9] place-items-center px-6 text-center text-xs text-zinc-600">Нүүр хуудсын өргөн ковер. Онцлох контент дээр харагдана.</div>
                    )}
                  </div>
                  <FilePicker accept="image/jpeg,image/png,image/webp" buttonLabel="Ковер сонгох" emptyLabel="Ковер сонгоогүй" onFile={(file) => file && onCover(file)} />
                </>
              )}
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
            <select value={mature || !form.featured ? "Үгүй" : "Тийм"} disabled={mature} onChange={(e) => update("featured", e.target.value === "Тийм")} className="admin-input disabled:opacity-40"><option>Үгүй</option><option>Тийм</option></select>
          </AdminField>
        </div>
        <div className="mt-8">
          <h3 className="text-sm font-black">Ангиуд</h3>
          <div className="mt-3 space-y-2">
            {episodes.map((episode) => (
              <div key={episode.id} className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-sm">
                <span>{episode.number}. {episode.title} {episode.source === "youtube" ? "· YouTube" : episode.storagePath ? "" : "· видеогүй"}</span>
                <button onClick={() => removeEpisode(episode)} className="text-xs font-bold text-red-400">Устгах</button>
              </div>
            ))}
          </div>
          <EpisodeUpload onUpload={addEpisode} />
        </div>
        {busy && <p className="mt-4 text-xs font-bold text-[#ff6679]">{busy}</p>}
        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
        {mailed && <p className="mt-3 rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-zinc-300">{mailed}</p>}
        <div className="mt-7 flex flex-wrap justify-between gap-3">
          {seriesId ? (
            <button onClick={async () => { await adminFetch(`/api/admin/series/${seriesId}`, { method: "DELETE" }); await onSaved("Контент устгагдлаа."); }} className="rounded-xl border border-red-500/20 px-5 py-3 text-xs font-bold text-red-400">Устгах</button>
          ) : <span />}
          <div className="flex gap-3">
            <button onClick={onClose} className="rounded-xl border border-white/10 px-5 py-3 text-xs font-bold text-zinc-400">Хаах</button>
            <button disabled={!form.title.trim() || Boolean(busy)} onClick={async () => { const id = await saveMeta(); if (id) await onSaved(`${film ? "Контент шинэчлэгдлээ." : "Шинэ контент нэмэгдлээ."}${mailNote.current ? ` ${mailNote.current}` : ""}`); }} className="rounded-xl bg-white px-5 py-3 text-xs font-extrabold text-black disabled:opacity-40">Хадгалах</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function EpisodeUpload({ onUpload }: { onUpload: (file: File, title: string, onProgress: (percent: number) => void) => Promise<boolean> }) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploading = progress !== null;

  const submit = async () => {
    if (!file || uploading) return;
    setProgress(0);
    const saved = await onUpload(file, title, setProgress);
    setProgress(null);
    if (!saved) return;
    setTitle("");
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="mt-4 rounded-2xl border border-dashed border-white/15 p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ангийн нэр" disabled={uploading} className="admin-input" />
        <FilePicker inputRef={inputRef} accept="video/mp4,video/webm,video/quicktime" disabled={uploading} buttonLabel="Видео сонгох" emptyLabel="Видео сонгоогүй" fileName={file?.name ?? ""} onFile={setFile} />
        <button disabled={!file || uploading} onClick={submit} className={`rounded-xl px-4 text-xs font-extrabold ${uploading ? "bg-[#ff2a2a] text-white" : "bg-white text-black disabled:opacity-40"}`}>
          {uploading ? `${progress}%` : "Видео нэмэх"}
        </button>
      </div>
      {uploading && (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#ff2a2a] transition-[width] duration-150" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs font-bold text-zinc-400">Firebase руу хуулж байна · {progress}%</p>
        </div>
      )}
    </div>
  );
}

function DetailFact({ label, children }: { label: string; children: ReactNode }) {
  const empty = children === "" || children === null || children === undefined;
  return (
    <div className="rounded-xl border border-white/[.06] bg-black/20 px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[.14em] text-zinc-600">{label}</p>
      <div className="mt-1.5 break-words text-sm font-bold text-zinc-100">{empty ? "—" : children}</div>
    </div>
  );
}

function DetailHeading({ children }: { children: ReactNode }) {
  return <h3 className="mt-8 text-xs font-black uppercase tracking-[.16em] text-zinc-500">{children}</h3>;
}

function userPayments(user: AppUser, payments: Payment[]) {
  const email = user.email?.toLowerCase() || "";
  return payments.filter((payment) => payment.uid === user.uid || (email && payment.email.toLowerCase() === email && payment.mode !== "creator"));
}

function ConfirmModal({ title, body, confirmLabel, busy, onCancel, onConfirm }: { title: string; body: string; confirmLabel: string; busy?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal onClose={onCancel} priority>
      <div className="p-8">
        <h2 className="pr-8 text-2xl font-black">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-400">{body}</p>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onCancel} className="h-12 flex-1 rounded-xl border border-white/10 text-xs font-bold text-zinc-300">Болих</button>
          <button type="button" disabled={busy} onClick={onConfirm} className="h-12 flex-1 rounded-xl bg-white text-xs font-extrabold text-black disabled:opacity-40">{confirmLabel}</button>
        </div>
      </div>
    </Modal>
  );
}

function UsersAdmin({ users, payments, content, onUsers, notify }: { users: AppUser[]; payments: Payment[]; content: SeriesWithEpisodes[]; onUsers: (update: (users: AppUser[]) => AppUser[]) => void; notify: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Бүгд");
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingPause, setPendingPause] = useState<AppUser | null>(null);
  const [busy, setBusy] = useState(false);
  const visible = users.filter((user) => `${user.displayName || ""} ${user.email || ""} ${user.phone || ""}`.toLowerCase().includes(query.toLowerCase()) && (filter === "Бүгд" || user.plan === filter));
  const list = usePaged(visible, `${query}|${filter}`);
  const selected = users.find((user) => user.uid === selectedId) ?? null;
  const updateUser = async (uid: string, patch: Partial<AppUser>) => {
    try {
      const saved = await adminFetch<{ ok: boolean } & Partial<AppUser>>(`/api/admin/users/${uid}`, { method: "PATCH", body: JSON.stringify(patch) });
      const { ok: _ok, ...fields } = saved;
      onUsers((current) => current.map((user) => user.uid === uid ? { ...user, ...fields } : user));
      notify("Хэрэглэгчийн мэдээлэл шинэчлэгдлээ.");
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Хэрэглэгч шинэчлэгдсэнгүй.");
    }
  };
  const changeStatus = (user: AppUser) => {
    if (user.status === "Идэвхтэй") setPendingPause(user);
    else void updateUser(user.uid, { status: "Идэвхтэй" });
  };
  const addUser = async () => {
    setBusy(true);
    try {
      const saved = await adminFetch<{ user: AppUser }>("/api/admin/users", { method: "POST", body: JSON.stringify({ email }) });
      onUsers((current) => [saved.user, ...current.filter((user) => user.uid !== saved.user.uid)]);
      setAdding(false);
      setEmail("");
      notify("Хэрэглэгч нэмэгдлээ.");
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Хэрэглэгч нэмэгдсэнгүй.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">Хэрэглэгчид</h2>
          <p className="mt-1 text-sm text-zinc-600">Нийт {users.length.toLocaleString("mn-MN")} бүртгэлтэй хэрэглэгч. Нэр дээр дарж дэлгэрэнгүй харна.</p>
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-extrabold text-black"><Icon name="plus" className="h-4 w-4" />Хэрэглэгч нэмэх</button>
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-[#141419] px-4">
          <Icon name="search" className="h-4 w-4 text-zinc-600" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Нэр, email эсвэл утас..." className="w-full bg-transparent text-sm outline-none" />
        </label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-xl border border-white/10 bg-[#141419] px-4 text-xs font-bold"><option>Бүгд</option><option>Plus</option><option>Үндсэн</option></select>
      </div>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/[.07] bg-[#141419]">
        <table className="w-full min-w-[920px] text-left text-xs">
          <thead className="border-b border-white/[.07] text-zinc-600"><tr>{["ХЭРЭГЛЭГЧ", "ЭРХ", "ҮЛДСЭН ХОНОГ", "БҮРТГҮҮЛСЭН", "ТӨЛӨВ", "ҮЙЛДЭЛ"].map((heading) => <th key={heading} className="px-5 py-4">{heading}</th>)}</tr></thead>
          <tbody>
            {list.rows.map((user) => {
              const left = user.plan === "Plus" ? daysRemaining(user.subscriptionExpiresAt) : null;
              const contact = user.email || (user.phone ? formatPhone(user.phone) : "");
              return (
              <tr key={user.uid} className="border-b border-white/[.05] last:border-0">
                <td className="px-5 py-5">
                  <button onClick={() => setSelectedId(user.uid)} className="text-left hover:underline">
                    <span className="font-bold">{user.displayName || contact || "—"}</span>
                    {user.displayName && contact && <small className="mt-1 block font-medium text-zinc-600">{contact}</small>}
                  </button>
                </td>
                <td className="px-5">
                  <select value={user.plan} onChange={(e) => updateUser(user.uid, { plan: e.target.value as AppUser["plan"] })} className="rounded-lg bg-white/[.05] px-2 py-1 outline-none"><option>Үндсэн</option><option>Plus</option></select>
                </td>
                <td className={`px-5 font-bold ${left === null ? "text-zinc-600" : remainingTone(left)}`}>{left === null ? "—" : left > 0 ? `${left} хоног` : "Дууссан"}</td>
                <td className="px-5 text-zinc-500">{user.joined}</td>
                <td className={`px-5 font-bold ${user.status === "Идэвхтэй" ? "text-emerald-400" : "text-amber-400"}`}>{user.status}</td>
                <td className="px-5">
                  <button onClick={() => setSelectedId(user.uid)} className="mr-3 font-bold text-white hover:text-[#ff536a]">Дэлгэрэнгүй</button>
                  <button onClick={() => changeStatus(user)} className="text-zinc-500 hover:text-white">{user.status === "Идэвхтэй" ? "Түр зогсоох" : "Идэвхжүүлэх"}</button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        {!visible.length && <p className="py-10 text-center text-sm text-zinc-600">Хэрэглэгч олдсонгүй.</p>}
      </div>
      <TablePager pager={list} />
      {adding && (
        <Modal onClose={() => setAdding(false)}>
          <div className="p-8">
            <h2 className="text-2xl font-black">Хэрэглэгч нэмэх</h2>
            <AdminField label="EMAIL ХАЯГ"><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="name@example.com" className="admin-input mt-6" /></AdminField>
            <button disabled={!email.includes("@") || busy} onClick={addUser} className="mt-5 h-12 w-full rounded-xl bg-white text-xs font-extrabold text-black disabled:opacity-40">Нэмэх</button>
          </div>
        </Modal>
      )}
      {pendingPause && (
        <ConfirmModal
          title="Хэрэглэгчийг түр зогсоох уу?"
          body={`${userLabel(pendingPause)} нэвтэрч, контент үзэж чадахгүй.`}
          confirmLabel="Түр зогсоох"
          onCancel={() => setPendingPause(null)}
          onConfirm={() => {
            const user = pendingPause;
            setPendingPause(null);
            void updateUser(user.uid, { status: "Түр зогссон" });
          }}
        />
      )}
      {selected && <UserDetail user={selected} payments={payments} content={content} onClose={() => setSelectedId(null)} onUpdate={updateUser} onStatus={changeStatus} />}
    </div>
  );
}

function UserDetail({ user, payments, content, onClose, onUpdate, onStatus }: { user: AppUser; payments: Payment[]; content: SeriesWithEpisodes[]; onClose: () => void; onUpdate: (uid: string, patch: Partial<AppUser>) => Promise<void>; onStatus: (user: AppUser) => void }) {
  const history = userPayments(user, payments);
  const spent = history.filter((payment) => payment.status === "Амжилттай").reduce((sum, payment) => sum + payment.amount, 0);
  const left = user.plan === "Plus" ? daysRemaining(user.subscriptionExpiresAt) : null;
  const contact = user.email || (user.phone ? formatPhone(user.phone) : "");
  const owned = new Map<string, { id: string; title: string; date: string; amount: number }>();
  for (const payment of history) {
    if (payment.status !== "Амжилттай" || !payment.seriesId || owned.has(payment.seriesId)) continue;
    const series = content.find((item) => item.id === payment.seriesId);
    owned.set(payment.seriesId, { id: payment.seriesId, title: series?.title || payment.product, date: payment.date, amount: payment.amount });
  }
  return (
    <Modal onClose={onClose} size="xl">
      <div className="max-h-[85vh] overflow-y-auto p-6 md:p-8">
        <div className="flex items-center gap-4 pr-10">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-xl font-black text-black">{(user.displayName || contact || "Х").slice(0, 1).toUpperCase()}</span>
          )}
          <div>
            <h2 className="text-2xl font-black">{user.displayName || contact || "Хэрэглэгч"}</h2>
            <p className={`mt-1 text-xs font-bold ${user.status === "Идэвхтэй" ? "text-emerald-400" : "text-amber-400"}`}>{user.plan} · {user.status}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DetailFact label="Нэр">{user.displayName}</DetailFact>
          <DetailFact label="Email">{user.email}</DetailFact>
          <DetailFact label="Утас">{user.phone ? formatPhone(user.phone) : ""}</DetailFact>
          <DetailFact label="Эрх">{user.plan}</DetailFact>
          <DetailFact label="Үлдсэн хоног">{left === null ? "—" : left > 0 ? `${left} хоног` : "Дууссан"}</DetailFact>
          <DetailFact label="Эрх дуусах">{user.plan === "Plus" && user.subscriptionExpiresAt ? formatDate(user.subscriptionExpiresAt) : ""}</DetailFact>
          <DetailFact label="Бүртгүүлсэн">{user.joined}</DetailFact>
          <DetailFact label="Төлөв">{user.status}</DetailFact>
          <DetailFact label="Нийт төлбөр">{formatMoney(spent)}</DetailFact>
          <DetailFact label="Хэрэглэгчийн ID"><span className="font-mono text-xs font-medium text-zinc-400">{user.uid}</span></DetailFact>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <select value={user.plan} onChange={(e) => onUpdate(user.uid, { plan: e.target.value as AppUser["plan"] })} className="rounded-xl border border-white/10 bg-[#141419] px-4 py-3 text-xs font-bold outline-none"><option>Үндсэн</option><option>Plus</option></select>
          <button onClick={() => onStatus(user)} className="rounded-xl border border-white/10 px-4 py-3 text-xs font-bold text-zinc-300 hover:text-white">{user.status === "Идэвхтэй" ? "Түр зогсоох" : "Идэвхжүүлэх"}</button>
        </div>
        <DetailHeading>Авсан контент</DetailHeading>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-white/[.07]">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className="border-b border-white/[.07] text-zinc-600"><tr>{["КОНТЕНТ", "ДҮН", "ОГНОО"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
            <tbody>
              {[...owned.values()].map((item) => (
                <tr key={item.id} className="border-b border-white/[.05] last:border-0">
                  <td className="px-4 py-3 font-bold">{item.title}</td>
                  <td className="px-4 py-3">{formatMoney(item.amount)}</td>
                  <td className="px-4 py-3 text-zinc-500">{item.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!owned.size && <p className="py-8 text-center text-sm text-zinc-600">Авсан контент алга.</p>}
        </div>
        <DetailHeading>Төлбөрийн түүх</DetailHeading>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-white/[.07]">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="border-b border-white/[.07] text-zinc-600"><tr>{["ДУГААР", "БҮТЭЭГДЭХҮҮН", "ДҮН", "ОГНОО", "ТӨЛӨВ"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
            <tbody>
              {history.map((payment) => (
                <tr key={payment.id} className="border-b border-white/[.05] last:border-0">
                  <td className="px-4 py-3 font-bold">{payment.senderInvoiceNo || payment.id}</td>
                  <td className="px-4 py-3 text-zinc-400">{payment.product}</td>
                  <td className="px-4 py-3">{formatMoney(payment.amount)}</td>
                  <td className="px-4 py-3 text-zinc-500">{payment.date}</td>
                  <td className={`px-4 py-3 font-bold ${payment.status === "Амжилттай" ? "text-emerald-400" : "text-amber-400"}`}>{payment.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!history.length && <p className="py-8 text-center text-sm text-zinc-600">Төлбөр алга.</p>}
        </div>
      </div>
    </Modal>
  );
}

function PaymentsAdmin({ payments, notify, onRefunded }: { payments: Payment[]; notify: (message: string) => void; onRefunded: (payment: Payment) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Бүгд");
  const [pending, setPending] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(false);
  const visible = payments.filter((payment) => (payment.id.toLowerCase().includes(query.toLowerCase()) || payment.email.toLowerCase().includes(query.toLowerCase())) && (status === "Бүгд" || payment.status === status));
  const list = usePaged(visible, `${query}|${status}`);
  const exportCsv = () => {
    const csv = [["Дугаар", "Email", "Дүн", "Бүтээгдэхүүн", "Огноо", "Хэлбэр", "Төлөв"], ...visible.map((payment) => [payment.id, payment.email, payment.amount, payment.product, payment.date, payment.method, payment.status])].map((row) => row.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    link.download = "cinemafeel-payments.csv";
    link.click();
    notify("CSV тайлан татагдлаа.");
  };
  const refund = async (payment: Payment) => {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/payments/${payment.id}/refund`, { method: "POST" });
      onRefunded(payment);
      setPending(null);
      notify("Төлбөр буцаагдлаа.");
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Төлбөр буцаагдсангүй.");
    } finally {
      setBusy(false);
    }
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
            {list.rows.map((payment) => (
              <tr key={payment.id} className="border-b border-white/[.05] last:border-0">
                <td className="px-5 py-5 font-bold">{payment.senderInvoiceNo}</td>
                <td className="px-5 text-zinc-400">{payment.email}</td>
                <td className="px-5 font-bold">{formatMoney(payment.amount)}</td>
                <td className="px-5 text-zinc-400">{payment.product}<small className="block text-zinc-700">{payment.method}</small></td>
                <td className="px-5 text-zinc-500">{payment.date}</td>
                <td className={`px-5 font-bold ${payment.status === "Амжилттай" ? "text-emerald-400" : "text-amber-400"}`}>{payment.status}</td>
                <td className="px-5">{payment.status === "Амжилттай" && <button onClick={() => setPending(payment)} className="text-zinc-500 hover:text-red-400">Буцаах</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && <p className="py-10 text-center text-sm text-zinc-600">Төлбөр олдсонгүй.</p>}
      </div>
      <TablePager pager={list} />
      {pending && (
        <ConfirmModal
          title="Төлбөр буцаах уу?"
          body={`${pending.email || "Хэрэглэгч"} · ${pending.product} · ${formatMoney(pending.amount)}. Буцаасан төлбөрийн эрх, худалдан авалт хаагдана.`}
          confirmLabel="Буцаах"
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => refund(pending)}
        />
      )}
    </div>
  );
}

function DiscountsAdmin({ notify }: { notify: (message: string) => void }) {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("10");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Discount | null>(null);

  const load = async () => {
    const data = await adminFetch<{ discounts: Discount[] }>("/api/admin/discounts");
    setDiscounts(data.discounts);
  };

  useEffect(() => {
    load().catch((error: Error) => notify(error.message));
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      const saved = await adminFetch<{ discount: Discount }>("/api/admin/discounts", {
        method: "POST",
        body: JSON.stringify({ code, percent: Number(percent) }),
      });
      setDiscounts((current) => [saved.discount, ...current.filter((item) => item.code !== saved.discount.code)]);
      setCode("");
      notify("Хөнгөлөлтийн код үүслээ.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Код үүсгэж чадсангүй.");
    } finally {
      setBusy(false);
    }
  };

  const update = async (discount: Discount, patch: { percent?: number; active?: boolean }) => {
    try {
      const saved = await adminFetch<{ discount: Discount }>("/api/admin/discounts", {
        method: "PATCH",
        body: JSON.stringify({ code: discount.code, ...patch }),
      });
      setDiscounts((current) => current.map((item) => item.code === saved.discount.code ? saved.discount : item));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Код засагдсангүй.");
    }
  };

  const remove = async (discount: Discount) => {
    setBusy(true);
    try {
      await adminFetch("/api/admin/discounts", { method: "DELETE", body: JSON.stringify({ code: discount.code }) });
      setDiscounts((current) => current.filter((item) => item.code !== discount.code));
      setPending(null);
      notify("Код устлаа.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Код устсангүй.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-black">Хөнгөлөлтийн код</h2>
      <p className="mt-1 max-w-3xl text-sm text-zinc-600">Код нь сарын эрх, 7 хоног, нэгж киноны төлбөрт үйлчилнэ. Хувиар 1–99. Бүтээгчийн бүртгэлийн хураамжид хамаарахгүй.</p>
      <div className="mt-7 grid gap-4 rounded-2xl border border-white/[.07] bg-[#141419] p-6 md:grid-cols-[1fr_140px_auto] md:items-end">
        <AdminField label="Код">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20))} placeholder="PLUS20" className="admin-input uppercase" />
        </AdminField>
        <AdminField label="Хувь">
          <input value={percent} onChange={(e) => setPercent(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" className="admin-input" />
        </AdminField>
        <button disabled={busy} onClick={create} className="h-11 rounded-xl bg-white px-5 text-xs font-extrabold text-black disabled:opacity-60">Код үүсгэх</button>
      </div>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/[.07]">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="bg-white/[.03] text-[10px] uppercase tracking-[.16em] text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-bold">Код</th>
              <th className="px-5 py-3 font-bold">Хувь</th>
              <th className="px-5 py-3 font-bold">Төлөв</th>
              <th className="px-5 py-3 font-bold">Ашигласан</th>
              <th className="px-5 py-3 font-bold" />
            </tr>
          </thead>
          <tbody>
            {discounts.map((discount) => (
              <tr key={discount.code} className="border-t border-white/[.06]">
                <td className="px-5 py-4 font-black tracking-[.12em]">{discount.code}</td>
                <td className="px-5 py-4">
                  <input
                    defaultValue={discount.percent}
                    key={`${discount.code}-${discount.percent}`}
                    onBlur={(e) => {
                      const next = Number(e.target.value);
                      if (next !== discount.percent) void update(discount, { percent: next });
                    }}
                    inputMode="numeric"
                    className="h-9 w-20 rounded-lg border border-white/10 bg-transparent px-3 outline-none"
                  />
                </td>
                <td className="px-5 py-4">
                  <button onClick={() => update(discount, { active: !discount.active })} className={`rounded-full px-3 py-1 text-[10px] font-black ${discount.active ? "bg-emerald-400/15 text-emerald-400" : "bg-white/10 text-zinc-400"}`}>
                    {discount.active ? "Идэвхтэй" : "Унтраалттай"}
                  </button>
                </td>
                <td className="px-5 py-4 text-zinc-400">{discount.usedCount}</td>
                <td className="px-5 py-4 text-right">
                  <button onClick={() => setPending(discount)} className="font-bold text-red-400">Устгах</button>
                </td>
              </tr>
            ))}
            {!discounts.length && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-sm text-zinc-500">Хөнгөлөлтийн код алга.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pending && (
        <ConfirmModal
          title="Код устгах уу?"
          body={`${pending.code} · ${pending.percent}%. Өмнөх төлбөр хэвээр үлдэнэ.`}
          confirmLabel="Устгах"
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => remove(pending)}
        />
      )}
    </div>
  );
}

function SettingsAdmin({ settings, onSaved, notify }: { settings: Settings; onSaved: (settings: Settings) => void; notify: (message: string) => void }) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);
  const update = (key: keyof Settings, value: string | boolean) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => {
    try {
      await adminFetch("/api/admin/settings", { method: "PUT", body: JSON.stringify(draft) });
      onSaved(draft);
      notify("Тохиргоо амжилттай хадгалагдлаа.");
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Тохиргоо хадгалагдсангүй.");
    }
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
            ["registration", "Шинэ бүртгэл зөвшөөрөх", "Хэрэглэгч Google, email эсвэл утасны дугаараар шинээр бүртгүүлж болно."],
            ["notifications", "Контентын мэдэгдэл", "Шинэ контент нийтлэхэд имэйлтэй хэрэглэгчид киноны линк илгээнэ. Имэйл байхгүй бол утас руу SMS явна."],
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
        <PageSizeSetting />
        <button onClick={save} className="rounded-xl bg-white px-5 py-3 text-xs font-extrabold text-black">Өөрчлөлт хадгалах</button>
      </div>
    </div>
  );
}

function RevenueAdmin({ revenue, showOwners, days, onDays }: { revenue: RevenueReport | null; showOwners: boolean; days: RevenueWindow; onDays: (days: RevenueWindow) => Promise<void> }) {
  const rows = revenue?.rows ?? [];
  const admins = revenue?.admins ?? [];
  const adminPage = usePaged(admins, String(days));
  const rowPage = usePaged(rows, String(days));
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">Орлого</h2>
          <p className="mt-1 max-w-3xl text-sm text-zinc-600">
            Сүүлийн {days} хоногийн төлбөр. Шууд борлуулалтын 80% бүтээгчид. Сарын эрхийн 50%-ийг нийт давтагдаагүй үзэлтээр хуваана. Урилга нь шууд борлуулалтын 10%.
          </p>
        </div>
        <div className="flex gap-2">
          {revenueWindows.map((option) => (
            <button key={option} type="button" onClick={() => onDays(option)} className={`rounded-full px-4 py-2 text-xs font-bold ${days === option ? "bg-white text-black" : "border border-white/10 text-zinc-400"}`}>{option} хоног</button>
          ))}
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[.07] bg-[#141419] p-5">
          <p className="text-xs font-bold text-zinc-500">{showOwners ? "Сарын эрхийн 50%" : "Сарын эрхийн хувь"}</p>
          <p className="mt-3 text-2xl font-black">{showOwners ? formatMoney(revenue?.subscriptionPool ?? 0) : formatMoney(admins[0]?.subscriptionShare ?? 0)}</p>
          <p className="mt-2 text-xs text-zinc-600">{showOwners ? `Нийт ${formatMoney(revenue?.subscriptionGross ?? 0)}` : `${(admins[0]?.sharePercent ?? 0).toFixed(1)}% үзэлт`}</p>
        </div>
        <div className="rounded-2xl border border-white/[.07] bg-[#141419] p-5">
          <p className="text-xs font-bold text-zinc-500">{showOwners ? "Платформын хувь" : "Шууд борлуулалт"}</p>
          <p className="mt-3 text-2xl font-black">{showOwners ? formatMoney((revenue?.platformSubscription ?? 0) + (revenue?.platformDirect ?? 0)) : formatMoney(admins[0]?.direct ?? 0)}</p>
          <p className="mt-2 text-xs text-zinc-600">{showOwners ? "сарын 50% + шууд хураамж" : "борлуулалтын 80%"}</p>
        </div>
        <div className="rounded-2xl border border-white/[.07] bg-[#141419] p-5">
          <p className="text-xs font-bold text-zinc-500">Урилгын урамшуулал</p>
          <p className="mt-3 text-2xl font-black">{formatMoney(showOwners ? revenue?.referralPaid ?? 0 : admins[0]?.referral ?? 0)}</p>
          <p className="mt-2 text-xs text-zinc-600">{showOwners ? `${formatViews(revenue?.totalUniqueViews ?? 0)} давтагдаагүй үзэлт` : "урьсан бүтээгчийн борлуулалтын 10%"}</p>
        </div>
      </div>
      {showOwners && (
        <>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-white/[.07] bg-[#141419]">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="border-b border-white/[.07] text-zinc-600">
              <tr>{["БҮТЭЭГЧ", "КОНТЕНТ", "1 ҮЗЭЛТ", "ХУВЬ", "ШУУД 80%", "САРЫН ЭРХ", "УРИЛГА", "НИЙТ"].map((heading) => <th key={heading} className="px-5 py-4">{heading}</th>)}</tr>
            </thead>
            <tbody>
              {adminPage.rows.map((admin) => (
                <tr key={admin.adminId} className="border-b border-white/[.05] last:border-0">
                  <td className="px-5 py-4 font-bold">{admin.name}</td>
                  <td className="px-5 text-zinc-400">{admin.contentCount}</td>
                  <td className="px-5 text-zinc-400">{admin.uniqueViews}</td>
                  <td className="px-5 text-zinc-400">{admin.sharePercent.toFixed(1)}%</td>
                  <td className="px-5">{formatMoney(admin.direct)}</td>
                  <td className="px-5">{formatMoney(admin.subscriptionShare)}</td>
                  <td className="px-5">{formatMoney(admin.referral)}</td>
                  <td className="px-5 font-bold">{formatMoney(admin.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!admins.length && <p className="py-10 text-center text-sm text-zinc-600">Орлого алга.</p>}
        </div>
        <TablePager pager={adminPage} />
        </>
      )}
      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/[.07] bg-[#141419]">
        <table className="w-full min-w-[1040px] text-left text-xs">
          <thead className="border-b border-white/[.07] text-zinc-600">
            <tr>{["КОНТЕНТ", ...(showOwners ? ["БҮТЭЭГЧ"] : []), "1 ҮЗЭЛТ", "ХУВЬ", "БОРЛУУЛАЛТ", "БҮТЭЭГЧ 80%", "САРЫН ЭРХ", "НИЙТ"].map((heading) => <th key={heading} className="px-5 py-4">{heading}</th>)}</tr>
          </thead>
          <tbody>
            {rowPage.rows.map((row) => (
              <tr key={row.seriesId} className="border-b border-white/[.05] last:border-0">
                <td className="px-5 py-4 font-bold">{row.title}</td>
                {showOwners && <td className="px-5 text-zinc-400">{row.ownerName}</td>}
                <td className="px-5 text-zinc-400">{row.uniqueViews}</td>
                <td className="px-5 text-zinc-400">{row.sharePercent.toFixed(1)}%</td>
                <td className="px-5 text-zinc-400">{formatMoney(row.gross)}</td>
                <td className="px-5">{formatMoney(row.direct)}</td>
                <td className="px-5">{formatMoney(row.subscriptionShare)}</td>
                <td className="px-5 font-bold">{formatMoney(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="py-10 text-center text-sm text-zinc-600">Контент алга.</p>}
      </div>
      <TablePager pager={rowPage} />
    </div>
  );
}

function StaffAdmin({ staff, content, lessons, revenue, payments, onStaff, notify }: { staff: StaffAdmin[]; content: SeriesWithEpisodes[]; lessons: Lesson[]; revenue: RevenueReport | null; payments: Payment[]; onStaff: (update: (staff: StaffAdmin[]) => StaffAdmin[]) => void; notify: (message: string) => void }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingClose, setPendingClose] = useState<StaffAdmin | null>(null);
  const selected = staff.find((admin) => admin.id === selectedId) ?? null;
  const list = usePaged(staff);
  const create = async () => {
    setError("");
    try {
      const saved = await adminFetch<{ admin: StaffAdmin }>("/api/admin/staff", { method: "POST", body: JSON.stringify({ name, username, password }) });
      onStaff((current) => [saved.admin, ...current.filter((admin) => admin.id !== saved.admin.id)]);
      setName("");
      setUsername("");
      setPassword("");
      notify("Контент бүтээгч нэмэгдлээ.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Контент бүтээгч нэмэгдсэнгүй.");
    }
  };
  const patch = async (id: string, body: { active?: boolean; password?: string }) => {
    try {
      await adminFetch(`/api/admin/staff/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      if (typeof body.active === "boolean") onStaff((current) => current.map((admin) => admin.id === id ? { ...admin, active: body.active as boolean } : admin));
      notify(body.password ? "Нууц үг шинэчлэгдлээ." : "Контент бүтээгчийн төлөв шинэчлэгдлээ.");
      return true;
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Бүтээгч шинэчлэгдсэнгүй.");
      return false;
    }
  };
  const requestActive = (admin: StaffAdmin) => {
    if (admin.active) setPendingClose(admin);
    else void patch(admin.id, { active: true });
  };
  return (
    <div>
      <h2 className="text-2xl font-black">Контент бүтээгчид</h2>
      <p className="mt-1 text-sm text-zinc-600">Бүртгэлийн {formatMoney(CREATOR_FEE)} төлсөн бүтээгч админ хуудсыг шууд ашиглана. Super admin гараар нэмсэн бүтээгч төлбөргүй идэвхтэй. Нэр дээр дарж дэлгэрэнгүй харна.</p>
      <div className="mt-6 grid gap-3 rounded-2xl border border-white/[.07] bg-[#141419] p-5 md:grid-cols-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Нэр" className="admin-input" />
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Нэвтрэх нэр" className="admin-input" autoCapitalize="none" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Нууц үг" type="password" className="admin-input" />
        <button disabled={!name.trim() || !username.trim() || password.length < 6} onClick={create} className="rounded-xl bg-white text-xs font-extrabold text-black disabled:opacity-40">Бүтээгч нэмэх</button>
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/[.07] bg-[#141419]">
        <table className="w-full min-w-[1040px] text-left text-xs">
          <thead className="border-b border-white/[.07] text-zinc-600">
            <tr>{["НЭР", "НЭВТРЭХ НЭР", "УРИЛГЫН КОД", "ХОЛБОО", "ДАНС", "ТӨЛБӨР", "ТӨЛӨВ", "ҮЙЛДЭЛ"].map((heading) => <th key={heading} className="px-5 py-4">{heading}</th>)}</tr>
          </thead>
          <tbody>
            <tr className="border-b border-white/[.05]">
              <td className="px-5 py-4 font-bold">Super admin</td>
              <td className="px-5 text-zinc-400">орчны тохиргоо</td>
              <td className="px-5 text-zinc-500">—</td>
              <td className="px-5 text-zinc-500">—</td>
              <td className="px-5 text-zinc-500">—</td>
              <td className="px-5 text-zinc-500">—</td>
              <td className="px-5 font-bold text-emerald-400">Бүх эрх</td>
              <td className="px-5 text-zinc-600">өөрчлөхгүй</td>
            </tr>
            {list.rows.map((admin) => (
              <tr key={admin.id} className="border-b border-white/[.05] last:border-0">
                <td className="px-5 py-4">
                  <button onClick={() => setSelectedId(admin.id)} className="text-left font-bold hover:underline">{admin.name}</button>
                  {admin.contentType && <small className="mt-1 block font-medium text-zinc-600">{admin.contentType}</small>}
                  {admin.invitedByName && <small className="mt-1 block font-medium text-zinc-600">Урьсан: {admin.invitedByName}</small>}
                </td>
                <td className="px-5 text-zinc-400">{admin.username}</td>
                <td className="px-5 font-bold tracking-wider text-zinc-300">{admin.inviteCode || "—"}</td>
                <td className="px-5 text-zinc-500">{admin.phone ? formatPhone(admin.phone) : "—"}{admin.email && <small className="block text-zinc-600">{admin.email}</small>}</td>
                <td className="px-5 text-zinc-400">{admin.bankAccount ? <><span className="font-bold tracking-wide text-zinc-200">{admin.bankAccount}</span>{admin.bankName && <small className="block text-zinc-600">{admin.bankName}</small>}</> : "—"}</td>
                <td className={`px-5 font-bold ${admin.source === "self" && !admin.paid ? "text-amber-400" : "text-zinc-400"}`}>{admin.source === "self" ? (admin.paid ? formatMoney(CREATOR_FEE) : "Хүлээгдэж буй") : "Гараар"}</td>
                <td className={`px-5 font-bold ${admin.active ? "text-emerald-400" : "text-amber-400"}`}>{admin.active ? "Идэвхтэй" : "Хаалттай"}</td>
                <td className="px-5">
                  <button onClick={() => setSelectedId(admin.id)} className="mr-3 font-bold text-white hover:text-[#ff536a]">Дэлгэрэнгүй</button>
                  <button onClick={() => requestActive(admin)} className="font-bold text-zinc-500 hover:text-white">{admin.active ? "Хаах" : "Нээх"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePager pager={list} />
      {selected && (
        <CreatorDetail
          admin={selected}
          staff={staff}
          content={content}
          lessons={lessons}
          revenue={revenue?.admins.find((item) => item.adminId === selected.id) ?? null}
          payments={payments}
          onClose={() => setSelectedId(null)}
          onToggle={() => requestActive(selected)}
          onPassword={(password) => patch(selected.id, { password })}
        />
      )}
      {pendingClose && (
        <ConfirmModal
          title="Бүтээгчийг хаах уу?"
          body={`${pendingClose.name} админ хуудсанд нэвтэрч чадахгүй.`}
          confirmLabel="Хаах"
          onCancel={() => setPendingClose(null)}
          onConfirm={() => {
            const admin = pendingClose;
            setPendingClose(null);
            void patch(admin.id, { active: false });
          }}
        />
      )}
    </div>
  );
}

function safeLink(value: string) {
  if (!/^https?:\/\//i.test(value)) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function CreatorDetail({ admin, staff, content, lessons, revenue, payments, onClose, onToggle, onPassword }: { admin: StaffAdmin; staff: StaffAdmin[]; content: SeriesWithEpisodes[]; lessons: Lesson[]; revenue: AdminRevenue | null; payments: Payment[]; onClose: () => void; onToggle: () => void; onPassword: (password: string) => Promise<boolean> }) {
  const [password, setPassword] = useState("");
  const series = content.filter((item) => item.ownerId === admin.id);
  const ownLessons = lessons.filter((item) => item.ownerId === admin.id);
  const invitees = staff.filter((item) => item.id !== admin.id && (item.invitedById ? item.invitedById === admin.id : Boolean(admin.name) && item.invitedByName === admin.name));
  const feePayments = payments.filter((payment) => payment.creatorId === admin.id || payment.uid === `creator:${admin.id}`);
  const portfolio = safeLink(admin.portfolio);
  const fullName = [admin.lastName, admin.firstName].filter(Boolean).join(" ");
  const savePassword = async () => {
    if (await onPassword(password)) setPassword("");
  };
  return (
    <Modal onClose={onClose} size="xl">
      <div className="max-h-[85vh] overflow-y-auto p-6 md:p-8">
        <div className="pr-10">
          <h2 className="text-2xl font-black">{admin.name || "Контент бүтээгч"}</h2>
          <p className={`mt-1 text-xs font-bold ${admin.active ? "text-emerald-400" : "text-amber-400"}`}>{admin.active ? "Идэвхтэй" : "Хаалттай"} · {admin.source === "self" ? "Өөрөө бүртгүүлсэн" : "Гараар нэмсэн"}</p>
          {admin.active && admin.username && <a href={`/c/${admin.username}`} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-bold text-[#ff536a] hover:underline">Нээлттэй хуудас · /c/{admin.username}</a>}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DetailFact label="Овог, нэр">{fullName}</DetailFact>
          <DetailFact label="Нэвтрэх нэр">{admin.username}</DetailFact>
          <DetailFact label="Кино булан">{creatorCornerTitle(admin.username, admin.cornerName)} · {Math.max(0, CORNER_NAME_LIMIT - admin.cornerNameEdits)} солих эрх</DetailFact>
          <DetailFact label="Контентын төрөл">{admin.contentType}</DetailFact>
          <DetailFact label="Утас">{admin.phone ? formatPhone(admin.phone) : ""}</DetailFact>
          <DetailFact label="Email">{admin.email}</DetailFact>
          <DetailFact label="Бүртгэсэн">{admin.createdAt ? formatDate(admin.createdAt) : ""}</DetailFact>
          <DetailFact label="Банк">{admin.bankName}</DetailFact>
          <DetailFact label="Данс">{admin.bankAccount}</DetailFact>
          <DetailFact label="Бүртгэлийн төлбөр">{admin.source === "self" ? (admin.paid ? formatMoney(CREATOR_FEE) : "Хүлээгдэж буй") : "Гараар, төлбөргүй"}</DetailFact>
          <DetailFact label="Урилгын код"><span className="tracking-[.2em]">{admin.inviteCode}</span></DetailFact>
          <DetailFact label="Урьсан бүтээгч">{admin.invitedByName}{admin.invitedByCode ? ` · ${admin.invitedByCode}` : ""}</DetailFact>
          <DetailFact label="Нөхцөл зөвшөөрсөн">{admin.termsAcceptedAt ? formatDate(admin.termsAcceptedAt) : ""}</DetailFact>
          <DetailFact label="Шууд 80%">{formatMoney(revenue?.direct ?? 0)}</DetailFact>
          <DetailFact label="Сарын эрх">{formatMoney(revenue?.subscriptionShare ?? 0)}</DetailFact>
          <DetailFact label="Урилга">{formatMoney(revenue?.referral ?? 0)}</DetailFact>
          <DetailFact label="Нийт орлого">{formatMoney(revenue?.total ?? 0)}</DetailFact>
          <DetailFact label="Контент">{series.length}</DetailFact>
          <DetailFact label="Давтагдаагүй үзэлт">{revenue?.uniqueViews ?? series.reduce((sum, item) => sum + item.uniqueViews, 0)}</DetailFact>
        </div>
        {admin.portfolio && (
          <>
            <DetailHeading>Портфолио</DetailHeading>
            {portfolio ? <a href={portfolio} target="_blank" rel="noreferrer" className="mt-3 block text-sm font-bold text-[#ff536a] hover:underline">{portfolio}</a> : <p className="mt-3 text-sm text-zinc-400">{admin.portfolio}</p>}
          </>
        )}
        {admin.experience && (
          <>
            <DetailHeading>Туршлага</DetailHeading>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{admin.experience}</p>
          </>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button onClick={onToggle} className="rounded-xl border border-white/10 px-4 py-3 text-xs font-bold text-zinc-300 hover:text-white">{admin.active ? "Хаах" : "Нээх"}</button>
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Шинэ нууц үг" className="admin-input sm:max-w-xs" />
          <button type="button" disabled={password.length < 6} onClick={savePassword} className="rounded-xl bg-white px-4 py-3 text-xs font-extrabold text-black disabled:opacity-40">Нууц үг солих</button>
        </div>
        <DetailHeading>Контент</DetailHeading>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-white/[.07]">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="border-b border-white/[.07] text-zinc-600"><tr>{["НЭР", "ТӨЛӨВ", "АНГИ", "1 ҮЗЭЛТ", "ҮНЭ"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
            <tbody>
              {series.map((item) => (
                <tr key={item.id} className="border-b border-white/[.05] last:border-0">
                  <td className="px-4 py-3 font-bold">{item.title}</td>
                  <td className="px-4 py-3 text-zinc-400">{item.status}</td>
                  <td className="px-4 py-3 text-zinc-400">{item.episodes}</td>
                  <td className="px-4 py-3 text-zinc-400">{item.uniqueViews}</td>
                  <td className="px-4 py-3">{item.access === "free" ? "Үнэгүй" : formatMoney(item.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!series.length && <p className="py-8 text-center text-sm text-zinc-600">Контент алга.</p>}
        </div>
        <DetailHeading>Мэдлэг</DetailHeading>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-white/[.07]">
          {ownLessons.map((lesson) => (
            <p key={lesson.id} className="border-b border-white/[.05] px-4 py-3 text-sm font-bold last:border-0">{lesson.title}</p>
          ))}
          {!ownLessons.length && <p className="py-8 text-center text-sm text-zinc-600">Мэдлэгийн хичээл алга.</p>}
        </div>
        <DetailHeading>Урьсан бүтээгчид</DetailHeading>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-white/[.07]">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead className="border-b border-white/[.07] text-zinc-600"><tr>{["НЭР", "НЭВТРЭХ НЭР", "ТӨЛӨВ"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
            <tbody>
              {invitees.map((item) => (
                <tr key={item.id} className="border-b border-white/[.05] last:border-0">
                  <td className="px-4 py-3 font-bold">{item.name}</td>
                  <td className="px-4 py-3 text-zinc-400">{item.username}</td>
                  <td className={`px-4 py-3 font-bold ${item.active ? "text-emerald-400" : "text-amber-400"}`}>{item.active ? "Идэвхтэй" : "Хаалттай"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!invitees.length && <p className="py-8 text-center text-sm text-zinc-600">Урьсан бүтээгч алга.</p>}
        </div>
        {(revenue?.referrals.length ?? 0) > 0 && (
          <>
            <DetailHeading>Урилгын орлого</DetailHeading>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-white/[.07]">
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead className="border-b border-white/[.07] text-zinc-600"><tr>{["БҮТЭЭГЧ", "БОРЛУУЛАЛТ", "10%"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
                <tbody>
                  {revenue?.referrals.map((item) => (
                    <tr key={item.creatorId} className="border-b border-white/[.05] last:border-0">
                      <td className="px-4 py-3 font-bold">{item.name}</td>
                      <td className="px-4 py-3 text-zinc-400">{formatMoney(item.gross)}</td>
                      <td className="px-4 py-3">{formatMoney(item.reward)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <DetailHeading>Бүртгэлийн төлбөр</DetailHeading>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-white/[.07]">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className="border-b border-white/[.07] text-zinc-600"><tr>{["ДУГААР", "ДҮН", "ОГНОО", "ТӨЛӨВ"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
            <tbody>
              {feePayments.map((payment) => (
                <tr key={payment.id} className="border-b border-white/[.05] last:border-0">
                  <td className="px-4 py-3 font-bold">{payment.senderInvoiceNo || payment.id}</td>
                  <td className="px-4 py-3">{formatMoney(payment.amount)}</td>
                  <td className="px-4 py-3 text-zinc-500">{payment.date}</td>
                  <td className={`px-4 py-3 font-bold ${payment.status === "Амжилттай" ? "text-emerald-400" : "text-amber-400"}`}>{payment.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!feePayments.length && <p className="py-8 text-center text-sm text-zinc-600">Бүртгэлийн төлбөр алга.</p>}
        </div>
      </div>
    </Modal>
  );
}
