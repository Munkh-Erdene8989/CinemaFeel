"use client";

import { formatDate, formatMoney } from "@/lib/format";
import { useSite } from "./site-provider";

export function AccountView() {
  const { user, profile, subscribed, owned, payments, beginCheckout, openAuth } = useSite();
  if (!user) {
    return (
      <section className="mx-auto grid min-h-screen max-w-xl place-items-center px-5 pt-24 text-center">
        <div>
          <h1 className="text-3xl font-black">Нэвтрэх шаардлагатай</h1>
          <button onClick={openAuth} className="mt-6 rounded-full bg-white px-6 py-3 text-sm font-extrabold text-black">Нэвтрэх</button>
        </div>
      </section>
    );
  }
  const email = profile?.email || user.email || "";
  return (
    <section className="mx-auto min-h-screen max-w-5xl px-5 pb-24 pt-32 md:px-10">
      <div className="flex items-center gap-5">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-xl font-black text-black">{email[0]?.toUpperCase()}</span>
        <div>
          <h1 className="text-2xl font-black">Миний бүртгэл</h1>
          <p className="mt-1 text-sm text-zinc-500">{email}</p>
        </div>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[.03] p-6">
          <p className="text-xs text-zinc-500">ЭРХИЙН ТӨЛӨВ</p>
          <p className={`mt-3 text-xl font-black ${subscribed ? "text-emerald-400" : "text-white"}`}>{profile?.status === "Түр зогссон" ? "Түр зогссон" : subscribed ? "Plus идэвхтэй" : "Үндсэн эрх"}</p>
          <p className="mt-2 text-xs leading-5 text-zinc-600">{subscribed && profile?.subscriptionExpiresAt ? `Дуусах: ${formatDate(profile.subscriptionExpiresAt)}` : "Зөвхөн үнэгүй болон авсан кино"}</p>
          {!subscribed && profile?.status !== "Түр зогссон" && (
            <button onClick={() => beginCheckout("subscription")} className="mt-5 text-xs font-bold text-[#ff6679]">Эрхээ ахиулах →</button>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[.03] p-6">
          <p className="text-xs text-zinc-500">ХУДАЛДАН АВАЛТ</p>
          <p className="mt-3 text-3xl font-black">{owned.length}</p>
          <p className="mt-2 text-xs text-zinc-600">Хугацаагүй үзэх кино</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[.03] p-6">
          <p className="text-xs text-zinc-500">ТӨЛБӨР</p>
          <p className="mt-3 text-3xl font-black">{payments.filter((item) => item.status === "Амжилттай").length}</p>
          <p className="mt-2 text-xs text-zinc-600">Амжилттай гүйлгээ</p>
        </div>
      </div>
      <h2 className="mt-12 text-xl font-black">Төлбөрийн түүх</h2>
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        {payments.length === 0 && <p className="px-5 py-8 text-sm text-zinc-500">Төлбөр хараахан алга.</p>}
        {payments.map((row) => (
          <div key={row.id} className="flex items-center justify-between border-b border-white/[.06] bg-white/[.02] px-5 py-4 last:border-0">
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
