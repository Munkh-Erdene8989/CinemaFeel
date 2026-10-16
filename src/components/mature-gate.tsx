"use client";

import { useEffect, useState } from "react";
import { readMatureConsent, writeMatureConsent } from "@/lib/mature";
import { Modal } from "./icons";

export function useMatureConsent() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    setAllowed(readMatureConsent());
  }, []);
  const allow = () => {
    writeMatureConsent();
    setAllowed(true);
  };
  return { allowed, allow };
}

export function MatureGate({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  return (
    <Modal onClose={onDecline} priority>
      <div className="p-7 md:p-9">
        <p className="text-[11px] font-black uppercase tracking-[.2em] text-[#ff6679]">+18</p>
        <h2 className="mt-3 text-2xl font-black">Та 18 нас хүрсэн үү?</h2>
        <p className="mt-4 text-sm leading-7 text-zinc-400">Энэ ангилал насанд хүрэгчдэд зориулагдсан. Үргэлжлүүлснээр та 18 нас хүрсэн гэдгээ баталж байна.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button onClick={onDecline} className="h-12 flex-1 rounded-xl border border-white/10 text-sm font-bold text-zinc-300">Үгүй</button>
          <button onClick={onAccept} className="h-12 flex-1 rounded-xl bg-white text-sm font-extrabold text-black">Тийм, 18 хүрсэн</button>
        </div>
      </div>
    </Modal>
  );
}
