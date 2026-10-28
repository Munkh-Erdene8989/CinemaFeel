"use client";

import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AdminRevenue, AdminSession, AppUser, Discount, Episode, Expense, ExpenseCategory, ExpenseFrequency, Lesson, Payment, RevenueReport, SeriesWithEpisodes, Settings, StaffAdmin } from "@/lib/types";
import { isSubscriptionCheckout, revokePass } from "@/lib/entitlement";
import { CREATOR_FEE, defaultSettings, expenseCategories, expenseIntervals } from "@/lib/types";
import { currentExpenseMonth, expenseCategoryTotals, expenseFrequencyLabel, EXPENSE_RECEIPT_LIMIT } from "@/lib/expenses";
import { daysRemaining, formatDate, formatMoney, formatPhone, formatViews, subscriptionActive } from "@/lib/format";
import { CORNER_NAME_LIMIT, creatorCornerTitle } from "@/lib/creator-site";
import { isMature } from "@/lib/mature";
import { playableMp4 } from "@/lib/mp4-faststart";
import { bandWeight, type ActivityReport, type ActivityViewer, type ActivityWindowDays } from "@/lib/activity";
import { revenueWindows, type RevenueWindow } from "@/lib/revenue";
import type { SalaryLine, SalaryReport } from "@/lib/salary";
import { CreatorGuide, creatorGuideSteps } from "./creator-guide";
import { CreatorTermsModal } from "./creator-terms-modal";
import { KnowledgeAdmin } from "./knowledge-admin";
import { YoutubeEpisodeForm } from "./youtube-episode-form";
import { AdminField, FilePicker, Icon, ImageDrop, Logo, Modal } from "./icons";

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

type AdminMenuEntry = { label: string; icon: string; superOnly?: boolean };

const adminMenuGroups: { label: string; items: AdminMenuEntry[] }[] = [
  {
    label: "Статистик",
    items: [
      { label: "Хяналтын самбар", icon: "chart" },
      { label: "Идэвх", icon: "spark", superOnly: true },
    ],
  },
  {
    label: "Контент",
    items: [
      { label: "Контент", icon: "film" },
      { label: "Мэдлэг", icon: "play" },
    ],
  },
  {
    label: "Санхүү",
    items: [
      { label: "Орлого", icon: "card" },
      { label: "Зардал", icon: "card", superOnly: true },
      { label: "Цалин", icon: "card" },
      { label: "Төлбөр", icon: "card", superOnly: true },
      { label: "Хөнгөлөлт", icon: "spark", superOnly: true },
    ],
  },
  {
    label: "Community",
    items: [
      { label: "Хэрэглэгчид", icon: "users", superOnly: true },
      { label: "Контент бүтээгчид", icon: "users", superOnly: true },
    ],
  },
];

const adminMenuExtras: AdminMenuEntry[] = [
  { label: "Маркетинг", icon: "mail", superOnly: true },
  { label: "Тохиргоо", icon: "settings", superOnly: true },
];

function visibleAdminMenu(superAdmin: boolean) {
  const allowed = (item: AdminMenuEntry) => superAdmin || !item.superOnly;
  return {
    groups: adminMenuGroups
      .map((group) => ({ label: group.label, items: group.items.filter(allowed) }))
      .filter((group) => group.items.length > 0),
    extras: adminMenuExtras.filter(allowed),
  };
}

function AdminMenu({
  groups,
  extras,
  section,
  openGroups,
  onToggle,
  onSelect,
  guideLabel,
}: {
  groups: { label: string; items: AdminMenuEntry[] }[];
  extras: AdminMenuEntry[];
  section: string;
  openGroups: string[];
  onToggle: (label: string) => void;
  onSelect: (label: string) => void;
  guideLabel?: string;
}) {
  const itemClass = (label: string) => `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold ${section === label ? "bg-white text-black" : "text-zinc-500 hover:bg-white/5 hover:text-white"} ${guideLabel === label ? "ring-2 ring-[#ff536a]" : ""}`;
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const open = openGroups.includes(group.label);
        const contains = group.items.some((item) => item.label === section || item.label === guideLabel);
        return (
          <div key={group.label}>
            <button type="button" aria-expanded={open} onClick={() => onToggle(group.label)} className={`flex w-full items-center justify-between px-3 py-1 text-[10px] font-black uppercase tracking-[.2em] ${contains ? "text-white" : "text-zinc-600 hover:text-zinc-300"}`}>
              {group.label}
              <Icon name="arrow" className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
            </button>
            {open && (
              <div className="mt-1 space-y-1">
                {group.items.map((item) => (
                  <button key={item.label} type="button" onClick={() => onSelect(item.label)} className={itemClass(item.label)}>
                    <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {extras.length > 0 && (
        <div className="space-y-1 border-t border-white/[.07] pt-3">
          {extras.map((item) => (
            <button key={item.label} type="button" onClick={() => onSelect(item.label)} className={itemClass(item.label)}>
              <Icon name={item.icon} className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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

async function uploadAdminFile(file: File, kind: "poster" | "cover" | "video" | "reel", seriesId: string, onProgress?: (percent: number) => void) {
  const contentType = file.type || "application/octet-stream";
  const body = kind === "video" || kind === "reel" ? await playableMp4(file) : file;
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
    xhr.send(body);
  });
  return created.storagePath;
}

async function uploadExpenseReceipt(file: File, target: { expenseId?: string; templateId?: string }) {
  if (file.size > EXPENSE_RECEIPT_LIMIT) throw new Error("PDF 8MB-аас бага байна.");
  if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new Error("Зөвхөн PDF хавсаргана.");
  const created = await adminFetch<{ uploadUrl: string; storagePath: string }>("/api/admin/expenses/receipt", {
    method: "POST",
    body: JSON.stringify({ ...target, contentType: "application/pdf", fileName: file.name }),
  });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", created.uploadUrl);
    xhr.setRequestHeader("Content-Type", "application/pdf");
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("PDF хуулагдаж чадсангүй.")));
    xhr.onerror = () => reject(new Error("PDF хуулагдаж чадсангүй."));
    xhr.send(file);
  });
  await adminFetch("/api/admin/expenses/receipt", {
    method: "PATCH",
    body: JSON.stringify({ ...target, receiptPath: created.storagePath, applyToEmpty: Boolean(target.templateId) }),
  });
}

export function AdminApp() {
  const [section, setSection] = useState("Хяналтын самбар");
  const [session, setSession] = useState<AdminSession | null>(null);
  const [content, setContent] = useState<SeriesWithEpisodes[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [creatorRevenue, setCreatorRevenue] = useState<RevenueReport | null>(null);
  const [ownerRevenue, setOwnerRevenue] = useState<RevenueReport | null>(null);
  const [ownerRevenueReady, setOwnerRevenueReady] = useState(false);
  const [revenueDays, setRevenueDays] = useState<RevenueWindow>(30);
  const [staff, setStaff] = useState<StaffAdmin[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [siteUsername, setSiteUsername] = useState("");
  const [cornerName, setCornerName] = useState("");
  const [cornerEdits, setCornerEdits] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState("");
  const [usersReady, setUsersReady] = useState(false);
  const [paymentsReady, setPaymentsReady] = useState(false);
  const [lessonsReady, setLessonsReady] = useState(false);
  const [salary, setSalary] = useState<SalaryReport | null>(null);
  const [salaryReady, setSalaryReady] = useState(false);
  const [activity, setActivity] = useState<ActivityReport | null>(null);
  const [activityReady, setActivityReady] = useState(false);
  const [activityError, setActivityError] = useState("");
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
  const [guideMode, setGuideMode] = useState<"full" | "salary">("full");
  const [guideBusy, setGuideBusy] = useState(false);
  const [guideError, setGuideError] = useState("");
  const [openGroups, setOpenGroups] = useState<string[]>(["Статистик"]);
  const superAdmin = session?.role === "super";
  const { groups: menuGroups, extras: menuExtras } = visibleAdminMenu(superAdmin);

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

  const revenue = session?.role === "super" ? ownerRevenue : creatorRevenue;

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

  const guideSteps = guideMode === "salary" ? creatorGuideSteps.filter((item) => item.section === "Цалин") : creatorGuideSteps;

  const showGuideStep = (index: number) => {
    const next = guideSteps[index];
    if (!next) return;
    setGuideStep(index);
    setSection(next.section);
  };

  const finishGuide = async () => {
    setGuideBusy(true);
    setGuideError("");
    try {
      await adminFetch("/api/admin/guide", { method: "POST", body: JSON.stringify({ scope: guideMode === "salary" ? "salary" : "full" }) });
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
      session: AdminSession & { inviteCode?: string; username?: string; cornerName?: string; cornerNameEdits?: number; termsSeen?: boolean; guideSeen?: boolean; salaryGuideSeen?: boolean };
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
        if (!guideDone.current && creator && data.session.termsSeen === true && data.session.guideSeen === true && data.session.salaryGuideSeen !== true) {
          setGuideMode("salary");
          setGuideStep(0);
          setSection("Цалин");
          setGuideOpen(true);
        }
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
        if (!ignore) setBootError(error.message || "Админ хуудсыг ачаалж чадсангүй.");
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

  useEffect(() => {
    if (!ready || session?.role !== "super") return;
    if (section !== "Хяналтын самбар" && section !== "Идэвх") return;
    if (activity || activityReady) return;
    let ignore = false;
    adminFetch<ActivityReport>("/api/admin/activity")
      .then((data) => {
        if (ignore) return;
        setActivity(data);
        setActivityReady(true);
      })
      .catch((error: Error) => {
        if (ignore) return;
        setActivityReady(true);
        setActivityError(error.message || "Идэвхийг ачаалж чадсангүй.");
      });
    return () => {
      ignore = true;
    };
  }, [ready, section, session?.role, activity, activityReady]);

  useEffect(() => {
    if (!ready || session?.role !== "super") return;
    if (section !== "Орлого" && section !== "Контент бүтээгчид") return;
    let ignore = false;
    setOwnerRevenueReady(false);
    adminFetch<RevenueReport>(`/api/admin/revenue?days=${revenueDays}`)
      .then((data) => {
        if (ignore) return;
        setOwnerRevenue(data);
        setOwnerRevenueReady(true);
      })
      .catch((error: Error) => {
        if (ignore) return;
        setOwnerRevenueReady(true);
        notify(error.message || "Орлогыг ачаалж чадсангүй.");
      });
    return () => {
      ignore = true;
    };
  }, [ready, section, session?.role, revenueDays]);

  useEffect(() => {
    if (!ready || section !== "Цалин") return;
    let ignore = false;
    adminFetch<SalaryReport>("/api/admin/salary")
      .then((data) => {
        if (ignore) return;
        setSalary(data);
        setSalaryReady(true);
      })
      .catch((error: Error) => {
        if (ignore) return;
        setSalaryReady(true);
        notify(error.message);
      });
    return () => {
      ignore = true;
    };
  }, [ready, section]);

  const guiding = guideOpen && !termsOpen;
  const [pageSize, setPageSizeState] = useState<AdminPageSize>(20);
  useEffect(() => setPageSizeState(readAdminPageSize()), []);
  useEffect(() => {
    const parent = adminMenuGroups.find((group) => group.items.some((item) => item.label === section))?.label;
    if (!parent) return;
    setOpenGroups((current) => (current.includes(parent) ? current : [...current, parent]));
  }, [section]);
  const toggleGroup = (label: string) => {
    setOpenGroups((current) => (current.includes(label) ? current.filter((item) => item !== label) : [...current, label]));
  };
  const selectSection = (label: string) => {
    if (guiding) {
      const index = guideSteps.findIndex((item) => item.section === label);
      if (index >= 0) showGuideStep(index);
      return;
    }
    setSection(label);
  };
  const setPageSize = (size: AdminPageSize) => {
    setPageSizeState(size);
    window.localStorage.setItem(adminPageSizeKey, String(size));
  };
  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0c0c0f] px-6 text-center text-sm text-zinc-500">
        {bootError ? (
          <div>
            <p className="font-bold text-white">{bootError}</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-bold text-black">Дахин ачаалах</button>
          </div>
        ) : (
          "Ачааллаж байна..."
        )}
      </main>
    );
  }

  return (
    <AdminPageSizeContext.Provider value={{ pageSize, setPageSize }}>
    <div className="min-h-screen bg-[#0c0c0f] text-white">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/[.07] bg-[#101014] p-5 lg:flex">
        <Logo href="/" />
        <nav className="mt-8 min-h-0 flex-1 overflow-y-auto">
          <AdminMenu groups={menuGroups} extras={menuExtras} section={section} openGroups={openGroups} onToggle={toggleGroup} onSelect={selectSection} guideLabel={guiding ? guideSteps[guideStep]?.section : undefined} />
        </nav>
        <a href={siteUsername && !superAdmin ? `/c/${siteUsername}` : "/"} className="mt-3 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-zinc-500 hover:text-white">
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
          <div className="mb-6 lg:hidden">
            <AdminMenu groups={menuGroups} extras={menuExtras} section={section} openGroups={openGroups} onToggle={toggleGroup} onSelect={selectSection} guideLabel={guiding ? guideSteps[guideStep]?.section : undefined} />
          </div>
          {section === "Хяналтын самбар" && superAdmin && <Dashboard content={content} users={users} payments={payments} userCount={usersReady ? users.length : userCount} activity={activity} activityError={activityError} onActivity={() => setSection("Идэвх")} onExpenses={() => setSection("Зардал")} />}
          {section === "Идэвх" && superAdmin && <ActivityAdmin report={activity} ready={activityReady} error={activityError} content={content} />}
          {section === "Хяналтын самбар" && session && !superAdmin && <AdminHome content={content} mine={revenue?.admins[0]} days={revenueDays} inviteCode={inviteCode} username={siteUsername} cornerName={cornerName} cornerEdits={cornerEdits} onCorner={(name, edits) => { setCornerName(name); setCornerEdits(edits); }} notify={notify} />}
          {section === "Контент" && <ContentAdmin content={content} genres={settings.genres} showOwner={superAdmin} canManageGenres={superAdmin} refreshSeries={refreshSeries} onGenres={(genres) => setSettings((current) => ({ ...current, genres }))} onStatus={async (film) => {
            const status = film.status === "Нийтлэгдсэн" ? "Ноорог" : "Нийтлэгдсэн";
            const saved = await adminFetch<ReleaseNotice>(`/api/admin/series/${film.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
            setContent((current) => current.map((item) => item.id === film.id ? { ...item, status } : item));
            return saved;
          }} notify={notify} />}
          {section === "Мэдлэг" && lessonsReady && <KnowledgeAdmin lessons={lessons} manage={superAdmin} reload={refreshLessons} notify={notify} />}
          {section === "Мэдлэг" && !lessonsReady && <p className="text-sm text-zinc-500">Ачааллаж байна...</p>}
          {section === "Орлого" && superAdmin && !ownerRevenueReady && <p className="text-sm text-zinc-500">Ачааллаж байна...</p>}
          {section === "Орлого" && (!superAdmin || ownerRevenueReady) && <RevenueAdmin revenue={revenue} showOwners={superAdmin} days={revenueDays} onDays={selectRevenueDays} />}
          {section === "Зардал" && superAdmin && <ExpensesAdmin notify={notify} />}
          {section === "Цалин" && salaryReady && salary && <SalaryAdmin report={salary} manage={superAdmin} notify={notify} onUpdated={(adminId, cycleId, paid, paidAt) => {
            setSalary((current) => current && ({
              creators: current.creators.map((creator) => creator.adminId === adminId ? {
                ...creator,
                lines: creator.lines.map((line) => line.id === cycleId ? { ...line, paid, paidAt, status: paid ? "Олгосон" : "Хүлээгдэж буй" } : line),
              } : creator),
            }));
          }} />}
          {section === "Цалин" && salaryReady && !salary && <p className="text-sm text-zinc-500">Цалин ачааллаагүй.</p>}
          {section === "Цалин" && !salaryReady && <p className="text-sm text-zinc-500">Ачааллаж байна...</p>}
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
          {section === "Маркетинг" && superAdmin && <MarketingAdmin settings={settings} onSaved={setSettings} notify={notify} />}
          {section === "Тохиргоо" && superAdmin && <SettingsAdmin settings={settings} onSaved={setSettings} notify={notify} />}
        </div>
      </main>
      {termsOpen && <CreatorTermsModal busy={termsBusy} error={termsError} onAccept={acceptTerms} />}
      {guiding && <CreatorGuide step={guideStep} steps={guideSteps} busy={guideBusy} error={guideError} onStep={showGuideStep} onDone={finishGuide} />}
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

type SignupChannel = "email" | "phone" | "both";

function userContacts(user: Pick<AppUser, "email" | "phone">) {
  const email = String(user.email || "").includes("@") ? user.email : "";
  const phone = String(user.phone || "").trim() ? formatPhone(user.phone || "") : "";
  return { email, phone };
}

function signupChannel(user: Pick<AppUser, "email" | "phone">): SignupChannel | null {
  const { email, phone } = userContacts(user);
  if (email && phone) return "both";
  if (email) return "email";
  if (phone) return "phone";
  return null;
}

const signupMeta: Record<SignupChannel, { label: string; tone: string }> = {
  email: { label: "И-мэйл", tone: "bg-violet-400/15 text-violet-300" },
  phone: { label: "Утас", tone: "bg-sky-400/15 text-sky-300" },
  both: { label: "Хоёулаа", tone: "bg-[#ff3d56]/15 text-[#ff7a8c]" },
};

function SignupBadge({ channel }: { channel: SignupChannel | null }) {
  if (!channel) return <span className="text-zinc-600">—</span>;
  const meta = signupMeta[channel];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${meta.tone}`}>{meta.label}</span>;
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

function dashMoney(amount: number) {
  const rounded = Math.round(amount);
  const text = Math.abs(rounded).toLocaleString("mn-MN");
  return rounded < 0 ? `-₮${text}` : `₮${text}`;
}

function localDateKey(time: number) {
  const date = new Date(time);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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

function Dashboard({ content, users, payments, userCount, activity, activityError, onActivity, onExpenses }: { content: SeriesWithEpisodes[]; users: AppUser[]; payments: Payment[]; userCount: number; activity: ActivityReport | null; activityError: string; onActivity: () => void; onExpenses: () => void }) {
  const [range, setRange] = useState("7");
  const [hourDay, setHourDay] = useState(() => startOfLocalDay(Date.now()));
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [expenseError, setExpenseError] = useState("");
  const days = Number(range);
  const now = Date.now();
  const since = now - days * CHART_DAY;
  const recent = payments.filter((payment) => payment.createdAt >= since && payment.status === "Амжилттай");
  const revenue = recent.reduce((sum, payment) => sum + payment.amount, 0);
  const sinceKey = localDateKey(since);
  const todayKey = localDateKey(now);
  const windowExpenses = (expenses ?? []).filter((item) => item.spentOn >= sinceKey && item.spentOn <= todayKey);
  const expenseTotal = windowExpenses.reduce((sum, item) => sum + item.amount, 0);
  const profitReady = expenses !== null && !expenseError;
  const profit = revenue - expenseTotal;
  const categories = expenseCategoryTotals(windowExpenses);
  const categoryMax = Math.max(...categories.map((item) => item.total), 1);
  const latestExpenses = windowExpenses.slice().sort((a, b) => b.spentOn.localeCompare(a.spentOn) || b.createdAt - a.createdAt).slice(0, 5);
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
  const finance = [
    ["Нийт орлого", dashMoney(revenue), `${recent.length} гүйлгээ`, "chart", "text-white"],
    ["Зардал", profitReady ? dashMoney(expenseTotal) : expenseError ? "—" : "…", expenseError || (profitReady ? `${windowExpenses.length} бүртгэл` : "Ачааллаж байна"), "card", "text-[#ff6679]"],
    ["Ашиг", profitReady ? dashMoney(profit) : expenseError ? "—" : "…", "орлого − зардал", "spark", profitReady && profit < 0 ? "text-[#ff6679]" : "text-emerald-400"],
  ] as const;
  const stats = [
    ["Идэвхтэй эрх", activeMonthly.toString(), `${userCount} хэрэглэгч`, "users"],
    ["Нийт үзэлт", formatViews(content.reduce((sum, film) => sum + film.views, 0)), "бодит тоолуур", "play"],
    ["Контент", content.length.toString(), `${content.filter((film) => film.status === "Нийтлэгдсэн").length} нийтлэгдсэн`, "film"],
  ];

  useEffect(() => {
    let active = true;
    adminFetch<{ expenses: Expense[] }>("/api/admin/expenses?month=all")
      .then((data) => {
        if (active) setExpenses(data.expenses);
      })
      .catch((error: Error) => {
        if (!active) return;
        setExpenseError(error.message || "Зардлыг ачаалж чадсангүй.");
      });
    return () => {
      active = false;
    };
  }, []);

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
      <div className="grid gap-4 sm:grid-cols-3">
        {finance.map(([label, value, change, icon, tone]) => (
          <div key={label} className="rounded-2xl border border-white/[.07] bg-[#141419] p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500">{label}</span>
              <Icon name={icon} className="h-4 w-4 text-zinc-600" />
            </div>
            <p className={`mt-5 text-2xl font-black ${tone}`}>{value}</p>
            <p className="mt-2 text-xs font-bold text-zinc-500">{change}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
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
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/[.07] bg-[#141419] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-black">Зардал</h2>
              <p className="mt-1 text-xs text-zinc-600">Сүүлийн {range} хоногийн ангилал</p>
            </div>
            <button type="button" onClick={onExpenses} className="shrink-0 rounded-full bg-white px-4 py-2 text-xs font-extrabold text-black">Зардал</button>
          </div>
          <div className="mt-5 space-y-4">
            {categories.map((item) => (
              <div key={item.category}>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-bold">{item.category}</span>
                  <span className="font-black text-[#ff6679]">{dashMoney(item.total)}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[.06]">
                  <div className="h-full rounded-full bg-[#ff536a]" style={{ width: `${Math.max(8, (item.total / categoryMax) * 100)}%` }} />
                </div>
              </div>
            ))}
            {profitReady && !categories.length && <p className="text-sm text-zinc-600">Энэ хугацаанд зардал алга.</p>}
            {!profitReady && <p className="text-sm text-zinc-600">{expenseError || "Ачааллаж байна..."}</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-white/[.07] bg-[#141419] p-6">
          <h2 className="font-black">Сүүлийн зардал</h2>
          <p className="mt-1 text-xs text-zinc-600">Сонгосон хугацааны сүүлийн 5 бүртгэл</p>
          <div className="mt-4 divide-y divide-white/[.05]">
            {latestExpenses.map((expense) => (
              <div key={expense.id} className="flex items-center gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{expense.title}</p>
                  <p className="mt-1 text-[10px] text-zinc-600">{spentLabel(expense.spentOn)} · {expense.category}</p>
                </div>
                <span className="ml-auto shrink-0 text-xs font-bold text-[#ff6679]">{dashMoney(expense.amount)}</span>
              </div>
            ))}
            {profitReady && !latestExpenses.length && <p className="py-3 text-sm text-zinc-600">Энэ хугацаанд зардал алга.</p>}
            {!profitReady && <p className="py-3 text-sm text-zinc-600">{expenseError || "Ачааллаж байна..."}</p>}
          </div>
        </div>
      </div>
      <button type="button" onClick={onActivity} className="mt-5 flex w-full items-center justify-between gap-4 rounded-2xl border border-white/[.07] bg-[#141419] p-5 text-left hover:border-white/20">
        <div>
          <p className="text-xs font-bold text-zinc-500">30 хоногийн боломжит орлого</p>
          <p className="mt-3 text-2xl font-black">{activity ? formatMoney(activity.windows[30].totals.base) : activityError ? "—" : "Тооцоолж байна"}</p>
          <p className="mt-2 text-xs font-bold text-zinc-500">{activity ? `Бага ${formatMoney(activity.windows[30].totals.low)} · Өндөр ${formatMoney(activity.windows[30].totals.high)}` : "Идэвх цэс дээрх суурь таамаг"}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-4 py-2 text-xs font-extrabold text-black">Идэвх</span>
      </button>
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

const activityGroups = [
  ["recent", "Сүүлийн 7 хоногт үзсэн", "Ямар нэг контент нээсэн"],
  ["dormant", "Багцтай, үзээгүй", "14 хоногоос илүү үзэлт алга"],
  ["prospects", "Багцгүй үзэгч", "2 ба түүнээс олон контент"],
  ["expiring", "7 хоногт дуусах", "Идэвхтэй багцын эрх"],
] as const;

function activityName(viewer: ActivityViewer) {
  return viewer.name || viewer.email || (viewer.phone ? formatPhone(viewer.phone) : "Хэрэглэгч");
}

function activityPercent(weight: number) {
  const value = Math.round(weight * 1000) / 10;
  return `${value}%`;
}

function activityPackage(viewer: ActivityViewer) {
  if (viewer.packageMode === "weekly") return "7 хоног";
  if (viewer.packageMode === "subscription") return "Plus";
  return "Байхгүй";
}

function ActivityAdmin({ report, ready, error, content }: { report: ActivityReport | null; ready: boolean; error: string; content: SeriesWithEpisodes[] }) {
  const [days, setDays] = useState<ActivityWindowDays>(30);
  const [group, setGroup] = useState<(typeof activityGroups)[number][0] | "">("");
  const [selected, setSelected] = useState<ActivityViewer | null>(null);
  const titles = useMemo(() => new Map(content.map((film) => [film.id, film.title])), [content]);
  const current = report?.windows[days];
  const renewalPage = usePaged(current?.renewal ?? [], `${days}-renewal`);
  const acquisitionPage = usePaged(current?.acquisition ?? [], `${days}-new`);
  const groupRows = group && report ? report.groups[group] : [];
  const groupPage = usePaged(groupRows, group);
  if (!ready) return <p className="text-sm text-zinc-500">Ачааллаж байна...</p>;
  if (!report) return <p className="text-sm text-zinc-500">{error || "Идэвхийг ачаалж чадсангүй."}</p>;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">Идэвх ба боломжит орлого</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">Хэрэглэгч хэдэн өөр контент үзсэн, багцаа сунгах эсэхээс гарсан таамаг. Орлого цэс бодит төлбөрөө харуулна.</p>
        </div>
        <div className="flex rounded-xl border border-white/10 p-1">
          {([7, 30] as const).map((windowDays) => (
            <button key={windowDays} type="button" onClick={() => setDays(windowDays)} className={`rounded-lg px-4 py-2 text-xs font-bold ${days === windowDays ? "bg-white text-black" : "text-zinc-500"}`}>{windowDays} хоног</button>
          ))}
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {activityGroups.map(([key, label, hint]) => {
          const active = group === key;
          return (
            <button key={key} type="button" onClick={() => setGroup(active ? "" : key)} className={`rounded-2xl border px-5 py-4 text-left ${active ? "border-white/30 bg-white/[.06]" : "border-white/[.07] bg-[#141419] hover:border-white/20"}`}>
              <p className="text-xs font-bold text-zinc-500">{label}</p>
              <p className="mt-3 text-2xl font-black">{report.groups[key].length.toLocaleString("mn-MN")}</p>
              <p className="mt-1 text-[11px] text-zinc-600">{hint}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {([
          ["Бага", report.windows[days].totals.low],
          ["Суурь", report.windows[days].totals.base],
          ["Өндөр", report.windows[days].totals.high],
        ] as const).map(([label, amount]) => (
          <div key={label} className={`rounded-2xl border px-5 py-4 ${label === "Суурь" ? "border-white/20 bg-white/[.06]" : "border-white/[.07] bg-[#141419]"}`}>
            <p className="text-xs font-bold text-zinc-500">{label}</p>
            <p className="mt-3 text-2xl font-black">{formatMoney(amount)}</p>
            <p className="mt-1 text-[11px] text-zinc-600">{days} хоногийн боломжит орлого</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-zinc-600">Сунгалт нь {days} хоногт дуусах багц бөгөөд үнэ нь сүүлийн төлбөр. Шинэ багц нь багцгүй, {days} хоногт үзсэн, 2 ба түүнээс олон контент үзсэн хүн, үнэ {formatMoney(report.weeklyPrice)}. Суурь жин: өндөр {activityPercent(bandWeight.high)}, дунд {activityPercent(bandWeight.mid)}, бага {activityPercent(bandWeight.low)}. Шинэ багц энэ жингийн тал. Бага таамаг суурийн тал, өндөр таамаг суурийн 1.5 дахин, нэг хүнд 90%-иас хэтрэхгүй.</p>
      {group ? (
        <ActivityPeople title={activityGroups.find((item) => item[0] === group)?.[1] ?? "Бүлэг"} rows={groupPage.rows} onOpen={setSelected} />
      ) : (
        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          <ActivityForecast title="Сунгалт" rows={renewalPage.rows} empty="Энэ цонхонд дуусах багц алга." onOpen={setSelected} />
          <ActivityForecast title="Шинэ багц" rows={acquisitionPage.rows} empty="Энэ цонхонд шинэ багц авах үзэгч алга." onOpen={setSelected} />
        </div>
      )}
      {group ? <TablePager pager={groupPage} /> : (
        <div className="grid gap-5 xl:grid-cols-2">
          <TablePager pager={renewalPage} />
          <TablePager pager={acquisitionPage} />
        </div>
      )}
      {selected && (
        <Modal onClose={() => setSelected(null)} size="lg">
          <div className="max-h-[85vh] overflow-y-auto p-6 md:p-8">
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#ff536a]">Үзсэн контент</p>
            <h2 className="mt-2 pr-10 text-2xl font-black">{activityName(selected)}</h2>
            <p className="mt-1 text-sm text-zinc-500">{selected.email || (selected.phone ? formatPhone(selected.phone) : "Холбоо барих мэдээлэл алга")}</p>
            <div className="mt-6 divide-y divide-white/[.06]">
              {selected.seriesIds.map((id) => <p key={id} className="py-3 text-sm font-bold">{titles.get(id) || "Контент"}</p>)}
              {!selected.seriesIds.length && <p className="py-6 text-sm text-zinc-600">Үзсэн контент алга.</p>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ActivityForecast({ title, rows, empty, onOpen }: { title: string; rows: ActivityReport["windows"][30]["renewal"]; empty: string; onOpen: (viewer: ActivityViewer) => void }) {
  return (
    <div className="rounded-2xl border border-white/[.07] bg-[#141419] p-5">
      <h2 className="font-black">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="border-b border-white/[.07] text-zinc-600"><tr>{["ХЭРЭГЛЭГЧ", "ҮЗСЭН", "БҮЛЭГ", "БОЛОМЖИТ"].map((heading) => <th key={heading} className="px-3 py-3">{heading}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.uid} className="border-b border-white/[.05] last:border-0">
                <td className="px-3 py-3">
                  <button type="button" onClick={() => onOpen(row)} className="text-left hover:underline">
                    <span className="font-bold">{activityName(row)}</span>
                    <small className="mt-1 block text-zinc-600">{row.email || (row.phone ? formatPhone(row.phone) : row.reason)}</small>
                  </button>
                </td>
                <td className="px-3 py-3">{row.titles}</td>
                <td className="px-3 py-3">{row.band === "high" ? "Өндөр" : row.band === "mid" ? "Дунд" : "Бага"} · {activityPercent(row.weight)}</td>
                <td className="px-3 py-3 font-bold">{formatMoney(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="py-8 text-center text-sm text-zinc-600">{empty}</p>}
      </div>
    </div>
  );
}

function ActivityPeople({ title, rows, onOpen }: { title: string; rows: ActivityViewer[]; onOpen: (viewer: ActivityViewer) => void }) {
  return (
    <div className="mt-6 rounded-2xl border border-white/[.07] bg-[#141419] p-5">
      <h2 className="font-black">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="border-b border-white/[.07] text-zinc-600"><tr>{["ХЭРЭГЛЭГЧ", "БҮРТГЭСЭН", "ҮЗСЭН", "СҮҮЛИЙН ҮЗЭЛТ", "БАГЦ"].map((heading) => <th key={heading} className="px-3 py-3">{heading}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.uid} className="border-b border-white/[.05] last:border-0">
                <td className="px-3 py-3">
                  <button type="button" onClick={() => onOpen(row)} className="text-left hover:underline">
                    <span className="font-bold">{activityName(row)}</span>
                    {row.email && <small className="mt-1 block text-zinc-600">{row.email}</small>}
                  </button>
                </td>
                <td className="px-3 py-3 text-zinc-400">{row.joined || "—"}</td>
                <td className="px-3 py-3">{row.titles}</td>
                <td className="px-3 py-3 text-zinc-400">{row.lastViewAt ? formatDate(row.lastViewAt) : "—"}</td>
                <td className="px-3 py-3">{activityPackage(row)}{row.expiresAt ? ` · ${formatDate(row.expiresAt)}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="py-8 text-center text-sm text-zinc-600">Энэ бүлэгт хүн алга.</p>}
      </div>
    </div>
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
      <p className="mt-1 text-sm text-zinc-600">Сүүлийн {days} хоногийн орлого. Шууд борлуулалтын 80% танд, 20% платформд. Сарын эрхийн 50%-ийг тухайн хугацааны давтагдаагүй үзэлтээр хуваана. {content.length} контент.</p>
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
  const [genreOrder, setGenreOrder] = useState<string[] | null>(null);
  const [genreSaving, setGenreSaving] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const genreLock = useRef(false);
  const dragIndex = useRef<number | null>(null);
  const shownGenres = genreOrder ?? genres;
  const saveGenreOrder = async (next: string[]) => {
    if (genreLock.current || next.join("\0") === genres.join("\0")) return;
    genreLock.current = true;
    setGenreError("");
    setGenreSaving(true);
    setGenreOrder(next);
    try {
      const saved = await adminFetch<{ genres: string[] }>("/api/admin/genres", { method: "PATCH", body: JSON.stringify({ genres: next }) });
      onGenres(saved.genres);
      setGenreOrder(null);
      notify("Ангиллын байрлал шинэчлэгдлээ.");
    } catch (cause) {
      setGenreOrder(null);
      setGenreError(cause instanceof Error ? cause.message : "Ангиллын байрлал хадгалагдсангүй.");
    } finally {
      genreLock.current = false;
      setGenreSaving(false);
      setDragFrom(null);
      setDragOver(null);
    }
  };
  const moveGenre = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= shownGenres.length || to >= shownGenres.length) return;
    const next = [...shownGenres];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    void saveGenreOrder(next);
  };
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
          <p className="mt-2 text-xs leading-5 text-zinc-600">Дээш, доош эсвэл чирж байрлуулна. Энэ дараалал нүүр хуудасны ангиллын байрлал болно.</p>
          <div className="mt-3 flex flex-col gap-2">
            {shownGenres.map((genre, index) => (
              <div
                key={genre}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (dragFrom !== null) setDragOver(index);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const from = dragIndex.current;
                  dragIndex.current = null;
                  if (from !== null) moveGenre(from, index);
                  setDragFrom(null);
                  setDragOver(null);
                }}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${dragOver === index ? "border-[#ff536a]/60 bg-[#ff536a]/10" : "border-white/10 bg-black/20"} ${dragFrom === index ? "opacity-50" : ""}`}
              >
                <span
                  draggable={!genreSaving}
                  onDragStart={(event) => {
                    dragIndex.current = index;
                    setDragFrom(index);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", String(index));
                  }}
                  onDragEnd={() => {
                    dragIndex.current = null;
                    setDragFrom(null);
                    setDragOver(null);
                  }}
                  className="w-5 cursor-grab text-center text-xs text-zinc-600 active:cursor-grabbing"
                  aria-hidden="true"
                >
                  ⋮⋮
                </span>
                <span className="w-5 text-center text-[10px] font-black text-zinc-500">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{genre}</span>
                <button type="button" disabled={genreSaving || index === 0} onClick={() => moveGenre(index, index - 1)} className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-white/10 disabled:opacity-30" aria-label={`${genre} ангиллыг дээш`}>
                  <Icon name="arrow" className="h-4 w-4 -rotate-90" />
                </button>
                <button type="button" disabled={genreSaving || index === shownGenres.length - 1} onClick={() => moveGenre(index, index + 1)} className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-white/10 disabled:opacity-30" aria-label={`${genre} ангиллыг доош`}>
                  <Icon name="arrow" className="h-4 w-4 rotate-90" />
                </button>
                <button type="button" disabled={genreSaving} onClick={() => removeGenre(genre)} className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:text-red-400 disabled:opacity-30" aria-label={`${genre} төрлийг хасах`}>×</button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input value={genreName} onChange={(e) => setGenreName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && genreName.trim() && addGenre()} placeholder="Шинэ төрөл, жишээ нь Адал явдал" className="admin-input sm:max-w-xs" />
            <button disabled={genreSaving || !genreName.trim()} onClick={addGenre} className="h-12 rounded-xl bg-white px-4 text-xs font-extrabold text-black disabled:opacity-40">Төрөл нэмэх</button>
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

function reelFileLabel(storagePath: string) {
  const base = storagePath.split("/").pop() ?? "";
  const name = base.replace(/^\d+-/, "");
  if (!name || name === "file") return "";
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
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

function ContentEditor({ film, genres, canAddGenre, onGenres, onClose, onSaved }: { film: SeriesWithEpisodes | null; genres: string[]; canAddGenre: boolean; onGenres: (genres: string[]) => void; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [form, setForm] = useState({
    title: film?.title ?? "",
    genre: film?.genre ?? genres[0] ?? defaultSettings.genres[0],
    description: film?.description ?? "",
    price: film?.price ?? 0,
    image: film?.image ?? "",
    cover: film?.cover ?? "",
    status: film?.status ?? "Ноорог",
    translation: film?.translation || "Хадмал",
    featured: film?.featured ?? false,
    year: film?.year ?? 2026,
    age: film?.age ?? "13+",
  });
  const [episodes, setEpisodes] = useState<Episode[]>(film?.episodeList ?? []);
  const [reelUrl, setReelUrl] = useState("");
  const [reelName, setReelName] = useState("");
  const [reelFile, setReelFile] = useState<File | null>(null);
  const [reelProgress, setReelProgress] = useState<number | null>(null);
  const reelLocal = useObjectUrl(reelFile);
  useEffect(() => {
    if (!film?.id) return;
    let ignore = false;
    adminFetch<{ episodes: Episode[]; reelPreview?: string; reelPreviewPath?: string }>(`/api/admin/series/${film.id}/episodes`)
      .then((data) => {
        if (ignore) return;
        setEpisodes(data.episodes);
        setReelUrl(data.reelPreview ?? "");
        setReelName(reelFileLabel(data.reelPreviewPath ?? ""));
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, [film?.id]);
  const [seriesId, setSeriesId] = useState(film?.id ?? "");
  const [newGenre, setNewGenre] = useState("");
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [mailed, setMailed] = useState("");
  const posterPreview = useObjectUrl(posterFile);
  const coverPreview = useObjectUrl(coverFile);
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
        rememberMail(created);
        setBusy("");
        return created.id;
      }
      const saved = await adminFetch<ReleaseNotice & { shareCode?: string }>(`/api/admin/series/${seriesId}`, { method: "PATCH", body: JSON.stringify(payload) });
      rememberMail(saved);
      setBusy("");
      return seriesId;
    } catch (cause) {
      setBusy("");
      setError(cause instanceof Error ? cause.message : "Хадгалж чадсангүй.");
      return "";
    }
  };

  const pushPoster = async (file: File, id: string) => {
    setBusy("Thumbnail хуулж байна...");
    try {
      const storagePath = await uploadAdminFile(file, "poster", id);
      const saved = await adminFetch<{ image: string; notified?: number; notifyError?: string; notifyPending?: string }>(`/api/admin/series/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ posterPath: storagePath }),
      });
      update("image", saved.image);
      setPosterFile(null);
      rememberMail(saved);
      setBusy("");
      return true;
    } catch (cause) {
      setBusy("");
      setError(cause instanceof Error ? cause.message : "Thumbnail хуулж чадсангүй.");
      return false;
    }
  };

  const pushCover = async (file: File, id: string) => {
    setBusy("Вэбсайт ковер хуулж байна...");
    try {
      const storagePath = await uploadAdminFile(file, "cover", id);
      const saved = await adminFetch<{ cover: string; shareCode?: string; notified?: number; notifyError?: string; notifyPending?: string }>(`/api/admin/series/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ coverPath: storagePath }),
      });
      update("cover", saved.cover);
      setCoverFile(null);
      rememberMail(saved);
      setBusy("");
      return true;
    } catch (cause) {
      setBusy("");
      setError(cause instanceof Error ? cause.message : "Ковер хуулж чадсангүй.");
      return false;
    }
  };

  const onPoster = async (file: File) => {
    setPosterFile(file);
    setError("");
    if (!seriesId && !form.title.trim()) return;
    const id = seriesId || (await saveMeta());
    if (!id) return;
    await pushPoster(file, id);
  };

  const onCover = async (file: File) => {
    setCoverFile(file);
    setError("");
    if (!seriesId && !form.title.trim()) return;
    const id = seriesId || (await saveMeta());
    if (!id) return;
    await pushCover(file, id);
  };

  const persistImages = async (id: string) => {
    if (posterFile) {
      const saved = await pushPoster(posterFile, id);
      if (!saved) return false;
    }
    if (coverFile && !mature) {
      const saved = await pushCover(coverFile, id);
      if (!saved) return false;
    }
    return true;
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

  const uploadReel = async (file: File) => {
    const id = seriesId || (await saveMeta());
    if (!id) return;
    const previousName = reelName;
    setReelFile(file);
    setReelName(file.name);
    setReelProgress(0);
    setError("");
    try {
      const storagePath = await uploadAdminFile(file, "reel", id, setReelProgress);
      const saved = await adminFetch<{ reelPreview: string }>(`/api/admin/series/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ reelPreviewPath: storagePath }),
      });
      setReelUrl(saved.reelPreview ?? "");
      setReelName(file.name || reelFileLabel(storagePath));
      setReelFile(null);
      setReelProgress(null);
    } catch (cause) {
      setReelProgress(null);
      setReelFile(null);
      setReelName(reelUrl ? previousName : "");
      setError(cause instanceof Error ? cause.message : "Богино хувилбар хуулж чадсангүй.");
    }
  };

  const clearReel = async () => {
    if (!seriesId || reelProgress !== null) return;
    setError("");
    try {
      await adminFetch(`/api/admin/series/${seriesId}`, { method: "PATCH", body: JSON.stringify({ reelPreviewPath: "" }) });
      setReelUrl("");
      setReelName("");
      setReelFile(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Богино хувилбар устгагдсангүй.");
    }
  };

  const removeEpisode = async (episode: Episode) => {
    if (!seriesId) return;
    await adminFetch(`/api/admin/series/${seriesId}/episodes/${episode.id}`, { method: "DELETE" });
    setEpisodes((current) => current.filter((item) => item.id !== episode.id));
  };

  return (
    <Modal onClose={onClose} size="lg">
      <div className="max-h-[85vh] overflow-y-auto p-7 md:p-9">
        <p className="text-xs font-black uppercase tracking-[.18em] text-[#ff536a]">{film ? "Контент засах" : "Шинэ контент"}</p>
        <h2 className="mt-2 text-2xl font-black">{form.title || "Мэдээлэл оруулах"}</h2>
        <section className="mt-6 rounded-3xl border border-white/[.08] bg-black/25 p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-zinc-400">Зураг</p>
              <p className="mt-1 text-xs text-zinc-500">Дарж сонгох, эсвэл зургаа чирж оруулна.</p>
            </div>
            <p className="text-[11px] font-bold text-zinc-600">Ковер 21:9 · Thumbnail 2:3</p>
          </div>
          <div className="mt-4 grid items-stretch gap-4 sm:grid-cols-[minmax(0,1fr)_10.5rem]">
            <div>
              {mature ? (
                <div className="flex h-full min-h-36 flex-col justify-end rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-black">Вэбсайт ковер</p>
                  <p className="mt-2 max-w-md text-xs leading-5 text-zinc-500">+18 контент нүүрний ковер дээр гарахгүй. Thumbnail нь зөвхөн +18 ангилалд харагдана.</p>
                </div>
              ) : (
                <ImageDrop wide badge="Ковер" label="Вэбсайт ковер" hint="Нүүр хуудсанд харагдах өргөн зураг" src={coverPreview || form.cover} ratio="aspect-[21/9]" onFile={(file) => void onCover(file)} />
              )}
            </div>
            <div className="mx-auto w-36 sm:mx-0 sm:w-auto">
              <ImageDrop badge="Thumbnail" label="Киноны thumbnail" hint="Карт дээр харагдана" src={posterPreview || form.image} ratio="aspect-[2/3]" onFile={(file) => void onPoster(file)} />
            </div>
          </div>
          {(posterFile || (coverFile && !mature)) && !busy && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
              {!(form.title.trim() || seriesId) && <p className="font-bold text-[#ff6679]">Нэр оруулсны дараа хадгалахад орно.</p>}
              {coverFile && !mature && <button type="button" onClick={() => setCoverFile(null)} className="font-bold text-zinc-500 hover:text-white">Ковер болих</button>}
              {posterFile && <button type="button" onClick={() => setPosterFile(null)} className="font-bold text-zinc-500 hover:text-white">Thumbnail болих</button>}
            </div>
          )}
        </section>
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
          <AdminField label="Орчуулгын төрөл">
            <select value={form.translation} onChange={(e) => update("translation", e.target.value)} className="admin-input">
              <option>Хадмал</option>
              <option>Хэл</option>
            </select>
          </AdminField>
          <div className="sm:col-span-2">
            <AdminField label="Тайлбар"><textarea value={form.description} onChange={(e) => update("description", e.target.value)} className="admin-input h-24 py-3" /></AdminField>
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
        <section className="mt-8 rounded-3xl border border-white/[.08] bg-black/25 p-4 sm:p-5">
          <p className="text-xs font-black uppercase tracking-[.16em] text-zinc-400">Reel трейлер</p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">Богино хувилбар оруулбал Reel цэсэнд энэ файл гарна. Оруулаагүй кино, тэр дундаа YouTube анги, Reel-д орохгүй.</p>
          {reelLocal || reelUrl ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black">
              <video key={reelLocal || reelUrl} src={reelLocal || reelUrl} controls playsInline preload="metadata" className="aspect-video max-h-64 w-full bg-black object-contain" />
              <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{reelName || "Богино хувилбар"}</p>
                  <p className="mt-1 text-xs font-bold text-emerald-400">{reelProgress !== null ? "Хуулж байна" : "Орсон · Reel энэ файлыг тоглуулна"}</p>
                </div>
                <button type="button" onClick={() => void clearReel()} disabled={reelProgress !== null} className="shrink-0 text-xs font-bold text-red-400 disabled:opacity-40">Хасах</button>
              </div>
            </div>
          ) : null}
          <div className="mt-4">
            <FilePicker accept="video/mp4,video/webm,video/quicktime" disabled={reelProgress !== null} buttonLabel={reelUrl || reelLocal ? "Солих" : "Богино хувилбар"} emptyLabel="Оруулаагүй" fileName={reelName} onFile={(file) => file && void uploadReel(file)} />
          </div>
          {reelProgress !== null && (
            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#ff2a2a]" style={{ width: `${reelProgress}%` }} />
              </div>
              <p className="mt-2 text-xs font-bold text-zinc-400">Богино хувилбар хуулж байна · {reelProgress}%</p>
            </div>
          )}
        </section>
        {busy && <p className="mt-4 text-xs font-bold text-[#ff6679]">{busy}</p>}
        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
        {mailed && <p className="mt-3 rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-zinc-300">{mailed}</p>}
        <div className="mt-7 flex flex-wrap justify-between gap-3">
          {seriesId ? (
            <button onClick={async () => { await adminFetch(`/api/admin/series/${seriesId}`, { method: "DELETE" }); await onSaved("Контент устгагдлаа."); }} className="rounded-xl border border-red-500/20 px-5 py-3 text-xs font-bold text-red-400">Устгах</button>
          ) : <span />}
          <div className="flex gap-3">
            <button onClick={onClose} className="rounded-xl border border-white/10 px-5 py-3 text-xs font-bold text-zinc-400">Хаах</button>
            <button disabled={!form.title.trim() || Boolean(busy)} onClick={async () => { const id = await saveMeta(); if (!id || !(await persistImages(id))) return; await onSaved(`${film ? "Контент шинэчлэгдлээ." : "Шинэ контент нэмэгдлээ."}${mailNote.current ? ` ${mailNote.current}` : ""}`); }} className="rounded-xl bg-white px-5 py-3 text-xs font-extrabold text-black disabled:opacity-40">Хадгалах</button>
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
  const [channel, setChannel] = useState<SignupChannel | "">("");
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingPause, setPendingPause] = useState<AppUser | null>(null);
  const [busy, setBusy] = useState(false);
  const counts = { email: 0, phone: 0, both: 0 };
  for (const user of users) {
    const kind = signupChannel(user);
    if (kind) counts[kind] += 1;
  }
  const visible = users.filter((user) => `${user.displayName || ""} ${user.email || ""} ${user.phone || ""}`.toLowerCase().includes(query.toLowerCase()) && (filter === "Бүгд" || user.plan === filter) && (!channel || signupChannel(user) === channel));
  const list = usePaged(visible, `${query}|${filter}|${channel}`);
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
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {(["email", "phone", "both"] as const).map((kind) => {
          const meta = signupMeta[kind];
          const active = channel === kind;
          return (
            <button key={kind} type="button" onClick={() => setChannel(active ? "" : kind)} className={`rounded-2xl border px-5 py-4 text-left transition ${active ? "border-white/30 bg-white/[.06]" : "border-white/[.07] bg-[#141419] hover:border-white/20"}`}>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${meta.tone}`}>{meta.label}</span>
              <p className="mt-3 text-2xl font-black">{counts[kind].toLocaleString("mn-MN")}</p>
              <p className="mt-1 text-[11px] text-zinc-600">{kind === "email" ? "Зөвхөн и-мэйлээр бүртгүүлсэн" : kind === "phone" ? "Зөвхөн утсаар бүртгүүлсэн" : "И-мэйл, утас хоёулаа бүртгэлтэй"}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-[#141419] px-4">
          <Icon name="search" className="h-4 w-4 text-zinc-600" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Нэр, email эсвэл утас..." className="w-full bg-transparent text-sm outline-none" />
        </label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-xl border border-white/10 bg-[#141419] px-4 text-xs font-bold"><option>Бүгд</option><option>Plus</option><option>Үндсэн</option></select>
        {channel && <button type="button" onClick={() => setChannel("")} className="rounded-xl border border-white/10 px-4 text-xs font-bold text-zinc-400 hover:text-white">Шүүлт арилгах</button>}
      </div>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/[.07] bg-[#141419]">
        <table className="w-full min-w-[1040px] text-left text-xs">
          <thead className="border-b border-white/[.07] text-zinc-600"><tr>{["ХЭРЭГЛЭГЧ", "БҮРТГЭЛ", "ЭРХ", "ҮЛДСЭН ХОНОГ", "БҮРТГҮҮЛСЭН", "ТӨЛӨВ", "ҮЙЛДЭЛ"].map((heading) => <th key={heading} className="px-5 py-4">{heading}</th>)}</tr></thead>
          <tbody>
            {list.rows.map((user) => {
              const left = user.plan === "Plus" ? daysRemaining(user.subscriptionExpiresAt) : null;
              const { email: contactEmail, phone: contactPhone } = userContacts(user);
              const title = user.displayName || contactEmail || contactPhone || "—";
              return (
              <tr key={user.uid} className="border-b border-white/[.05] last:border-0">
                <td className="px-5 py-5">
                  <button onClick={() => setSelectedId(user.uid)} className="text-left hover:underline">
                    <span className="font-bold">{title}</span>
                    {contactEmail && contactEmail !== title && <small className="mt-1 block font-medium text-zinc-600">{contactEmail}</small>}
                    {contactPhone && contactPhone !== title && <small className="mt-0.5 block font-medium text-zinc-600">{contactPhone}</small>}
                  </button>
                </td>
                <td className="px-5"><SignupBadge channel={signupChannel(user)} /></td>
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
  const { email: contactEmail, phone: contactPhone } = userContacts(user);
  const contact = contactEmail || contactPhone;
  const channel = signupChannel(user);
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
            <p className="mt-1 flex flex-wrap items-center gap-2">
              <span className={`text-xs font-bold ${user.status === "Идэвхтэй" ? "text-emerald-400" : "text-amber-400"}`}>{user.plan} · {user.status}</span>
              <SignupBadge channel={channel} />
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DetailFact label="Нэр">{user.displayName}</DetailFact>
          <DetailFact label="Бүртгэл">{channel ? signupMeta[channel].label : ""}</DetailFact>
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

function todayInput() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function spentLabel(spentOn: string) {
  return spentOn.split("-").join(".");
}

function ExpensesAdmin({ notify }: { notify: (message: string) => void }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [byCategory, setByCategory] = useState<{ category: ExpenseCategory; total: number }[]>([]);
  const [month, setMonth] = useState(currentExpenseMonth);
  const [showAll, setShowAll] = useState(false);
  const [frequencyFilter, setFrequencyFilter] = useState<"all" | ExpenseFrequency>("all");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<(typeof expenseCategories)[number]>(expenseCategories[0]);
  const [frequency, setFrequency] = useState<ExpenseFrequency>("once");
  const [intervalMonths, setIntervalMonths] = useState<(typeof expenseIntervals)[number]>(3);
  const [spentOn, setSpentOn] = useState(todayInput);
  const [note, setNote] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptKey, setReceiptKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ expense: Expense; stop: boolean } | null>(null);
  const queryMonth = showAll ? "all" : month;
  const visible = frequencyFilter === "all" ? expenses : expenses.filter((item) => item.frequency === frequencyFilter);
  const list = usePaged(visible, `${queryMonth}|${frequencyFilter}|${expenses.length}|${total}`);
  const monthTitle = showAll ? "Бүх сар" : `${month.slice(0, 4)} оны ${Number(month.slice(5, 7))} сар`;

  const load = async () => {
    const data = await adminFetch<{ expenses: Expense[]; total: number; byCategory: { category: ExpenseCategory; total: number }[] }>(`/api/admin/expenses?month=${encodeURIComponent(queryMonth)}`);
    setExpenses(data.expenses);
    setTotal(data.total);
    setByCategory(data.byCategory);
  };

  useEffect(() => {
    let active = true;
    adminFetch<{ expenses: Expense[]; total: number; byCategory: { category: ExpenseCategory; total: number }[] }>(`/api/admin/expenses?month=${encodeURIComponent(queryMonth)}`)
      .then((data) => {
        if (!active) return;
        setExpenses(data.expenses);
        setTotal(data.total);
        setByCategory(data.byCategory);
      })
      .catch((error: Error) => {
        if (active) notify(error.message);
      });
    return () => {
      active = false;
    };
  }, [queryMonth]);

  const pickReceipt = (file: File | null) => {
    if (file && file.size > EXPENSE_RECEIPT_LIMIT) {
      notify("PDF 8MB-аас бага байна.");
      setReceiptFile(null);
      setReceiptKey((value) => value + 1);
      return;
    }
    if (file && file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      notify("Зөвхөн PDF хавсаргана.");
      setReceiptFile(null);
      setReceiptKey((value) => value + 1);
      return;
    }
    setReceiptFile(file);
  };

  const create = async () => {
    setBusy(true);
    try {
      const saved = await adminFetch<{ expense: Expense | null; templateId: string }>("/api/admin/expenses", {
        method: "POST",
        body: JSON.stringify({ title, amount: Number(amount), category, spentOn, note, frequency, intervalMonths: frequency === "custom" ? intervalMonths : undefined }),
      });
      if (receiptFile) {
        const target = saved.templateId ? { templateId: saved.templateId } : { expenseId: saved.expense?.id };
        if (!target.templateId && !target.expenseId) throw new Error("Баримт хавсаргах зардал олдсонгүй.");
        try {
          await uploadExpenseReceipt(receiptFile, target);
        } catch (error) {
          await load();
          setTitle("");
          setAmount("");
          setNote("");
          setReceiptFile(null);
          setReceiptKey((value) => value + 1);
          notify(error instanceof Error ? error.message : "Зардал бүртгэгдсэн. Баримт хуулагдаагүй.");
          return;
        }
      }
      await load();
      setTitle("");
      setAmount("");
      setNote("");
      setReceiptFile(null);
      setReceiptKey((value) => value + 1);
      notify(frequency === "once" ? "Зардал бүртгэгдлээ." : saved.expense ? "Тогтмол зардал бүртгэгдлээ." : "Тогтмол зардал хадгалагдлаа. Эхлэх сар болоход нэмэгдэнэ.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Зардал бүртгэгдсэнгүй.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: { expense: Expense; stop: boolean }) => {
    setBusy(true);
    try {
      await adminFetch("/api/admin/expenses", { method: "DELETE", body: JSON.stringify({ id: item.expense.id, stop: item.stop }) });
      setPending(null);
      await load();
      notify(item.stop ? "Дараагийн сарууд зогслоо." : "Зардал устлаа.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Зардал устсангүй.");
    } finally {
      setBusy(false);
    }
  };

  const openReceipt = async (id: string) => {
    try {
      const data = await adminFetch<{ url: string }>(`/api/admin/expenses/receipt?id=${encodeURIComponent(id)}`);
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Баримт нээгдсэнгүй.");
    }
  };

  const attach = async (expense: Expense, file: File) => {
    setBusy(true);
    try {
      await uploadExpenseReceipt(file, { expenseId: expense.id });
      await load();
      notify("Баримт хавсарлаа.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Баримт хуулагдаагүй.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">Зардал бүртгэх</h2>
          <p className="mt-1 text-sm text-zinc-600">Сар бүр, нэг удаа, давтамжаар тэмдэглээд сараар нь харна.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <AdminField label="Сар">
            <input value={month} onChange={(event) => { if (!event.target.value) return; setMonth(event.target.value); setShowAll(false); }} type="month" className="admin-input !w-auto" />
          </AdminField>
          <button onClick={() => setShowAll((value) => !value)} className={`h-12 rounded-xl px-4 text-xs font-extrabold ${showAll ? "bg-white text-black" : "border border-white/10 text-zinc-300"}`}>Бүх сар</button>
          <div className="rounded-2xl border border-white/[.07] bg-[#141419] px-5 py-3">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-zinc-500">{monthTitle}</p>
            <p className="mt-1 text-xl font-black text-[#ff6679]">{formatMoney(total)}</p>
          </div>
        </div>
      </div>
      {!!byCategory.length && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {byCategory.map((item) => (
            <div key={item.category} className="rounded-2xl border border-white/[.07] bg-[#141419] px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[.14em] text-zinc-500">{item.category}</p>
              <p className="mt-1 font-black">{formatMoney(item.total)}</p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-7 grid gap-4 rounded-2xl border border-white/[.07] bg-[#141419] p-6 md:grid-cols-2">
        <AdminField label="Нэр">
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder="Жишээ нь Facebook зар" className="admin-input" />
        </AdminField>
        <AdminField label="Дүн (₮)">
          <input value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="250000" className="admin-input" />
        </AdminField>
        <AdminField label="Ангилал">
          <select value={category} onChange={(event) => setCategory(event.target.value as (typeof expenseCategories)[number])} className="admin-input">
            {expenseCategories.map((item) => <option key={item}>{item}</option>)}
          </select>
        </AdminField>
        <AdminField label="Давтамж">
          <select value={frequency} onChange={(event) => setFrequency(event.target.value as ExpenseFrequency)} className="admin-input">
            <option value="once">Нэг удаа</option>
            <option value="monthly">Сар бүр тогтмол</option>
            <option value="custom">Давтамжит</option>
          </select>
        </AdminField>
        {frequency === "custom" && (
          <AdminField label="Алхам">
            <select value={intervalMonths} onChange={(event) => setIntervalMonths(Number(event.target.value) as (typeof expenseIntervals)[number])} className="admin-input">
              {expenseIntervals.map((item) => <option key={item} value={item}>{item} сар тутам</option>)}
            </select>
          </AdminField>
        )}
        <AdminField label={frequency === "once" ? "Огноо" : "Эхлэх огноо"}>
          <input value={spentOn} onChange={(event) => setSpentOn(event.target.value)} type="date" className="admin-input" />
        </AdminField>
        <div className="md:col-span-2">
          <AdminField label="Тэмдэглэл">
            <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} placeholder="Заавал биш" className="admin-input" />
          </AdminField>
        </div>
        <div className="md:col-span-2">
          <AdminField label="Төлбөрийн баримт (PDF)">
            <FilePicker key={receiptKey} accept="application/pdf" fileName={receiptFile?.name ?? ""} emptyLabel="PDF сонгоогүй" buttonLabel="PDF хавсаргах" onFile={pickReceipt} />
          </AdminField>
        </div>
        <div className="md:col-span-2">
          <button disabled={busy || !title.trim() || !amount} onClick={create} className="h-11 rounded-xl bg-white px-5 text-xs font-extrabold text-black disabled:opacity-40">Бүртгэх</button>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {([["all", "Бүгд"], ["once", "Нэг удаа"], ["monthly", "Сар бүр"], ["custom", "Давтамжит"]] as const).map(([value, label]) => (
          <button key={value} onClick={() => setFrequencyFilter(value)} className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${frequencyFilter === value ? "bg-white text-black" : "bg-white/[.06] text-zinc-400"}`}>{label}</button>
        ))}
      </div>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/[.07]">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead className="bg-white/[.03] text-[10px] uppercase tracking-[.16em] text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-bold">Огноо</th>
              <th className="px-5 py-3 font-bold">Нэр</th>
              <th className="px-5 py-3 font-bold">Ангилал</th>
              <th className="px-5 py-3 font-bold">Давтамж</th>
              <th className="px-5 py-3 font-bold">Дүн</th>
              <th className="px-5 py-3 font-bold">Баримт</th>
              <th className="px-5 py-3 font-bold" />
            </tr>
          </thead>
          <tbody>
            {list.rows.map((expense) => (
              <tr key={expense.id} className="border-t border-white/[.06]">
                <td className="px-5 py-4 text-zinc-400">{spentLabel(expense.spentOn)}</td>
                <td className="px-5 py-4">
                  <b>{expense.title}</b>
                  {expense.source === "salary" ? <p className="mt-1 text-zinc-500">Автомат цалин</p> : null}
                  {expense.note ? <p className="mt-1 text-zinc-500">{expense.note}</p> : null}
                </td>
                <td className="px-5 py-4 text-zinc-400">{expense.category}</td>
                <td className="px-5 py-4 text-zinc-400">{expenseFrequencyLabel(expense.frequency, expense.intervalMonths)}</td>
                <td className="px-5 py-4 font-bold">{formatMoney(expense.amount)}</td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {expense.receiptPath ? <button onClick={() => openReceipt(expense.id)} className="font-bold text-zinc-200">Харах</button> : null}
                    <label className="cursor-pointer font-bold text-zinc-400">
                      {expense.receiptPath ? "Солих" : "PDF"}
                      <input type="file" accept="application/pdf" disabled={busy} className="sr-only" onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        event.target.value = "";
                        if (file) attach(expense, file);
                      }} />
                    </label>
                  </div>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex justify-end gap-3">
                    {expense.templateId ? <button onClick={() => setPending({ expense, stop: true })} className="font-bold text-zinc-300">Зогсоох</button> : null}
                    <button onClick={() => setPending({ expense, stop: false })} className="font-bold text-red-400">Устгах</button>
                  </div>
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-sm text-zinc-500">{expenses.length ? "Энэ шүүлтэд зардал алга." : showAll ? "Бүртгэсэн зардал алга." : "Энэ сард зардал алга."}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePager pager={list} />
      {pending && (
        <ConfirmModal
          title={pending.stop ? "Цааш зогсоох уу?" : "Зардал устгах уу?"}
          body={pending.stop ? `${pending.expense.title} энэ сардаа үлдэнэ. Дараагийн сарууд зогсоно.` : `${pending.expense.title} · ${formatMoney(pending.expense.amount)}`}
          confirmLabel={pending.stop ? "Зогсоох" : "Устгах"}
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => remove(pending)}
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

function MarketingAdmin({ settings, onSaved, notify }: { settings: Settings; onSaved: (settings: Settings) => void; notify: (message: string) => void }) {
  const [emailEnabled, setEmailEnabled] = useState(settings.emailEnabled);
  const [smsEnabled, setSmsEnabled] = useState(settings.smsEnabled);
  const [mailFromName, setMailFromName] = useState(settings.mailFromName);
  const [renewalMailEnabled, setRenewalMailEnabled] = useState(settings.renewalMailEnabled);
  const [renewalBusy, setRenewalBusy] = useState(false);
  const [channels, setChannels] = useState<{ resend: boolean; wesend: boolean; fromEmail: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(false);
  const [subject, setSubject] = useState("");
  const [mailBody, setMailBody] = useState("");
  const [smsBody, setSmsBody] = useState("");
  const [composeError, setComposeError] = useState("");
  const [composeBusy, setComposeBusy] = useState(false);
  const [preview, setPreview] = useState<{ emails: number; phones: number; smsText: string; key: string; email: boolean; sms: boolean; subject: string; body: string; smsBody: string } | null>(null);
  const sending = useRef(false);
  useEffect(() => {
    setEmailEnabled(settings.emailEnabled);
    setSmsEnabled(settings.smsEnabled);
    setMailFromName(settings.mailFromName);
    setRenewalMailEnabled(settings.renewalMailEnabled);
  }, [settings]);
  useEffect(() => {
    adminFetch<{ channels: { resend: boolean; wesend: boolean; fromEmail: string } }>("/api/admin/marketing")
      .then((data) => setChannels(data.channels))
      .catch(() => setChannels(null));
  }, []);
  const save = async () => {
    setBusy(true);
    try {
      const saved = await adminFetch<{ settings: Settings }>("/api/admin/marketing", {
        method: "PUT",
        body: JSON.stringify({ emailEnabled, smsEnabled, mailFromName, renewalMailEnabled }),
      });
      onSaved(saved.settings);
      notify("Маркетингийн тохиргоо хадгалагдлаа.");
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Маркетингийн тохиргоо хадгалагдсангүй.");
    } finally {
      setBusy(false);
    }
  };
  const toggleRenewal = async () => {
    const next = !renewalMailEnabled;
    setRenewalMailEnabled(next);
    setRenewalBusy(true);
    try {
      const saved = await adminFetch<{ settings: Settings }>("/api/admin/marketing", {
        method: "PUT",
        body: JSON.stringify({ renewalMailEnabled: next }),
      });
      onSaved(saved.settings);
      notify(next ? "Байнга мэйл аслаа." : "Байнга мэйл унтраалаа.");
    } catch (cause) {
      setRenewalMailEnabled(!next);
      notify(cause instanceof Error ? cause.message : "Байнга мэйл хадгалагдсангүй.");
    } finally {
      setRenewalBusy(false);
    }
  };
  const previewSend = async () => {
    setComposeError("");
    setComposeBusy(true);
    const payload = { email: sendEmail, sms: sendSms, subject, body: mailBody, smsBody };
    try {
      const data = await adminFetch<{ preview: true; emails: number; phones: number; smsText: string }>("/api/admin/marketing/send", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setPreview({ ...data, ...payload, key: crypto.randomUUID().replace(/-/g, "") });
    } catch (cause) {
      setComposeError(cause instanceof Error ? cause.message : "Илгээлтийг бэлдэж чадсангүй.");
    } finally {
      setComposeBusy(false);
    }
  };
  const confirmSend = async () => {
    if (!preview || sending.current) return;
    sending.current = true;
    setComposeBusy(true);
    setComposeError("");
    try {
      const sent = await adminFetch<{ emailed: number; smsed: number }>("/api/admin/marketing/send", {
        method: "POST",
        body: JSON.stringify({
          email: preview.email,
          sms: preview.sms,
          subject: preview.subject,
          body: preview.body,
          smsBody: preview.smsBody,
          confirm: true,
          idempotencyKey: preview.key,
        }),
      });
      const parts = [sent.emailed ? `${sent.emailed} имэйл` : "", sent.smsed ? `${sent.smsed} SMS` : ""].filter(Boolean);
      notify(parts.length ? `${parts.join(", ")} илгээлээ.` : "Илгээлээ.");
      setSubject("");
      setMailBody("");
      setSmsBody("");
      setPreview(null);
    } catch (cause) {
      setComposeError(cause instanceof Error ? cause.message : "Илгээгдсэнгүй.");
      setPreview(null);
    } finally {
      sending.current = false;
      setComposeBusy(false);
    }
  };
  const previewText = preview
    ? `${[preview.emails ? `${preview.emails} имэйл` : "", preview.phones ? `${preview.phones} SMS` : ""].filter(Boolean).join(", ")} руу илгээнэ.${preview.smsText ? ` SMS: ${preview.smsText}` : ""}`
    : "";
  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-black">Маркетинг</h2>
      <p className="mt-1 text-sm text-zinc-600">Имэйл болон SMS илгээх сувгийг зөвхөн super admin удирдана. API түлхүүр серверийн орчинд хадгалагдана.</p>
      {!settings.notifications && <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs font-bold text-amber-200">Ерөнхий тохиргооны «Контентын мэдэгдэл» унтраалттай тул шинэ контент, шинэ бүтээгчийн мэдэгдэл явахгүй. Доорх шууд илгээлт энэ унтраалтаас хамаарахгүй.</p>}
      <div className="mt-7 space-y-5">
        <section className="rounded-2xl border border-white/[.07] bg-[#141419] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-black">Байнга мэйл</h3>
              <p className="mt-1 text-xs leading-5 text-zinc-600">Багц дуусахаас 3 хоног, 1 хоногийн өмнө сануулга явна. Сунгаагүй, тэр 3 хоногт үзээгүй бол зөвхөн тэр хүнд 20% хөнгөлөлт 24 цагаар явна. Өглөө 10:00 цагт шалгана.</p>
            </div>
            <button type="button" onClick={toggleRenewal} disabled={renewalBusy} aria-pressed={renewalMailEnabled} aria-label="Байнга мэйл" className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${renewalMailEnabled ? "bg-[#ff3d56]" : "bg-zinc-700"}`}>
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${renewalMailEnabled ? "left-6" : "left-1"}`} />
            </button>
          </div>
          <p className={`mt-4 text-xs font-bold ${renewalMailEnabled ? "text-emerald-400" : "text-zinc-500"}`}>{renewalMailEnabled ? "Асаалттай. Маргааш өглөөний шалгалтаас эхэлнэ." : "Унтраалттай. Мэйл явахгүй."}</p>
          <ul className="mt-4 space-y-2 text-xs leading-5 text-zinc-500">
            <li>3 хоног үлдсэн — 3 хоногийн дараа багц чинь дуусна</li>
            <li>1 хоног үлдсэн — Маргааш багц дуусах нь</li>
            <li>Дууссанаас 3 хоног, үзээгүй — Чамд зориулж 20% үлдээсэн</li>
          </ul>
        </section>
        <section className="rounded-2xl border border-white/[.07] bg-[#141419] p-6">
          <h3 className="text-lg font-black">Шууд илгээх</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-600">Агуулгаа энд бичээд идэвхтэй хэрэглэгч рүү илгээнэ. Түр зогссон бүртгэл орохгүй.</p>
          <div className="mt-5 flex gap-2">
            {([["Имэйл", sendEmail, setSendEmail], ["SMS", sendSms, setSendSms]] as const).map(([label, on, toggle]) => (
              <button key={label} type="button" aria-pressed={on} onClick={() => toggle((value) => !value)} className={`rounded-full px-4 py-2 text-xs font-bold ${on ? "bg-white text-black" : "border border-white/10 text-zinc-400"}`}>{label}</button>
            ))}
          </div>
          <div className="mt-5 space-y-5">
            {sendEmail && (
              <>
                <AdminField label="Гарчиг">
                  <input value={subject} maxLength={120} onChange={(event) => setSubject(event.target.value)} placeholder="Захидлын гарчиг" className="admin-input" />
                </AdminField>
                <AdminField label="Имэйлийн агуулга">
                  <textarea value={mailBody} maxLength={4000} onChange={(event) => setMailBody(event.target.value)} placeholder="Хэрэглэгчид хэлэх зүйлээ бичнэ үү." className="admin-input h-36 py-3" />
                </AdminField>
              </>
            )}
            {sendSms && (
              <AdminField label="SMS агуулга">
                <textarea value={smsBody} maxLength={300} onChange={(event) => setSmsBody(event.target.value)} placeholder="Богино мессеж" className="admin-input h-24 py-3" />
                <span className="mt-2 block text-xs text-zinc-600">{smsBody.length}/300 · Кирилл үсэг латин болж илгээгдэнэ.</span>
              </AdminField>
            )}
          </div>
          {composeError && <p className="mt-4 text-xs font-bold text-red-400">{composeError}</p>}
          <button type="button" onClick={previewSend} disabled={composeBusy} className="mt-5 rounded-xl bg-[#ff3d56] px-5 py-3 text-xs font-extrabold text-white disabled:opacity-60">{composeBusy && !preview ? "Бэлдэж байна..." : "Илгээх"}</button>
        </section>
        <section className="rounded-2xl border border-white/[.07] bg-[#141419] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-black">Имэйл</h3>
              <p className="mt-1 text-xs leading-5 text-zinc-600">Шинэ контент болон шинэ бүтээгчийн мэдэгдэл. Нэвтрэх код, бүтээгчийн нэвтрэх имэйл энэ унтраалтаас хамаарахгүй.</p>
            </div>
            <button type="button" onClick={() => setEmailEnabled((value) => !value)} aria-pressed={emailEnabled} aria-label="Имэйл илгээх" className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition ${emailEnabled ? "bg-[#ff3d56]" : "bg-zinc-700"}`}>
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${emailEnabled ? "left-6" : "left-1"}`} />
            </button>
          </div>
          <div className="mt-5 space-y-2">
            <p className={`text-xs font-bold ${channels?.resend ? "text-emerald-400" : "text-amber-400"}`}>Resend: {channels ? (channels.resend ? "бэлэн" : "тохиргоо дутуу") : "шалгаж байна..."}</p>
            <p className={`text-xs font-bold ${channels?.wesend ? "text-emerald-400" : "text-zinc-500"}`}>WeSend имэйл: {channels ? (channels.wesend ? "бэлэн, нөөц суваг" : "тохиргоо дутуу") : "шалгаж байна..."}</p>
            {channels?.fromEmail && <p className="text-xs text-zinc-500">Илгээгч: {channels.fromEmail}</p>}
          </div>
          <div className="mt-5">
            <AdminField label="Илгээгчийн нэр">
              <input value={mailFromName} maxLength={40} onChange={(event) => setMailFromName(event.target.value)} className="admin-input" />
            </AdminField>
          </div>
        </section>
        <section className="rounded-2xl border border-white/[.07] bg-[#141419] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-black">SMS</h3>
              <p className="mt-1 text-xs leading-5 text-zinc-600">Имэйлгүй хэрэглэгчийн утас руу шинэ контентийн SMS. 18+ контентод SMS явахгүй. Утасны баталгаажуулалт тусдаа.</p>
            </div>
            <button type="button" onClick={() => setSmsEnabled((value) => !value)} aria-pressed={smsEnabled} aria-label="SMS илгээх" className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition ${smsEnabled ? "bg-[#ff3d56]" : "bg-zinc-700"}`}>
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${smsEnabled ? "left-6" : "left-1"}`} />
            </button>
          </div>
          <p className={`mt-5 text-xs font-bold ${channels?.wesend ? "text-emerald-400" : "text-amber-400"}`}>WeSend SMS: {channels ? (channels.wesend ? "бэлэн" : "тохиргоо дутуу") : "шалгаж байна..."}</p>
        </section>
        <button type="button" onClick={save} disabled={busy} className="rounded-xl bg-white px-5 py-3 text-xs font-extrabold text-black disabled:opacity-60">{busy ? "Хадгалж байна..." : "Өөрчлөлт хадгалах"}</button>
      </div>
      {preview && (
        <ConfirmModal
          title="Илгээх үү?"
          body={previewText}
          confirmLabel={composeBusy ? "Илгээж байна..." : "Илгээх"}
          busy={composeBusy}
          onCancel={() => { if (!composeBusy) setPreview(null); }}
          onConfirm={confirmSend}
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
            ["notifications", "Контентын мэдэгдэл", "Шинэ контент нийтлэхэд, эсвэл шинэ бүтээгч нэгдэхэд имэйлтэй хэрэглэгчид мэдэгдэл илгээнэ. Шинэ кинонд имэйл байхгүй бол утас руу SMS явна. Бүтээгчийн мэдэгдэл зөвхөн имэйл."],
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

function SalaryStatusButton({ line, busy, onClick }: { line: SalaryLine; busy: boolean; onClick: () => void }) {
  return (
    <button disabled={busy} onClick={onClick} className={`rounded-full px-3 py-1.5 text-[11px] font-bold disabled:opacity-50 ${line.paid ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-300"}`}>
      {busy ? "Хадгалж байна..." : line.status}
    </button>
  );
}

function SalaryAdmin({ report, manage, notify, onUpdated }: { report: SalaryReport; manage: boolean; notify: (message: string) => void; onUpdated: (adminId: string, cycleId: string, paid: boolean, paidAt: number) => void }) {
  const [busyKey, setBusyKey] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const list = usePaged(report.creators, "salary");
  const toggle = async (adminId: string, line: SalaryLine) => {
    const key = `${adminId}_${line.id}`;
    setBusyKey(key);
    try {
      const saved = await adminFetch<{ paid: boolean; paidAt: number; expense: "added" | "removed" | "none" }>("/api/admin/salary", {
        method: "POST",
        body: JSON.stringify({ adminId, cycleId: line.id, paid: !line.paid }),
      });
      onUpdated(adminId, line.id, saved.paid, saved.paidAt);
      notify(saved.paid
        ? saved.expense === "added" ? "Цалин олгосонд тэмдэглэж, зардалд нэмлээ." : "Цалин олгосонд тэмдэглэлээ."
        : saved.expense === "removed" ? "Цалин хүлээгдэж буй боллоо. Зардлаас хаслаа." : "Цалин хүлээгдэж буй боллоо.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Цалингийн төлөв солигдсонгүй.");
    } finally {
      setBusyKey("");
    }
  };
  if (!manage) {
    const mine = report.creators[0];
    const current = mine?.lines[0];
    const history = mine?.lines.slice(1) ?? [];
    return (
      <div>
        <h2 className="text-2xl font-black">Цалин</h2>
        <p className="mt-1 max-w-3xl text-sm text-zinc-600">2026 оны 10 сараас хойших циклийн орлого. Сар бүрийн 15 болон 30-нд олгоно. 16 болон дараа сарын 1-нд шинэ цикл ₮0-оос эхэлнэ. Төлөв super admin олгосон гэж тэмдэглэсний дараа солигдоно.</p>
        {!current && <p className="mt-8 text-sm text-zinc-500">Цалингийн цикл алга.</p>}
        {current && (
          <>
            <div className="mt-5 rounded-2xl border border-white/[.07] bg-[#141419] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-zinc-500">{current.label}</p>
                  <p className="mt-3 text-4xl font-black">{formatMoney(current.total)}</p>
                  <p className="mt-2 text-xs text-zinc-600">Олголт: {current.payoutLabel}</p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${current.paid ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-300"}`}>{current.status}</span>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/[.07] bg-[#141419] p-5">
                <p className="text-xs font-bold text-zinc-500">Шууд борлуулалт</p>
                <p className="mt-3 text-2xl font-black">{formatMoney(current.direct)}</p>
                <p className="mt-2 text-xs text-zinc-600">борлуулалтын 80%</p>
              </div>
              <div className="rounded-2xl border border-white/[.07] bg-[#141419] p-5">
                <p className="text-xs font-bold text-zinc-500">Сарын эрхийн хувь</p>
                <p className="mt-3 text-2xl font-black">{formatMoney(current.subscriptionShare)}</p>
                <p className="mt-2 text-xs text-zinc-600">тухайн 15 хоногийн үзэлтээр</p>
              </div>
              <div className="rounded-2xl border border-white/[.07] bg-[#141419] p-5">
                <p className="text-xs font-bold text-zinc-500">Урилга</p>
                <p className="mt-3 text-2xl font-black">{formatMoney(current.referral)}</p>
                <p className="mt-2 text-xs text-zinc-600">урьсан бүтээгчийн борлуулалтын 10%</p>
              </div>
            </div>
            <div className="mt-5 overflow-x-auto rounded-2xl border border-white/[.07] bg-[#141419]">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="border-b border-white/[.07] text-zinc-600">
                  <tr>{["ЦИКЛ", "ОЛГОЛТ", "ШУУД", "САРЫН ЭРХ", "УРИЛГА", "НИЙТ", "ТӨЛӨВ"].map((heading) => <th key={heading} className="px-5 py-4">{heading}</th>)}</tr>
                </thead>
                <tbody>
                  {history.map((line) => (
                    <tr key={line.id} className="border-b border-white/[.05] last:border-0">
                      <td className="px-5 py-4 font-bold">{line.label}</td>
                      <td className="px-5 text-zinc-400">{line.payoutLabel}</td>
                      <td className="px-5">{formatMoney(line.direct)}</td>
                      <td className="px-5">{formatMoney(line.subscriptionShare)}</td>
                      <td className="px-5">{formatMoney(line.referral)}</td>
                      <td className="px-5 font-bold">{formatMoney(line.total)}</td>
                      <td className={`px-5 font-bold ${line.paid ? "text-emerald-400" : "text-amber-300"}`}>{line.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!history.length && <p className="py-10 text-center text-sm text-zinc-600">Өмнөх цикл алга.</p>}
            </div>
          </>
        )}
      </div>
    );
  }
  return (
    <div>
      <h2 className="text-2xl font-black">Цалин</h2>
      <p className="mt-1 max-w-3xl text-sm text-zinc-600">2026 оны 10 сараас хойших цикл. Бүтээгч бүрийн одоогийн болон сүүлд хаагдсан дүн. Төлөв дээр дарж олгосон эсвэл хүлээгдэж буй болгоно. Олгосон гэж тэмдэглэхэд 15 эсвэл 30-ны дүн тухайн сарын цалингийн зардалд автоматаар орно. Хуучин циклийг мөрөө дэлгээд тэмдэглэнэ.</p>
      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/[.07] bg-[#141419]">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead className="border-b border-white/[.07] text-zinc-600">
            <tr>{["БҮТЭЭГЧ", "ДАНС", "ОДООГИЙН ДҮН", "ХААГДСАН ДҮН", "ТӨЛӨВ", "ХУУЧИН"].map((heading) => <th key={heading} className="px-5 py-4">{heading}</th>)}</tr>
          </thead>
          <tbody>
            {list.rows.map((creator) => {
              const current = creator.lines[0];
              const closed = creator.lines[1];
              const older = creator.lines.slice(2);
              const open = openId === creator.adminId;
              return (
                <Fragment key={creator.adminId}>
                  <tr className="border-b border-white/[.05]">
                    <td className="px-5 py-4 font-bold">{creator.name}{creator.username && <small className="mt-1 block font-medium text-zinc-600">@{creator.username}</small>}</td>
                    <td className="px-5 text-zinc-400">{creator.bankAccount ? <><span className="font-bold tracking-wide text-zinc-200">{creator.bankAccount}</span>{creator.bankName && <small className="block text-zinc-600">{creator.bankName}</small>}</> : "—"}</td>
                    <td className="px-5">
                      <span className="font-bold">{current ? formatMoney(current.total) : "—"}</span>
                      {current && <small className="mt-1 block text-zinc-600">{current.label}</small>}
                    </td>
                    <td className="px-5">
                      <span className="font-bold">{closed ? formatMoney(closed.total) : "—"}</span>
                      {closed && <small className="mt-1 block text-zinc-600">{closed.label}</small>}
                    </td>
                    <td className="px-5">{closed ? <SalaryStatusButton line={closed} busy={busyKey === `${creator.adminId}_${closed.id}`} onClick={() => toggle(creator.adminId, closed)} /> : "—"}</td>
                    <td className="px-5">
                      <button onClick={() => setOpenId(open ? null : creator.adminId)} className="font-bold text-zinc-400 hover:text-white">{open ? "Хаах" : "Харах"}</button>
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b border-white/[.05] bg-white/[.02]">
                      <td colSpan={6} className="px-5 py-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          {older.map((line) => (
                            <div key={line.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[.06] px-4 py-3">
                              <div>
                                <p className="font-bold">{line.label}</p>
                                <p className="mt-1 text-zinc-500">Олголт: {line.payoutLabel} · {formatMoney(line.total)}</p>
                              </div>
                              <SalaryStatusButton line={line} busy={busyKey === `${creator.adminId}_${line.id}`} onClick={() => toggle(creator.adminId, line)} />
                            </div>
                          ))}
                        </div>
                        {!older.length && <p className="text-sm text-zinc-600">Хуучин цикл алга.</p>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {!report.creators.length && <p className="py-10 text-center text-sm text-zinc-600">Контент бүтээгч алга.</p>}
      </div>
      <TablePager pager={list} />
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
            Сүүлийн {days} хоногийн төлбөр. Шууд борлуулалтын 80% бүтээгчид. Сарын эрхийн 50%-ийг тухайн хугацааны давтагдаагүй үзэлтээр хуваана. Урилга нь шууд борлуулалтын 10%.
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingClose, setPendingClose] = useState<StaffAdmin | null>(null);
  const selected = staff.find((admin) => admin.id === selectedId) ?? null;
  const list = usePaged(staff);
  const create = async () => {
    setError("");
    try {
      const saved = await adminFetch<{ admin: StaffAdmin; welcomeError?: string; emailed?: number; notifyError?: string }>("/api/admin/staff", { method: "POST", body: JSON.stringify({ name, username, email, password }) });
      onStaff((current) => [saved.admin, ...current.filter((admin) => admin.id !== saved.admin.id)]);
      setName("");
      setUsername("");
      setEmail("");
      setPassword("");
      const note = [
        "Контент бүтээгч нэмэгдлээ.",
        saved.welcomeError || "Нэвтрэх мэдээллийг имэйлээр илгээлээ.",
        saved.notifyError || (saved.emailed ? `${saved.emailed} хэрэглэгч рүү имэйл илгээлээ.` : ""),
      ].filter(Boolean).join(" ");
      notify(note);
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
      <div className="mt-6 grid gap-3 rounded-2xl border border-white/[.07] bg-[#141419] p-5 md:grid-cols-2 xl:grid-cols-5">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Нэр" className="admin-input" />
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Нэвтрэх нэр" className="admin-input" autoCapitalize="none" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="И-мэйл" type="email" className="admin-input" autoCapitalize="none" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Нууц үг" type="password" className="admin-input" />
        <button disabled={!name.trim() || !username.trim() || !email.includes("@") || password.length < 6} onClick={create} className="rounded-xl bg-white text-xs font-extrabold text-black disabled:opacity-40">Бүтээгч нэмэх</button>
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
