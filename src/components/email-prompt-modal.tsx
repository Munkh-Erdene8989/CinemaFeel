"use client";

import { useState } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { clientAuth } from "@/lib/firebase";
import { Icon, Modal } from "./icons";

export function EmailPromptModal({ onClose, onLinked }: { onClose: () => void; onLinked: () => void }) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Зөв email хаяг оруулна уу.");
      return;
    }
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = (await response.json()) as { error?: string };
    setLoading(false);
    if (!response.ok) {
      setError(data.error || "Код илгээж чадсангүй.");
      return;
    }
    setStep("otp");
  };

  const linkEmail = async () => {
    if (otp.length !== 6) {
      setError("6 оронтой код оруулна уу.");
      return;
    }
    setLoading(true);
    setError("");
    const token = await clientAuth().currentUser?.getIdToken();
    const response = await fetch("/api/auth/email/link", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: otp }),
    });
    const data = (await response.json()) as { error?: string; token?: string };
    if (!response.ok || !data.token) {
      setLoading(false);
      setError(data.error || "Имэйл бүртгэж чадсангүй.");
      return;
    }
    try {
      await signInWithCustomToken(clientAuth(), data.token);
    } catch {
      setLoading(false);
      setError("Имэйл холбогдсон ч нэвтрэлт шинэчлэгдсэнгүй. Дахин нэвтэрнэ үү.");
      return;
    }
    setLoading(false);
    onLinked();
  };

  return (
    <Modal onClose={onClose} priority>
      <div className="p-7 sm:p-9">
        <div className="mb-7 grid h-12 w-12 place-items-center rounded-2xl bg-[#ff3d56]/15 text-[#ff536a]">
          <Icon name="mail" className="h-6 w-6" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff536a]">Имэйл бүртгэл</p>
        <h2 className="mt-2 text-2xl font-black">{step === "email" ? "Имэйлээ бүртгүүлнэ үү" : "Код баталгаажуулах"}</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-500">
          {step === "email" ? (
            "Та утасны дугаараар бүртгэлтэй. Шинэ кино, ангийн мэдэгдэл авахын тулд имэйл хаягаа нэмнэ үү."
          ) : (
            <>
              <b className="text-zinc-300">{email}</b> хаяг руу илгээсэн 6 оронтой кодыг оруулна уу.
            </>
          )}
        </p>
        {step === "email" ? (
          <label className="mt-7 block">
            <span className="mb-2 block text-xs font-bold text-zinc-400">EMAIL ХАЯГ</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendCode()} placeholder="name@example.com" type="email" autoComplete="email" className="h-[52px] w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm outline-none transition focus:border-[#ff536a]" />
          </label>
        ) : (
          <div className="mt-7">
            <span className="mb-2 block text-xs font-bold text-zinc-400">БАТАЛГААЖУУЛАХ КОД</span>
            <input autoFocus value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(e) => e.key === "Enter" && linkEmail()} inputMode="numeric" placeholder="000000" className="h-14 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-center text-2xl font-black tracking-[0.45em] outline-none transition focus:border-[#ff536a]" />
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-zinc-600">Код 10 минут хүчинтэй</span>
              <button onClick={sendCode} className="font-bold text-zinc-300 hover:text-white">Дахин илгээх</button>
            </div>
          </div>
        )}
        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
        <button disabled={loading} onClick={step === "otp" ? linkEmail : sendCode} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-extrabold text-black transition hover:bg-zinc-200 disabled:opacity-60">
          {loading ? "Түр хүлээнэ үү..." : step === "otp" ? "Имэйл бүртгэх" : "Код авах"} <Icon name="arrow" className="h-4 w-4 rotate-180" />
        </button>
        {step === "otp" && (
          <button onClick={() => { setStep("email"); setOtp(""); setError(""); }} className="mt-4 w-full text-xs font-bold text-zinc-500 hover:text-white">
            Email хаягаа солих
          </button>
        )}
      </div>
    </Modal>
  );
}
