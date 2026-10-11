"use client";

import { useEffect, useRef, useState } from "react";
import { GoogleAuthProvider, signInWithCustomToken, signInWithPopup } from "firebase/auth";
import { Icon, Modal } from "./icons";
import { clientAuth } from "@/lib/firebase";

type Step = "start" | "otp" | "sms";
type Method = "email" | "phone";

type SmsSession = {
  sessionId: string;
  displayInstruction: string;
  code: string;
  smsUri: string;
  demo: boolean;
};

function codeRange(instruction: string, code: string) {
  for (const [open, close] of [["\"", "\""], ["“", "”"]] as const) {
    const form = `${open}${code}${close}`;
    const at = instruction.indexOf(form);
    if (at >= 0) return { start: at, end: at + form.length };
  }
  let from = 0;
  while (from < instruction.length) {
    const at = instruction.indexOf(code, from);
    if (at < 0) return null;
    const before = instruction[at - 1];
    const after = instruction[at + code.length];
    const digit = (char?: string) => Boolean(char && char >= "0" && char <= "9");
    if (!digit(before) && !digit(after)) return { start: at, end: at + code.length };
    from = at + 1;
  }
  return null;
}

function writeClipboard(value: string) {
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "0";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.focus();
  area.select();
  area.setSelectionRange(0, value.length);
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  area.remove();
  if (copied || !navigator.clipboard?.writeText) return Promise.resolve(copied);
  return navigator.clipboard.writeText(value).then(() => true).catch(() => false);
}

function SmsInstruction({ instruction, code }: { instruction: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const range = code ? codeRange(instruction, code) : null;
  const copy = () => {
    void writeClipboard(code).then((ok) => {
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };
  const mark = code ? (
    <span className="mx-1 inline-flex items-center gap-1 whitespace-nowrap align-middle">
      <span className="rounded-md bg-[#ff3d56]/20 px-1.5 text-base font-black tracking-[0.18em] text-white">{code}</span>
      <button type="button" onClick={copy} aria-label={copied ? "Хуулсан" : "Код хуулах"} className="grid h-7 w-7 place-items-center rounded-md text-zinc-300 hover:bg-white/10 hover:text-white">
        <Icon name={copied ? "check" : "copy"} className="h-4 w-4" />
      </button>
    </span>
  ) : null;
  return (
    <p className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm leading-7 text-zinc-200">
      {range ? instruction.slice(0, range.start) : instruction}
      {mark}
      {range ? instruction.slice(range.end) : null}
    </p>
  );
}

export function AuthModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<Step>("start");
  const [method, setMethod] = useState<Method>("phone");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [sms, setSms] = useState<SmsSession | null>(null);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const onSuccessRef = useRef(onSuccess);
  const finished = useRef(false);
  onSuccessRef.current = onSuccess;

  const finish = async (token: string) => {
    if (finished.current) return;
    finished.current = true;
    try {
      await signInWithCustomToken(clientAuth(), token);
      onSuccessRef.current();
    } catch {
      finished.current = false;
      setError("Нэвтрэхэд алдаа гарлаа.");
    }
  };

  useEffect(() => {
    if (step !== "sms" || !sms?.sessionId || expired) return;
    let stopped = false;
    const poll = async () => {
      if (stopped) return;
      try {
        const response = await fetch(`/api/auth/phone/status?sessionId=${encodeURIComponent(sms.sessionId)}`);
        const data = (await response.json()) as { status?: string; token?: string; error?: string };
        if (stopped) return;
        if (data.status === "VERIFIED" && data.token) {
          stopped = true;
          await finish(data.token);
          return;
        }
        if (data.status === "EXPIRED") {
          stopped = true;
          setExpired(true);
          setError("Кодын хугацаа дууссан. Хуучин код хүчингүй. Шинэ код авна уу.");
        }
      } catch {
        // Дараагийн шалгалт хүртэл хүлээнэ.
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 3000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [step, sms?.sessionId, expired]);

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
      await finish(data.token);
    } finally {
      setLoading(false);
    }
  };

  const startPhone = async () => {
    setLoading(true);
    setError("");
    setExpired(false);
    const response = await fetch("/api/auth/phone/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = (await response.json()) as SmsSession & { error?: string };
    setLoading(false);
    if (!response.ok || !data.sessionId) {
      setError(data.error || "Утасны баталгаажуулалт эхлүүлж чадсангүй.");
      return;
    }
    setSms({
      sessionId: data.sessionId,
      displayInstruction: data.displayInstruction,
      code: data.code,
      smsUri: data.smsUri,
      demo: Boolean(data.demo),
    });
    setStep("sms");
  };

  const confirmDemo = async () => {
    if (!sms) return;
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/phone/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sms.sessionId }),
    });
    const data = (await response.json()) as { error?: string; token?: string; status?: string };
    if (!response.ok || !data.token) {
      setLoading(false);
      if (data.status === "EXPIRED") {
        setExpired(true);
        setError("Кодын хугацаа дууссан. Шинэ код авна уу.");
        return;
      }
      setError(data.error || "Баталгаажуулж чадсангүй.");
      return;
    }
    try {
      await finish(data.token);
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

  const icon = step === "otp" ? "lock" : step === "sms" || method === "phone" ? "phone" : "mail";

  return (
    <Modal onClose={onClose} priority>
      <div className="p-7 sm:p-9">
        <div className="mb-7 grid h-12 w-12 place-items-center rounded-2xl bg-[#ff3d56]/15 text-[#ff536a]">
          <Icon name={icon} className="h-6 w-6" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff536a]">CinemaFeel-д тавтай морил</p>
        <h2 className="mt-2 text-2xl font-black">{step === "start" ? "Нэвтрэх" : step === "otp" ? "Код баталгаажуулах" : "Дугаараа баталгаажуулах"}</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-500">
          {step === "start" && "Google, email эсвэл утасны дугаараар нэвтэрнэ. Нууц үг шаардлагагүй."}
          {step === "otp" && (
            <>
              <b className="text-zinc-300">{email}</b> хаяг руу илгээсэн 6 оронтой кодыг оруулна уу.
            </>
          )}
          {step === "sms" && "Та өөрөө доорх кодыг мессежээр илгээнэ. Бид танд код илгээхгүй."}
        </p>
        {step === "start" && (
          <>
            <button disabled={loading} onClick={google} className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white text-sm font-extrabold text-black transition hover:bg-zinc-200 disabled:opacity-60">
              Google-ээр нэвтрэх
            </button>
            <div className="my-4 flex items-center gap-3 text-[10px] font-bold text-zinc-600">
              <span className="h-px flex-1 bg-white/10" />
              ЭСВЭЛ
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/[0.04] p-1">
              {([
                ["phone", "Утас"],
                ["email", "Email"],
              ] as const).map(([value, label]) => (
                <button key={value} onClick={() => { setMethod(value); setError(""); }} className={`h-10 rounded-lg text-xs font-extrabold ${method === value ? "bg-white text-black" : "text-zinc-400"}`}>
                  {label}
                </button>
              ))}
            </div>
            {method === "email" ? (
              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-bold text-zinc-400">EMAIL ХАЯГ</span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitEmail()} placeholder="name@example.com" type="email" className="h-[52px] w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm outline-none transition focus:border-[#ff536a]" />
              </label>
            ) : (
              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-bold text-zinc-400">УТАСНЫ ДУГААР</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && startPhone()} placeholder="99112233" inputMode="tel" autoComplete="tel" className="h-[52px] w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm outline-none transition focus:border-[#ff536a]" />
              </label>
            )}
          </>
        )}
        {step === "otp" && (
          <div className="mt-7">
            <span className="mb-2 block text-xs font-bold text-zinc-400">БАТАЛГААЖУУЛАХ КОД</span>
            <input autoFocus value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(e) => e.key === "Enter" && verify()} inputMode="numeric" placeholder="000000" className="h-14 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-center text-2xl font-black tracking-[0.45em] outline-none transition focus:border-[#ff536a]" />
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-zinc-600">Код 10 минут хүчинтэй</span>
              <button onClick={submitEmail} className="font-bold text-zinc-300 hover:text-white">Дахин илгээх</button>
            </div>
          </div>
        )}
        {step === "sms" && sms && (
          <div className="mt-7">
            <SmsInstruction instruction={sms.displayInstruction} code={sms.code} />
            {!expired && sms.smsUri && (
              <a href={sms.smsUri} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-extrabold text-black transition hover:bg-zinc-200">
                Мессеж нээж илгээх
              </a>
            )}
            {!expired && !sms.demo && <p className="mt-3 text-xs leading-5 text-zinc-500">144773 руу SMS илгээхэд 150₮. Илгээсний дараа энэ цонх өөрөө нэвтэрнэ.</p>}
            {!expired && sms.demo && (
              <button disabled={loading} onClick={confirmDemo} className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-white text-sm font-extrabold text-black disabled:opacity-60">
                {loading ? "Түр хүлээнэ үү..." : "SMS-гүй баталгаажуулах"}
              </button>
            )}
            {!expired && !sms.demo && <p className="mt-4 text-center text-xs font-bold text-zinc-400">SMS хүлээж байна...</p>}
            {expired && (
              <button disabled={loading} onClick={startPhone} className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-white text-sm font-extrabold text-black disabled:opacity-60">
                Шинэ код авах
              </button>
            )}
          </div>
        )}
        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
        {step !== "sms" && (
          <button disabled={loading} onClick={step === "otp" ? verify : method === "phone" ? startPhone : submitEmail} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-extrabold text-black transition hover:bg-zinc-200 disabled:opacity-60">
            {loading ? "Түр хүлээнэ үү..." : step === "otp" ? "Баталгаажуулж нэвтрэх" : method === "phone" ? "SMS заавар авах" : "Код авах"} <Icon name="arrow" className="h-4 w-4 rotate-180" />
          </button>
        )}
        {step !== "start" && (
          <button onClick={() => { setStep("start"); setError(""); setExpired(false); setSms(null); }} className="mt-4 w-full text-xs font-bold text-zinc-500 hover:text-white">
            {step === "otp" ? "Email хаягаа солих" : "Дугаараа солих"}
          </button>
        )}
        <p className="mt-7 text-center text-[10px] leading-5 text-zinc-600">Үргэлжлүүлснээр та үйлчилгээний нөхцөл болон нууцлалын бодлогыг зөвшөөрнө.</p>
      </div>
    </Modal>
  );
}
