"use client";

import { useState, type ReactNode } from "react";
import type { QPayUrl } from "@/lib/types";
import { CREATOR_FEE, creatorContentTypes } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { Icon } from "./icons";
import { StepMotion, useOverlayMotion } from "./motion";

type Step = "choose" | "benefits" | "form" | "pay" | "done";

type FormState = {
  lastName: string;
  firstName: string;
  username: string;
  cornerName: string;
  password: string;
  phone: string;
  email: string;
  contentType: string;
  portfolio: string;
  experience: string;
  inviteCode: string;
  bankName: string;
  bankAccount: string;
  terms: boolean;
};

type Invoice = {
  senderInvoiceNo: string;
  qrImage: string;
  urls: QPayUrl[];
  amount: number;
  username: string;
  welcomeSent?: boolean;
};

const emptyForm: FormState = {
  lastName: "",
  firstName: "",
  username: "",
  cornerName: "",
  password: "",
  phone: "",
  email: "",
  contentType: "Short drama",
  portfolio: "",
  experience: "",
  inviteCode: "",
  bankName: "",
  bankAccount: "",
  terms: false,
};

const benefits = [
  ["01", "Бүтээлээ олон нийтэд хүргэх", "CinemaFeel-ийн үзэгчид болон мэргэжилтнүүдэд бүтээлээ шууд хүргэнэ."],
  ["02", "Орлого олох боломж", "Үзэлт болон борлуулалтаас тогтвортой орлого олно."],
  ["03", "Мэргэжлийн дэмжлэг", "Контент хадгалалт болон үзэлтийн үзүүлэлтээр дэмжинэ."],
];

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-zinc-400">
        {label}
        {required && <span className="text-[#ff536a]"> *</span>}
      </span>
      {children}
    </label>
  );
}

export function JoinModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("choose");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const ready =
    form.lastName.trim().length >= 2 &&
    form.firstName.trim().length >= 2 &&
    /^[a-z0-9._-]{3,32}$/i.test(form.username.trim()) &&
    /^[\p{L}\p{N}][\p{L}\p{N} .'_-]{1,39}$/u.test(form.cornerName.trim().replace(/\s+/g, " ")) &&
    form.password.length >= 8 &&
    form.phone.replace(/\D/g, "").length >= 8 &&
    form.email.includes("@") &&
    form.bankName.trim().length >= 2 &&
    form.bankAccount.replace(/\D/g, "").length >= 8 &&
    form.terms;

  const pay = async () => {
    setLoading(true);
    setError("");
    const response = await fetch("/api/creators/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = (await response.json()) as Invoice & { error?: string; welcomeSent?: boolean };
    setLoading(false);
    if (!response.ok || !data.senderInvoiceNo) {
      setError(data.error || "Бүртгэл үүсгэж чадсангүй.");
      return;
    }
    setInvoice({
      senderInvoiceNo: data.senderInvoiceNo,
      qrImage: data.qrImage || "",
      urls: data.urls || [],
      amount: data.amount || CREATOR_FEE,
      username: data.username || form.username.trim().toLowerCase(),
      welcomeSent: data.welcomeSent === true,
    });
    setStep("pay");
  };

  const check = async () => {
    if (!invoice) return;
    setLoading(true);
    setError("");
    const response = await fetch("/api/creators/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senderInvoiceNo: invoice.senderInvoiceNo }),
    });
    const data = (await response.json()) as { error?: string; paid?: boolean };
    setLoading(false);
    if (!response.ok) {
      setError(data.error || "Төлбөр шалгаж чадсангүй.");
      return;
    }
    if (!data.paid) {
      setError("Төлбөр хараахан баталгаажаагүй байна. Төлсний дараа дахин шалгана уу.");
      return;
    }
    setStep("done");
  };

  const wide = step === "benefits" || step === "form" || step === "choose";
  const { backdropRef, panelRef, requestClose } = useOverlayMotion(onClose);

  return (
    <>
    <div ref={backdropRef} className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md" />
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-labelledby="join-title">
      <div ref={panelRef} className={`relative my-6 w-full ${wide ? "max-w-3xl" : "max-w-md"} rounded-[28px] border border-white/10 bg-[#16161b] p-6 shadow-2xl sm:p-8`}>
        <button onClick={requestClose} className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/5 text-zinc-300 hover:bg-white/10" aria-label="Хаах">
          <Icon name="close" className="h-4 w-4" />
        </button>
        <StepMotion stepKey={step}>

        {step === "choose" && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#ff536a]">CinemaFeel Community</p>
            <h2 id="join-title" className="mt-3 text-3xl font-black">Бидэнтэй нэгдээрэй</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">Өөрт тохирох хамтын ажиллагааны төрлөө сонгон CinemaFeel-ийн бүтээлч хүрээлэлд нэгдээрэй.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <button onClick={() => { setError(""); setStep("benefits"); }} className="flex flex-col rounded-2xl border border-[#ff3d56]/80 bg-gradient-to-b from-[#ff3d56]/25 via-[#2a1218] to-[#1a1216] p-5 text-left">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#ff3d56] text-white">
                  <Icon name="camera" className="h-6 w-6" />
                </span>
                <span className="mt-8 text-lg font-black">Контент бүтээгч</span>
                <span className="mt-2 text-sm leading-6 text-zinc-300">Өөрийн түүхээ бүтээж, CinemaFeel-ийн үзэгчдэд хүргээрэй.</span>
                <span className="mt-8 inline-flex items-center gap-1 text-sm font-bold text-[#ff536a]">
                  Дэлгэрэнгүй
                  <Icon name="arrow" className="h-4 w-4" />
                </span>
              </button>
              <div className="flex flex-col rounded-2xl border border-white/10 bg-[#1c1c22] p-5 text-left" aria-disabled="true">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-zinc-300">
                  <Icon name="spark" className="h-6 w-6" />
                </span>
                <span className="mt-8 flex items-center gap-2">
                  <span className="text-lg font-black text-zinc-200">Инфлюэнсэр</span>
                  <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold tracking-wide text-zinc-400">ТҮН УДАХГҮЙ</span>
                </span>
                <span className="mt-2 text-sm leading-6 text-zinc-500">Онцгой контентыг өөрийн хүчээр түгээж, брэндтэй хамтран ажиллаарай.</span>
                <span className="mt-8 text-sm font-semibold text-zinc-600">Бүртгэл удахгүй нээгдэнэ</span>
              </div>
            </div>
          </div>
        )}

        {step === "benefits" && (
          <div>
            <button onClick={() => setStep("choose")} className="mb-6 inline-flex items-center gap-1 text-xs font-bold text-zinc-400 hover:text-white">
              <Icon name="arrow" className="h-3.5 w-3.5 rotate-180" />
              Буцах
            </button>
            <div className="grid gap-8 md:grid-cols-[0.9fr_1.1fr] md:gap-10">
              <div>
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#ff3d56] text-white">
                  <Icon name="camera" className="h-7 w-7" />
                </span>
                <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.2em] text-[#ff536a]">Creator program</p>
                <h2 id="join-title" className="mt-3 text-4xl font-black leading-tight">Таны түүх.<br />Манай тайз.</h2>
                <p className="mt-4 text-sm leading-6 text-zinc-400">Монгол short drama-ийн дараагийн хит бүтээлд хамтдаа бүтээцгээе.</p>
              </div>
              <div>
                <h3 className="text-xl font-black">Контент бүтээгчийн давуу тал</h3>
                <ol className="mt-5 space-y-4">
                  {benefits.map(([index, title, text]) => (
                    <li key={index} className="flex gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#ff3d56]/15 text-[11px] font-black text-[#ff536a]">{index}</span>
                      <span>
                        <span className="block text-sm font-bold">{title}</span>
                        <span className="mt-1 block text-xs leading-5 text-zinc-500">{text}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-5 text-zinc-400">
                  Бүртгэлийн {formatMoney(CREATOR_FEE)} хураамж төлсний дараа админ хуудас шууд нээгдэж, контентоо оруулахад бэлэн болно.
                </p>
                <button onClick={() => { setError(""); setStep("form"); }} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-extrabold text-black">
                  Бүртгүүлэх
                  <Icon name="arrow" className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {step === "form" && (
          <div>
            <button onClick={() => setStep("benefits")} className="mb-5 inline-flex items-center gap-1 text-xs font-bold text-zinc-400 hover:text-white">
              <Icon name="arrow" className="h-3.5 w-3.5 rotate-180" />
              Давуу тал руу буцах
            </button>
            <div className="flex items-start justify-between gap-4 pr-8">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#ff536a]">Контент бүтээгчийн бүртгэл</p>
                <h2 id="join-title" className="mt-2 text-3xl font-black">Мэдээллээ оруулна уу</h2>
                <p className="mt-2 text-xs text-zinc-500"><span className="text-[#ff536a]">*</span> тэмдэгтэй талбарыг заавал бөглөнө</p>
              </div>
              <span className="hidden shrink-0 rounded-full bg-[#ff3d56]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#ff536a] sm:inline">Аюулгүй бүртгэл</span>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Овог" required><input value={form.lastName} onChange={(e) => update("lastName", e.target.value)} placeholder="Овог" className="admin-input !h-11" /></Field>
              <Field label="Нэр" required><input value={form.firstName} onChange={(e) => update("firstName", e.target.value)} placeholder="Нэр" className="admin-input !h-11" /></Field>
              <Field label="Нэвтрэх нэр" required><input value={form.username} onChange={(e) => update("username", e.target.value.toLowerCase())} placeholder="creator_name" autoCapitalize="none" autoCorrect="off" className="admin-input !h-11" /></Field>
              <div>
                <Field label="Кино булангийн нэр" required><input value={form.cornerName} onChange={(e) => update("cornerName", e.target.value)} placeholder="Жишээ: Сувдаа кино" className="admin-input !h-11" /></Field>
                <p className="mt-2 text-[11px] text-zinc-600">Хуваалцах хуудсан дээр энэ нэр гарна. Дараа нь 2 удаа солино.</p>
              </div>
              <Field label="Нууц үг" required><input value={form.password} onChange={(e) => update("password", e.target.value)} type="password" placeholder="8-аас дээш тэмдэгт" autoComplete="new-password" className="admin-input !h-11" /></Field>
              <Field label="Утас" required><input value={form.phone} onChange={(e) => update("phone", e.target.value)} inputMode="tel" placeholder="+976 9911 2233" className="admin-input !h-11" /></Field>
              <Field label="Email" required><input value={form.email} onChange={(e) => update("email", e.target.value)} type="email" placeholder="name@example.com" className="admin-input !h-11" /></Field>
              <Field label="Контентын төрөл">
                <select value={form.contentType} onChange={(e) => update("contentType", e.target.value)} className="admin-input !h-11">
                  {creatorContentTypes.map((type) => <option key={type}>{type}</option>)}
                </select>
              </Field>
              <Field label="Портфолио / сошиал холбоос"><input value={form.portfolio} onChange={(e) => update("portfolio", e.target.value)} placeholder="https://..." className="admin-input !h-11" /></Field>
              <Field label="Банкны нэр" required><input value={form.bankName} onChange={(e) => update("bankName", e.target.value)} placeholder="Хаан банк" className="admin-input !h-11" /></Field>
              <Field label="Дансны дугаар" required><input value={form.bankAccount} onChange={(e) => update("bankAccount", e.target.value.replace(/[^\d\s]/g, ""))} inputMode="numeric" placeholder="5000 123456" className="admin-input !h-11" /></Field>
              <div className="sm:col-span-2">
                <Field label="Урилгын код">
                  <input value={form.inviteCode} onChange={(e) => update("inviteCode", e.target.value.toUpperCase())} placeholder="Урьсан хүний код" autoCapitalize="characters" autoCorrect="off" className="admin-input !h-11 uppercase tracking-[0.12em]" />
                </Field>
                <p className="mt-2 text-[11px] text-zinc-600">Урьсан хүн байвал түүний урилгын кодыг оруулна.</p>
              </div>
            </div>
            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-semibold text-zinc-400">Туршлага, бүтээлийн санаа</span>
              <textarea value={form.experience} onChange={(e) => update("experience", e.target.value)} placeholder="Өөрийн туршлага болон хийхийг хүссэн контентын талаар товч бичнэ үү." className="admin-input h-24 py-3" />
            </label>
            <label className="mt-4 flex items-start gap-3 text-xs leading-5 text-zinc-400">
              <input checked={form.terms} onChange={(e) => update("terms", e.target.checked)} type="checkbox" className="mt-0.5 h-4 w-4 accent-[#ff3d56]" />
              <span>Үйлчилгээний нөхцөл, контент бүтээгчийн гэрээ болон нууцлалын бодлогыг зөвшөөрч байна.</span>
            </label>
            {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
            <button disabled={!ready || loading} onClick={pay} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ff3d56] text-sm font-extrabold text-white disabled:opacity-40">
              <Icon name="card" className="h-4 w-4" />
              {loading ? "Нэхэмжлэх үүсгэж байна..." : "Төлбөр төлөх"}
            </button>
            <p className="mt-3 text-center text-[11px] text-zinc-600">Бүртгэлийн хураамж {formatMoney(CREATOR_FEE)} · QPay · Төлбөрийн мэдээллийг аюулгүй шифрлэлтээр дамжуулна</p>
          </div>
        )}

        {step === "pay" && invoice && (
          <div>
            <button onClick={() => { setError(""); setStep("form"); }} className="mb-5 inline-flex items-center gap-1 text-xs font-bold text-zinc-400 hover:text-white">
              <Icon name="arrow" className="h-3.5 w-3.5 rotate-180" />
              Мэдээлэл рүү буцах
            </button>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#ff536a]">Бүртгэлийн хураамж</p>
            <h2 id="join-title" className="mt-2 text-2xl font-black">{formatMoney(invoice.amount)} QPay</h2>
            <p className="mt-2 text-sm text-zinc-400">Төлбөр баталгаажмагц админ хуудас шууд нээгдэнэ.</p>
            {invoice.qrImage && (
              <img src={invoice.qrImage.startsWith("data:") ? invoice.qrImage : `data:image/png;base64,${invoice.qrImage}`} alt="QPay QR" className="mx-auto mt-6 h-52 w-52 rounded-2xl bg-white p-3" />
            )}
            <div className="mt-4 grid max-h-52 grid-cols-3 gap-2 overflow-y-auto">
              {invoice.urls.map((item) => {
                const label = item.description || item.name;
                return (
                  <a key={item.link} href={item.link} title={label} aria-label={label} className="grid h-16 place-items-center rounded-xl border border-white/10 bg-white/[0.04] px-2 hover:bg-white/10">
                    {item.logo ? <img src={item.logo} alt="" className="h-10 w-10 object-contain" /> : <span className="truncate text-[10px] font-bold text-zinc-300">{label}</span>}
                  </a>
                );
              })}
            </div>
            {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
            <button disabled={loading} onClick={check} className="mt-4 h-12 w-full rounded-xl bg-white text-sm font-extrabold text-black disabled:opacity-60">
              {loading ? "Төлбөр шалгаж байна..." : "Төлсөн, шалгах"}
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="py-4 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-400">
              <Icon name="check" className="h-7 w-7" />
            </span>
            <h2 id="join-title" className="mt-5 text-2xl font-black">Бүртгэл баталгаажлаа</h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-400">
              {formatMoney(CREATOR_FEE)} бүртгэлийн хураамж төлөгдсөн. Админ хуудас ашиглахад бэлэн.
            </p>
            {invoice?.username && <p className="mt-4 text-xs text-zinc-500">Нэвтрэх нэр: <span className="font-bold text-white">{invoice.username}</span></p>}
            {invoice?.welcomeSent && <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-zinc-500">Нэвтрэх нэр, нууц үг болон дашбоардын линкийг имэйлээр илгээлээ.</p>}
            <a href="/admin" className="mt-6 flex h-12 items-center justify-center rounded-xl bg-white text-sm font-extrabold text-black">
              Админ хуудас руу орох
            </a>
          </div>
        )}
        </StepMotion>
      </div>
    </div>
    </>
  );
}
