"use client";

export const creatorGuideSteps = [
  {
    section: "Хяналтын самбар",
    title: "Хяналтын самбар",
    role: "Энд таны ажлын тойм харагдана. Орлого, үзэлт, урилга нэг дор байна.",
    points: [
      ["Миний орлого", "Шууд борлуулалт, сарын эрхийн хувь, урилгыг нэгтгэсэн дүн."],
      ["Шууд борлуулалт", "Өөрийн контентын үнийн 80% танд ногдоно."],
      ["Сарын эрхийн хувь", "Сарын эрхийн сангаас таны үзэлтэд ногдох хэсэг."],
      ["Урилгын код", "Хуулж өөр бүтээгчид өгнө. Тэдний борлуулалтын 10% танд орно."],
    ],
  },
  {
    section: "Контент",
    title: "Контент",
    role: "Энд кино, цуврал, сургалтаа оруулж, үзэгчдэд харуулна.",
    points: [
      ["Шинэ контент", "Нэр, төрөл, үнэ, постер, ковер болон ангийн видео нэмнэ."],
      ["Ноорог", "Хараахан сайт дээр гарахгүй. Нийтлэгдсэн бол үзэгчдэд харагдана."],
      ["Линк", "Тухайн контентыг хуваалцах холбоос."],
      ["Засах", "Нэр, үнэ, ангийг дараа нь шинэчилнэ."],
    ],
  },
  {
    section: "Орлого",
    title: "Орлого",
    role: "Энд мөнгө хаанаас бүрдсэнийг контент бүрээр харна.",
    points: [
      ["Сарын эрхийн хувь", "Үзэлтийн хувиар танд ногдсон дүн."],
      ["Шууд борлуулалт", "Контент тус бүрийн үнийн 80%."],
      ["Урилгын урамшуулал", "Урьсан бүтээгчийн борлуулалтын 10%."],
      ["Хүснэгт", "Контент бүрийн үзэлт, борлуулалт, танд ногдох нийт."],
    ],
  },
] as const;

export function CreatorGuide({
  step,
  busy,
  error,
  onStep,
  onDone,
}: {
  step: number;
  busy: boolean;
  error: string;
  onStep: (index: number) => void;
  onDone: () => void;
}) {
  const current = creatorGuideSteps[step] ?? creatorGuideSteps[0];
  const last = step === creatorGuideSteps.length - 1;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] p-3 sm:p-6">
      <div className="pointer-events-auto mx-auto w-full max-w-xl rounded-[28px] border border-white/10 bg-[#16161b]/95 p-5 shadow-2xl backdrop-blur-md sm:p-6" role="dialog" aria-modal="false" aria-labelledby="creator-guide-title">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#ff536a]">Эхлэх заавар · {step + 1}/{creatorGuideSteps.length}</p>
          <div className="flex gap-1.5" aria-hidden="true">
            {creatorGuideSteps.map((item, index) => (
              <span key={item.section} className={`h-1.5 rounded-full ${index === step ? "w-6 bg-[#ff536a]" : "w-1.5 bg-white/20"}`} />
            ))}
          </div>
        </div>
        <h2 id="creator-guide-title" className="mt-3 text-xl font-black">{current.title}</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">{current.role}</p>
        <ul className="mt-4 space-y-2.5">
          {current.points.map(([label, text]) => (
            <li key={label} className="text-sm leading-6 text-zinc-300">
              <span className="font-black text-white">{label}.</span> {text}
            </li>
          ))}
        </ul>
        {last && <p className="mt-4 text-xs leading-5 text-zinc-500">«Сайт руу буцах» нь CinemaFeel руу гаргана. «Гарах» нь самбараас гарна.</p>}
        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
        <div className="mt-5 flex items-center gap-2">
          {step > 0 && (
            <button disabled={busy} onClick={() => onStep(step - 1)} className="h-11 rounded-xl border border-white/10 px-4 text-xs font-bold text-zinc-300 disabled:opacity-50">
              Буцах
            </button>
          )}
          {last ? (
            <button disabled={busy} onClick={onDone} className="h-11 flex-1 rounded-xl bg-white text-sm font-extrabold text-black disabled:opacity-60">
              {busy ? "Хадгалж байна..." : "Ойлголоо"}
            </button>
          ) : (
            <button disabled={busy} onClick={() => onStep(step + 1)} className="h-11 flex-1 rounded-xl bg-white text-sm font-extrabold text-black">
              Дараах цэс
            </button>
          )}
          {!last && (
            <button disabled={busy} onClick={onDone} className="h-11 rounded-xl px-3 text-xs font-bold text-zinc-500 disabled:opacity-50">
              Алгасах
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
