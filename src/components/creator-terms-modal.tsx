"use client";

import { useEffect, type ReactNode } from "react";
import { Logo } from "./icons";
import { useOverlayMotion } from "./motion";

const fee = "10,000₮";

const splits = [
  ["Шууд борлуулалт", "80%", "20% систем ашигласны хураамж"],
  ["Сарын эрхийн сан", "Нийт орлогын 50%-ийн сангаас хувь тэнцүүлэн", "Үлдсэн 50% үйл ажиллагаанд"],
  ["Урилгын урамшуулал", "Уригдсан бүтээгчийн орлогын 10%-тай тэнцэх", "Урилгын хөтөлбөрийн нөхцөлөөр"],
];

function Clause({ index, children }: { index: string; children: ReactNode }) {
  return (
    <p className="text-sm leading-6 text-zinc-300">
      <span className="mr-2 font-black text-white">{index}</span>
      {children}
    </p>
  );
}

export function CreatorTermsModal({ busy, error, onAccept }: { busy: boolean; error: string; onAccept: () => void }) {
  const { backdropRef, panelRef } = useOverlayMotion();

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <>
    <div ref={backdropRef} className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md" />
    <div className="fixed inset-0 z-[100] grid place-items-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="creator-terms-title">
      <div ref={panelRef} className="flex max-h-[min(92vh,920px)] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#121216] shadow-2xl">
        <div className="shrink-0 border-b border-white/[.07] px-6 py-5 sm:px-8">
          <Logo onClick={() => undefined} />
          <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.22em] text-[#ff536a]">CinemaFeel</p>
          <h2 id="creator-terms-title" className="mt-2 text-2xl font-black sm:text-3xl">Контент бүтээгчээр нэгдэх нөхцөл</h2>
          <p className="mt-3 text-xs font-bold tracking-wide text-zinc-500">Орлого хуваарилалт · Төлбөр тооцоо · Контентын хариуцлага</p>
        </div>

        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-6 sm:px-8">
          <p className="text-sm leading-6 text-zinc-400">
            Энэхүү баримт бичиг нь CinemaFeel платформд контент бүтээгчээр нэгдэхэд мөрдөх үндсэн нөхцөл, орлого олох хэлбэр, төлбөр тооцооны зарчим болон нийтэлсэн контенттой холбоотой хариуцлагыг тодорхойлно.
          </p>

          <section className="space-y-3">
            <h3 className="text-base font-black">1. Бүртгэл ба нэгдэх нөхцөл</h3>
            <Clause index="1.1.">CinemaFeel платформд контент бүтээгчээр бүртгүүлэх бүртгэлийн хураамж {fee} байна.</Clause>
            <Clause index="1.2.">Бүртгэл амжилттай баталгаажсанаар контент бүтээгч нь платформын контент нийтлэх болон орлого хүлээн авах боломжуудыг ашиглана.</Clause>
            <div className="rounded-2xl border border-[#ff3d56]/30 bg-[#ff3d56]/10 px-5 py-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#ff536a]">Бүртгэлийн хураамж</p>
              <p className="mt-1 text-3xl font-black">{fee}</p>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-base font-black">2. Орлого олох 3 арга</h3>
            <div className="space-y-2">
              <h4 className="text-sm font-black">2.1. Өөрийн контент, кино, сургалтаас шууд орлого олох</h4>
              <p className="text-sm leading-6 text-zinc-400">Контент бүтээгч нь өөрийн бэлтгэсэн кино, контент, сургалт болон бусад дижитал материалыг CinemaFeel-д байршуулж, өөрийн тогтоосон үнээр хэрэглэгчдэд санал болгох боломжтой.</p>
              <p className="text-sm leading-6 text-zinc-400">Тухайн контентын борлуулалтын орлогын 20%-ийг CinemaFeel систем ашигласны хураамж болгон суутгана. Энэ хураамж нь вебсайтын ашиглалт, төлбөрийн систем, имэйл маркетинг болон платформын үйл ажиллагаатай холбоотой зардлыг санхүүжүүлэхэд ашиглагдана.</p>
              <p className="text-sm leading-6 text-zinc-300">Ингэснээр тухайн борлуулалтын орлогын 80% нь контент бүтээгчид ногдоно.</p>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-black">2.2. Сарын эрхийн орлогоос хувь хүртэх</h4>
              <p className="text-sm leading-6 text-zinc-400">CinemaFeel-ийн сарын эрхийн нийт орлогыг 100% гэж үзвэл 50%-ийг контент бүтээгчдэд хуваарилж, үлдсэн 50%-ийг платформын үйл ажиллагаа, хөгжүүлэлт болон холбогдох зардалд зарцуулна.</p>
              <p className="text-sm leading-6 text-zinc-400">Контент бүтээгчдэд хуваарилах 50%-ийн санг платформ дээрх нийт контент болон үзэлтийн гүйцэтгэлтэй уялдуулан хувь тэнцүүлж олгоно.</p>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-black">2.3. Контент бүтээгч урьж урамшуулал авах</h4>
              <p className="text-sm leading-6 text-zinc-400">Контент бүтээгч нь өөрийн таньдаг бусад контент бүтээгчийг CinemaFeel платформд урьж нэгдэх боломжтой.</p>
              <p className="text-sm leading-6 text-zinc-400">Таны урилгаар бүртгүүлсэн контент бүтээгчийн өөрийн оруулсан контент борлуулагдсан тохиолдолд тухайн контентийн борлуулалтын үнийн дүнгийн 10%-тай тэнцэх хэмжээний урамшууллыг урьсан контент бүтээгч авна. (Энэхүү 10%-ийн урамшуулал нь зөвхөн тухайн контент бүтээгчийн оруулсан контентийн борлуулалтын орлогод хамаарах бөгөөд сарын багцын орлого болон сарын эрхийн хуваарилалтад хамаарахгүй.)</p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/[.07]">
              <p className="border-b border-white/[.07] bg-white/[.03] px-4 py-3 text-sm font-black">Орлогын бүтэц — товчоор</p>
              <div className="hidden grid-cols-[1.1fr_1.3fr_1.2fr] gap-3 border-b border-white/[.07] px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500 sm:grid">
                <span>Орлогын төрөл</span>
                <span>Контент бүтээгчид</span>
                <span>CinemaFeel / нөхцөл</span>
              </div>
              {splits.map(([kind, creator, platform]) => (
                <div key={kind} className="grid gap-1 border-b border-white/[.06] px-4 py-3 text-sm last:border-0 sm:grid-cols-[1.1fr_1.3fr_1.2fr] sm:gap-3">
                  <p className="font-bold">{kind}</p>
                  <p className="text-zinc-300">{creator}</p>
                  <p className="text-zinc-500">{platform}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-black">3. Төлбөр тооцоо</h3>
            <Clause index="3.1.">Контент бүтээгчийн орлогын шилжүүлгийг 15 хоног тутам хийх зарчмаар тооцно.</Clause>
            <Clause index="3.2.">Хуримтлагдсан орлого болон төлбөрийн мэдээлэл контент бүтээгчийн Dashboard дахь “Орлого” хэсэгт харагдана.</Clause>
            <Clause index="3.3.">Dashboard дахь “Цалин” хэсгээс тухайн хугацаанд авах боломжтой мөнгөн дүнг харах боломжтой.</Clause>
            <Clause index="3.4.">Орлогын шилжүүлгийг контент бүтээгчийн бүртгэлтэй данс руу хийнэ.</Clause>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-black">4. Контент ба хариуцлага</h3>
            <Clause index="4.1.">Контент бүтээгч нь өөрийн CinemaFeel платформд нийтэлсэн бүх контентын эх сурвалж, ашиглах эрх, оюуны өмч болон холбогдох зөвшөөрлийг өөрөө бүрэн хариуцна.</Clause>
            <Clause index="4.2.">Нийтэлсэн контент нь зохиогчийн эрх, барааны тэмдэг, дүрс бичлэг, дуу хөгжим, хувь хүний нууц, нэр төр болон Монгол Улсын холбогдох хууль тогтоомжийг зөрчихгүй байх ёстой.</Clause>
            <Clause index="4.3.">Контент бүтээгчийн нийтэлсэн материалтай холбоотой гуравдагч этгээдийн гомдол, шаардлага, оюуны өмчийн маргаан болон хууль зүйн үр дагаврыг тухайн контент бүтээгч бүрэн хариуцна.</Clause>
            <Clause index="4.4.">CinemaFeel нь хууль зөрчсөн, эрхийн маргаантай эсвэл платформын шаардлагад нийцээгүй контентыг шалгах, түр нуух эсвэл устгах эрхтэй байж болно.</Clause>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-black">5. Нөхцөлийг хүлээн зөвшөөрөх</h3>
            <p className="text-sm leading-6 text-zinc-400">Контент бүтээгчээр бүртгүүлж, CinemaFeel платформыг ашиглаж эхэлснээр энэхүү баримт бичигт тусгасан бүртгэл, орлого хуваарилалт, төлбөр тооцоо болон контентын хариуцлагын үндсэн нөхцөлийг уншиж танилцсан, хүлээн зөвшөөрсөнд тооцно.</p>
          </section>
        </div>

        <div className="shrink-0 border-t border-white/[.07] bg-[#121216] px-6 py-4 sm:px-8">
          {error && <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
          <button disabled={busy} onClick={onAccept} className="h-12 w-full rounded-xl bg-white text-sm font-extrabold text-black disabled:opacity-60">
            {busy ? "Хадгалж байна..." : "Уншиж танилцсан, хүлээн зөвшөөрч байна"}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
