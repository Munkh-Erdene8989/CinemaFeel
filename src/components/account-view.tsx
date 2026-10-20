"use client";

import { WEEKLY_PRICE } from "@/lib/types";
import { accountIdentity, accountInitial, formatDate, formatMoney } from "@/lib/format";
import { Icon } from "./icons";
import { useSite } from "./site-provider";

export function AccountView() {
  const { user, profile, subscribed, owned, payments, beginCheckout, openAuth, logout } = useSite();
  if (!user) {
    return (
      <section className="mx-auto grid min-h-screen max-w-xl place-items-center px-5 pt-24 text-center">
        <div data-rise>
          <h1 className="text-3xl font-black">Нэвтрэх шаардлагатай</h1>
          <button onClick={openAuth} className="mt-6 rounded-full bg-white px-6 py-3 text-sm font-extrabold text-black">Нэвтрэх</button>
        </div>
      </section>
    );
  }
  const identity = accountIdentity(profile?.email || user.email, profile?.phone || user.phoneNumber);
  return (
    <section className="mx-auto min-h-screen max-w-5xl px-5 pb-24 pt-32 md:px-10">
      <div data-rise className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-5">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white text-xl font-black text-black">{accountInitial(profile?.email || user.email, profile?.phone || user.phoneNumber)}</span>
          <div className="min-w-0">
            <h1 className="text-2xl font-black">Миний бүртгэл</h1>
            <p className="mt-1 truncate text-sm text-zinc-500">{identity || "CinemaFeel"}</p>
          </div>
        </div>
        <button onClick={logout} className="flex h-10 w-fit shrink-0 items-center gap-2 rounded-full border border-white/10 px-4 text-xs font-bold text-zinc-300 hover:border-white/25 hover:text-white sm:ml-auto">
          <Icon name="logout" className="h-4 w-4" />
          Гарах
        </button>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <div data-rise data-delay="0.05" className="rounded-2xl border border-white/10 bg-white/[.03] p-6">
          <p className="text-xs text-zinc-500">ЭРХИЙН ТӨЛӨВ</p>
          <p className={`mt-3 text-xl font-black ${subscribed ? "text-emerald-400" : "text-white"}`}>{profile?.status === "Түр зогссон" ? "Түр зогссон" : subscribed ? "Plus идэвхтэй" : "Үндсэн эрх"}</p>
          <p className="mt-2 text-xs leading-5 text-zinc-600">{subscribed && profile?.subscriptionExpiresAt ? `Дуусах: ${formatDate(profile.subscriptionExpiresAt)}` : "Зөвхөн үнэгүй болон авсан кино"}</p>
          {!subscribed && profile?.status !== "Түр зогссон" && (
            <button onClick={() => beginCheckout("weekly")} className="mt-5 text-xs font-bold text-[#ff6679]">7 хоног · {formatMoney(WEEKLY_PRICE)} →</button>
          )}
        </div>
        <div data-rise data-delay="0.12" className="rounded-2xl border border-white/10 bg-white/[.03] p-6">
          <p className="text-xs text-zinc-500">ХУДАЛДАН АВАЛТ</p>
          <p className="mt-3 text-3xl font-black">{owned.length}</p>
          <p className="mt-2 text-xs text-zinc-600">Хугацаагүй үзэх кино</p>
        </div>
        <div data-rise data-delay="0.18" className="rounded-2xl border border-white/10 bg-white/[.03] p-6">
          <p className="text-xs text-zinc-500">ТӨЛБӨР</p>
          <p className="mt-3 text-3xl font-black">{payments.filter((item) => item.status === "Амжилттай").length}</p>
          <p className="mt-2 text-xs text-zinc-600">Амжилттай гүйлгээ</p>
        </div>
      </div>
      <h2 data-rise className="mt-12 text-xl font-black">Төлбөрийн түүх</h2>
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        {payments.length === 0 && <p data-rise className="px-5 py-8 text-sm text-zinc-500">Төлбөр хараахан алга.</p>}
        {payments.map((row, index) => (
          <div key={row.id} data-rise data-delay={String((index % 6) * 0.04)} className="flex items-center justify-between border-b border-white/[.06] bg-white/[.02] px-5 py-4 last:border-0">
            <div>
              <p className="text-sm font-bold">{row.product}</p>
              <p className="mt-1 text-xs text-zinc-600">{row.date || formatDate(row.createdAt)} · QPay · {row.status}</p>
            </div>
            <span className="text-sm font-bold">{formatMoney(row.amount)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
