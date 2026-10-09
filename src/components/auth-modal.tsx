"use client";

import { useState } from "react";
import { GoogleAuthProvider, signInWithCustomToken, signInWithPopup } from "firebase/auth";
import { Icon, Modal } from "./icons";
import { clientAuth } from "@/lib/firebase";

export function AuthModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submitEmail = async () => {
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

  const verify = async () => {
    if (otp.length !== 6) {
      setError("6 оронтой код оруулна уу.");
      return;
    }
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: otp }),
    });
    const data = (await response.json()) as { error?: string; token?: string };
    if (!response.ok || !data.token) {
      setLoading(false);
      setError(data.error || "Код буруу байна.");
      return;
    }
    try {
      await signInWithCustomToken(clientAuth(), data.token);
      onSuccess();
    } catch {
      setError("Нэвтрэхэд алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setLoading(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(clientAuth(), provider);
      onSuccess();
    } catch {
      setError("Google нэвтрэлт цуцлагдлаа эсвэл алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose} priority>
      <div className="p-7 sm:p-9">
        <div className="mb-7 grid h-12 w-12 place-items-center rounded-2xl bg-[#ff3d56]/15 text-[#ff536a]">
          <Icon name={step === "email" ? "mail" : "lock"} className="h-6 w-6" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff536a]">CinemaFeel-д тавтай морил</p>
        <h2 className="mt-2 text-2xl font-black">{step === "email" ? "Нэвтрэх" : "Код баталгаажуулах"}</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-500">
          {step === "email" ? (
            "Google-ээр эсвэл email рүү илгээх 6 оронтой кодоор нэвтэрнэ. Нууц үг шаардлагагүй."
          ) : (
            <>
              <b className="text-zinc-300">{email}</b> хаяг руу илгээсэн 6 оронтой кодыг оруулна уу.
            </>
          )}
        </p>
        {step === "email" ? (
          <>
            <button disabled={loading} onClick={google} className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white text-sm font-extrabold text-black transition hover:bg-zinc-200 disabled:opacity-60">
              Google-ээр нэвтрэх
            </button>
            <div className="my-4 flex items-center gap-3 text-[10px] font-bold text-zinc-600">
              <span className="h-px flex-1 bg-white/10" />
              ЭСВЭЛ
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-zinc-400">EMAIL ХАЯГ</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitEmail()} placeholder="name@example.com" type="email" className="h-[52px] w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm outline-none transition focus:border-[#ff536a]" />
            </label>
          </>
        ) : (
          <div className="mt-7">
            <span className="mb-2 block text-xs font-bold text-zinc-400">БАТАЛГААЖУУЛАХ КОД</span>
            <input autoFocus value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(e) => e.key === "Enter" && verify()} inputMode="numeric" placeholder="000000" className="h-14 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-center text-2xl font-black tracking-[0.45em] outline-none transition focus:border-[#ff536a]" />
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-zinc-600">Код 10 минут хүчинтэй</span>
              <button onClick={submitEmail} className="font-bold text-zinc-300 hover:text-white">Дахин илгээх</button>
            </div>
          </div>
        )}
        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
        <button disabled={loading} onClick={step === "email" ? submitEmail : verify} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-extrabold text-black transition hover:bg-zinc-200 disabled:opacity-60">
          {loading ? "Түр хүлээнэ үү..." : step === "email" ? "Код авах" : "Баталгаажуулж нэвтрэх"} <Icon name="arrow" className="h-4 w-4 rotate-180" />
        </button>
        {step === "otp" && (
          <button onClick={() => { setStep("email"); setError(""); }} className="mt-4 w-full text-xs font-bold text-zinc-500 hover:text-white">
            Email хаягаа солих
          </button>
        )}
        <p className="mt-7 text-center text-[10px] leading-5 text-zinc-600">Үргэлжлүүлснээр та үйлчилгээний нөхцөл болон нууцлалын бодлогыг зөвшөөрнө.</p>
      </div>
    </Modal>
  );
}
