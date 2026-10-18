"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { creatorUsernameFromPath, type PublicCreator } from "@/lib/creator-site";
import { seriesFromRecord } from "@/lib/series-doc";
import type { AppUser, CheckoutMode, Payment, Series, Settings } from "@/lib/types";
import { defaultSettings, mergeSettings } from "@/lib/types";
import { clientAuth, clientDb, firebaseConfigured } from "@/lib/firebase";
import { accountInitial, subscriptionActive } from "@/lib/format";
import { AuthModal } from "./auth-modal";
import { JoinModal } from "./join-modal";
import { CheckoutModal } from "./checkout-modal";
import { FilmModal } from "./film-modal";
import { animate } from "animejs";
import { Icon, Logo } from "./icons";
import { PageMotion, prefersReducedMotion, useChromeMotion } from "./motion";

type Pending = CheckoutMode | "watch" | null;

type SiteContextValue = {
  user: User | null;
  profile: AppUser | null;
  series: Series[];
  payments: Payment[];
  owned: string[];
  subscribed: boolean;
  settings: Settings;
  ready: boolean;
  creatorSite: PublicCreator | null;
  creatorLookup: "idle" | "loading" | "ready" | "missing";
  homeHref: string;
  openFilm: (film: Series) => void;
  openAuth: () => void;
  beginCheckout: (mode: CheckoutMode, film?: Series | null) => void;
  logout: () => void;
};

const SiteContext = createContext<SiteContextValue | null>(null);

export function useSite() {
  const value = useContext(SiteContext);
  if (!value) throw new Error("useSite must be used inside SiteProvider");
  return value;
}

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [series, setSeries] = useState<Series[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [owned, setOwned] = useState<string[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [ready, setReady] = useState(false);
  const [creatorSite, setCreatorSite] = useState<PublicCreator | null>(null);
  const [creatorLookup, setCreatorLookup] = useState<"idle" | "loading" | "ready" | "missing">("idle");
  const creatorNameRef = useRef("");
  const [authOpen, setAuthOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [selected, setSelected] = useState<Series | null>(null);
  const [checkout, setCheckout] = useState<CheckoutMode | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [toast, setToast] = useState("");
  const rootRef = useRef<HTMLElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  useChromeMotion(rootRef);

  const subscribed = subscriptionActive(profile);
  const monthlyPrice = Number(settings.price || 14900);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  };

  useEffect(() => {
    const el = toastRef.current;
    if (!toast || !el || prefersReducedMotion()) return;
    const anim = animate(el, { opacity: [0, 1], y: [16, 0], scale: [0.94, 1], duration: 420, ease: "outBack" });
    return () => {
      anim.cancel();
    };
  }, [toast]);

  useEffect(() => {
    if (!firebaseConfigured()) {
      setReady(true);
      return;
    }
    const auth = clientAuth();
    const db = clientDb();
    const stopAuth = onAuthStateChanged(auth, async (next) => {
      setUser(next);
      if (!next) {
        setProfile(null);
        setOwned([]);
        setPayments([]);
        return;
      }
      const token = await next.getIdToken();
      const response = await fetch("/api/auth/bootstrap", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        await signOut(auth);
        notify(data.error || "Нэвтрэлт амжилтгүй.");
      }
    });
    const stopSeries = onSnapshot(query(collection(db, "series"), where("status", "==", "Нийтлэгдсэн")), (snap) => {
      setSeries(snap.docs.map((item) => seriesFromRecord(item.id, item.data())).sort((a, b) => b.createdAt - a.createdAt));
      setReady(true);
    });
    const stopSettings = onSnapshot(doc(db, "settings", "app"), (snap) => {
      if (snap.exists()) setSettings(mergeSettings(snap.data() as Settings));
    });
    return () => {
      stopAuth();
      stopSeries();
      stopSettings();
    };
  }, []);

  useEffect(() => {
    if (!user || !firebaseConfigured()) return;
    const db = clientDb();
    const stopUser = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) setProfile({ uid: user.uid, ...(snap.data() as Omit<AppUser, "uid">) });
    });
    const stopOwned = onSnapshot(query(collection(db, "purchases"), where("uid", "==", user.uid)), (snap) => {
      setOwned(snap.docs.map((item) => String(item.data().seriesId)));
    });
    const stopPayments = onSnapshot(query(collection(db, "payments"), where("uid", "==", user.uid)), (snap) => {
      setPayments(snap.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Payment, "id">) })).sort((a, b) => b.createdAt - a.createdAt));
    });
    return () => {
      stopUser();
      stopOwned();
      stopPayments();
    };
  }, [user]);

  useEffect(() => {
    const username = creatorUsernameFromPath(pathname);
    if (!username) {
      if (pathname === "/" || pathname.startsWith("/library") || pathname.startsWith("/account") || pathname.startsWith("/terms")) {
        creatorNameRef.current = "";
        setCreatorSite(null);
        setCreatorLookup("idle");
      }
      return;
    }
    if (creatorNameRef.current === username) return;
    creatorNameRef.current = username;
    setCreatorLookup("loading");
    setCreatorSite(null);
    fetch(`/api/creators/${encodeURIComponent(username)}`)
      .then(async (response) => {
        if (creatorNameRef.current !== username) return;
        if (!response.ok) {
          setCreatorSite(null);
          setCreatorLookup("missing");
          return;
        }
        const data = (await response.json()) as PublicCreator;
        if (data.username !== username || !data.id) {
          setCreatorSite(null);
          setCreatorLookup("missing");
          return;
        }
        setCreatorSite({
          id: String(data.id),
          name: String(data.name || username),
          username,
          contentType: String(data.contentType || ""),
        });
        setCreatorLookup("ready");
      })
      .catch(() => {
        if (creatorNameRef.current !== username) return;
        setCreatorSite(null);
        setCreatorLookup("missing");
      });
  }, [pathname]);

  const beginCheckout = (mode: CheckoutMode, film?: Series | null) => {
    if (film) setSelected(film);
    if (!user) {
      setPending(mode);
      setAuthOpen(true);
      return;
    }
    if (profile?.status === "Түр зогссон") {
      notify("Таны бүртгэл түр зогссон байна.");
      return;
    }
    setCheckout(mode);
  };

  const watch = (film: Series) => {
    setSelected(null);
    router.push(`/watch/${film.id}/1`);
  };

  const routeUsername = creatorUsernameFromPath(pathname);
  const watchOwner = pathname.startsWith("/watch/") ? series.find((item) => item.id === decodeURIComponent(pathname.split("/")[2] || ""))?.ownerId ?? "" : "";
  const creatorMatchesRoute = Boolean(routeUsername && creatorSite?.username === routeUsername);
  const creatorChrome = (Boolean(routeUsername) && creatorLookup !== "missing" && (creatorLookup !== "ready" || creatorMatchesRoute))
    || (!routeUsername && Boolean(creatorSite) && watchOwner !== "" && watchOwner === creatorSite?.id);
  const homeHref = creatorChrome ? `/c/${creatorSite?.username || routeUsername}` : "/";
  const brandName = creatorSite?.name || routeUsername;

  const value = useMemo<SiteContextValue>(
    () => ({
      user,
      profile,
      series,
      payments,
      owned,
      subscribed,
      settings,
      ready,
      creatorSite,
      creatorLookup,
      homeHref,
      openFilm: setSelected,
      openAuth: () => setAuthOpen(true),
      beginCheckout,
      logout: async () => {
        if (firebaseConfigured()) await signOut(clientAuth());
        setProfile(null);
        router.push(homeHref);
      },
    }),
    [user, profile, series, payments, owned, subscribed, settings, ready, creatorSite, creatorLookup, homeHref],
  );

  if (settings.maintenance) {
    return (
      <main ref={rootRef} data-site-root className="grid min-h-screen place-items-center bg-[#08080a] px-6 text-center text-white">
        <PageMotion />
        <div data-rise>
          <Logo href="/admin/login" />
          <h1 className="mt-8 text-3xl font-black">Засварын горим</h1>
          <p className="mt-3 text-sm text-zinc-500">CinemaFeel түр хугацаанд хаалттай байна.</p>
        </div>
      </main>
    );
  }

  const view = pathname.startsWith("/library") ? "library" : pathname.startsWith("/account") ? "account" : pathname.startsWith("/watch") ? "watch" : pathname.startsWith("/terms") ? "terms" : creatorChrome ? "creator" : "home";
  const dock = creatorChrome
    ? [[homeHref, "home", "Нүүр"], ["/account", "user", "Профайл"]]
    : [["/", "home", "Нүүр"], ["/library", "film", "Сан"], ["/account", "user", "Профайл"]];

  return (
    <SiteContext.Provider value={value}>
      <main ref={rootRef} data-site-root className="min-h-screen overflow-hidden bg-[#08080a] pb-20 text-white selection:bg-[#ff3d56] md:pb-0">
        <PageMotion />
        <header data-chrome="bar" className="fixed inset-x-0 top-0 z-40 border-b border-white/[0.06] bg-[#08080a]/85 backdrop-blur-xl">
          <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-8 px-5 md:px-10 lg:px-16">
            <span data-chrome="logo">
              {creatorChrome ? (
                <a href={homeHref} className="block max-w-[46vw] truncate text-lg font-black tracking-tight sm:max-w-xs sm:text-xl" aria-label={`${brandName} нүүр`}>{brandName}</a>
              ) : (
                <Logo href="/" header />
              )}
            </span>
            {!creatorChrome && (
              <nav className="ml-6 hidden items-center gap-7 text-sm font-semibold lg:flex">
                <a data-chrome="link" href="/" className={view === "home" ? "text-white" : "text-zinc-500 hover:text-white"}>Нүүр</a>
                <a data-chrome="link" href="/library" className={view === "library" ? "text-white" : "text-zinc-500 hover:text-white"}>Сан</a>
              </nav>
            )}
            <div className="ml-auto flex items-center gap-2">
              {!creatorChrome && (
                <button data-chrome="action" onClick={() => setJoinOpen(true)} className="flex h-10 shrink-0 items-center rounded-full bg-[#ff3d56] px-3 text-[11px] font-bold text-white sm:px-4 sm:text-xs">
                  <span className="sm:hidden">Нэгдэх</span>
                  <span className="hidden sm:inline">Бидэнтэй нэгдээрэй</span>
                </button>
              )}
              {user ? (
                <>
                  <a data-chrome="action" href="/account" className="grid h-10 w-10 place-items-center rounded-full bg-white text-xs font-black text-black">{accountInitial(profile?.email || user.email, profile?.phone || user.phoneNumber)}</a>
                  <button data-chrome="action" onClick={value.logout} className="hidden text-xs font-bold text-zinc-500 hover:text-white sm:block">Гарах</button>
                </>
              ) : (
                <button data-chrome="action" onClick={() => setAuthOpen(true)} className="flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 text-xs font-bold sm:px-4">
                  <Icon name="user" className="h-4 w-4" />
                  <span className="hidden sm:inline">Нэвтрэх</span>
                </button>
              )}
            </div>
          </div>
        </header>
        <div data-page>{children}</div>
        <footer data-rise className="mx-auto max-w-[1440px] border-t border-white/[.07] px-5 py-10 text-xs text-zinc-600 md:px-10 lg:px-16">
          <div className="flex flex-col justify-between gap-3 sm:flex-row">
            <p>© {new Date().getFullYear()} {creatorChrome ? `${brandName}. CinemaFeel дээр.` : "CinemaFeel. Богино түүх, том мэдрэмж."}</p>
            <div className="flex gap-5">
              <a href="/terms" className={pathname === "/terms" ? "text-zinc-300" : "hover:text-white"}>Үйлчилгээний нөхцөл</a>
              <a href={`mailto:${settings.email}`}>Тусламж</a>
            </div>
          </div>
        </footer>
        <nav data-chrome="dock" className="fixed inset-x-3 bottom-3 z-40 flex h-16 items-center justify-around rounded-2xl border border-white/10 bg-[#16161a]/95 shadow-2xl backdrop-blur-xl md:hidden">
          {dock.map(([href, icon, label]) => {
            const active = href === homeHref ? view === "creator" || (href === "/" && view === "home") : view === href.slice(1);
            return (
              <a key={label} href={user || href !== "/account" ? href : "#"} onClick={(event) => {
                if (href === "/account" && !user) {
                  event.preventDefault();
                  setAuthOpen(true);
                }
              }} className={`flex flex-col items-center gap-1 text-[10px] font-bold ${active ? "text-white" : "text-zinc-500"}`}>
                <Icon name={icon} className="h-5 w-5" />
                {label}
              </a>
            );
          })}
        </nav>
        {joinOpen && <JoinModal onClose={() => setJoinOpen(false)} />}
        {authOpen && (
          <AuthModal
            onClose={() => {
              setAuthOpen(false);
              setPending(null);
            }}
            onSuccess={() => {
              setAuthOpen(false);
              if (pending === "single" || pending === "weekly" || pending === "subscription") setCheckout(pending);
              if (pending === "watch" && selected) router.push(`/watch/${selected.id}/1`);
              if (!pending) notify("Амжилттай нэвтэрлээ.");
              setPending(null);
              if (pending === "watch") setSelected(null);
            }}
          />
        )}
        {selected && checkout === null && (
          <FilmModal
            film={selected}
            monthlyPrice={monthlyPrice}
            onClose={() => setSelected(null)}
            isOwned={owned.includes(selected.id)}
            subscribed={subscribed}
            signedIn={Boolean(user)}
            onCheckout={(mode) => beginCheckout(mode, selected)}
            onWatch={() => watch(selected)}
          />
        )}
        {checkout && (
          <CheckoutModal
            mode={checkout}
            film={selected}
            monthlyPrice={monthlyPrice}
            onModeChange={setCheckout}
            onClose={() => setCheckout(null)}
            onPaid={() => {
              setCheckout(null);
              notify("Төлбөр амжилттай. Таны үзэх эрх нээгдлээ.");
            }}
          />
        )}
        {toast && (
          <div className="fixed bottom-24 left-1/2 z-[90] -translate-x-1/2 md:bottom-8">
            <div ref={toastRef} className="flex items-center gap-2 whitespace-nowrap rounded-full bg-white px-5 py-3 text-xs font-extrabold text-black shadow-2xl">
              <Icon name="check" className="h-4 w-4 text-emerald-600" />
              {toast}
            </div>
          </div>
        )}
      </main>
    </SiteContext.Provider>
  );
}
