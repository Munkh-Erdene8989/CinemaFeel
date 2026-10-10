"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import type { AppUser, CheckoutMode, Payment, Series, Settings } from "@/lib/types";
import { defaultSettings } from "@/lib/types";
import { clientAuth, clientDb, firebaseConfigured } from "@/lib/firebase";
import { subscriptionActive } from "@/lib/format";
import { AuthModal } from "./auth-modal";
import { CheckoutModal } from "./checkout-modal";
import { FilmModal } from "./film-modal";
import { Icon, Logo } from "./icons";

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

function asSeries(id: string, data: Record<string, unknown>): Series {
  return {
    id,
    title: String(data.title ?? ""),
    genre: String(data.genre ?? ""),
    description: String(data.description ?? ""),
    episodes: Number(data.episodes ?? 0),
    price: Number(data.price ?? 0),
    access: data.access === "free" ? "free" : "paid",
    image: String(data.image ?? ""),
    cover: String(data.cover ?? ""),
    shareCode: String(data.shareCode ?? ""),
    views: Number(data.views ?? 0),
    status: data.status === "Ноорог" ? "Ноорог" : "Нийтлэгдсэн",
    featured: Boolean(data.featured),
    year: Number(data.year ?? new Date().getFullYear()),
    age: String(data.age ?? "13+"),
    createdAt: Number(data.createdAt ?? 0),
  };
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
  const [authOpen, setAuthOpen] = useState(false);
  const [selected, setSelected] = useState<Series | null>(null);
  const [checkout, setCheckout] = useState<CheckoutMode | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [toast, setToast] = useState("");

  const subscribed = subscriptionActive(profile);
  const monthlyPrice = Number(settings.price || 14900);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  };

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
      setSeries(snap.docs.map((item) => asSeries(item.id, item.data())).sort((a, b) => b.createdAt - a.createdAt));
      setReady(true);
    });
    const stopSettings = onSnapshot(doc(db, "settings", "app"), (snap) => {
      if (snap.exists()) setSettings({ ...defaultSettings, ...(snap.data() as Settings) });
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
      openFilm: setSelected,
      openAuth: () => setAuthOpen(true),
      beginCheckout,
      logout: async () => {
        if (firebaseConfigured()) await signOut(clientAuth());
        setProfile(null);
        router.push("/");
      },
    }),
    [user, profile, series, payments, owned, subscribed, settings, ready],
  );

  if (settings.maintenance) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#08080a] px-6 text-center text-white">
        <div>
          <Logo href="/admin/login" />
          <h1 className="mt-8 text-3xl font-black">Засварын горим</h1>
          <p className="mt-3 text-sm text-zinc-500">CinemaFeel түр хугацаанд хаалттай байна.</p>
        </div>
      </main>
    );
  }

  const view = pathname.startsWith("/library") ? "library" : pathname.startsWith("/account") ? "account" : pathname.startsWith("/watch") ? "watch" : "home";

  return (
    <SiteContext.Provider value={value}>
      <main className="min-h-screen overflow-hidden bg-[#08080a] pb-20 text-white selection:bg-[#ff3d56] md:pb-0">
        <header className="fixed inset-x-0 top-0 z-40 border-b border-white/[0.06] bg-[#08080a]/85 backdrop-blur-xl">
          <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-8 px-5 md:px-10 lg:px-16">
            <Logo href="/" />
            <nav className="ml-6 hidden items-center gap-7 text-sm font-semibold lg:flex">
              <a href="/" className={view === "home" ? "text-white" : "text-zinc-500 hover:text-white"}>Нүүр</a>
              <a href="/library" className={view === "library" ? "text-white" : "text-zinc-500 hover:text-white"}>Сан</a>
              <a href="/admin" className="text-zinc-500 hover:text-white">Админ</a>
            </nav>
            <div className="ml-auto flex items-center gap-2">
              {user ? (
                <>
                  <a href="/account" className="grid h-10 w-10 place-items-center rounded-full bg-white text-xs font-black text-black">{(profile?.email || user.email || "C")[0]?.toUpperCase()}</a>
                  <button onClick={value.logout} className="hidden text-xs font-bold text-zinc-500 hover:text-white sm:block">Гарах</button>
                </>
              ) : (
                <button onClick={() => setAuthOpen(true)} className="flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 text-xs font-bold">
                  <Icon name="user" className="h-4 w-4" />
                  Нэвтрэх
                </button>
              )}
            </div>
          </div>
        </header>
        {children}
        <footer className="mx-auto max-w-[1440px] border-t border-white/[.07] px-5 py-10 text-xs text-zinc-600 md:px-10 lg:px-16">
          <div className="flex flex-col justify-between gap-3 sm:flex-row">
            <p>© {new Date().getFullYear()} CinemaFeel. Богино түүх, том мэдрэмж.</p>
            <div className="flex gap-5">
              <span>Үйлчилгээний нөхцөл</span>
              <a href={`mailto:${settings.email}`}>Тусламж</a>
              <a href="/admin">Админ</a>
            </div>
          </div>
        </footer>
        <nav className="fixed inset-x-3 bottom-3 z-40 flex h-16 items-center justify-around rounded-2xl border border-white/10 bg-[#16161a]/95 shadow-2xl backdrop-blur-xl md:hidden">
          {[
            ["/", "home", "Нүүр"],
            ["/library", "film", "Сан"],
            ["/account", "user", "Профайл"],
          ].map(([href, icon, label]) => (
            <a key={href} href={user || href !== "/account" ? href : "#"} onClick={(event) => {
              if (href === "/account" && !user) {
                event.preventDefault();
                setAuthOpen(true);
              }
            }} className={`flex flex-col items-center gap-1 text-[10px] font-bold ${view === (href === "/" ? "home" : href.slice(1)) ? "text-white" : "text-zinc-500"}`}>
              <Icon name={icon} className="h-5 w-5" />
              {label}
            </a>
          ))}
        </nav>
        {authOpen && (
          <AuthModal
            onClose={() => {
              setAuthOpen(false);
              setPending(null);
            }}
            onSuccess={() => {
              setAuthOpen(false);
              if (pending === "single" || pending === "subscription") setCheckout(pending);
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
            onClose={() => setCheckout(null)}
            onPaid={() => {
              setCheckout(null);
              notify("Төлбөр амжилттай. Таны үзэх эрх нээгдлээ.");
            }}
          />
        )}
        {toast && (
          <div className="fixed bottom-24 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white px-5 py-3 text-xs font-extrabold text-black shadow-2xl md:bottom-8">
            <Icon name="check" className="h-4 w-4 text-emerald-600" />
            {toast}
          </div>
        )}
      </main>
    </SiteContext.Provider>
  );
}
