"use client";

import { useRef, useState, type RefObject } from "react";
import { useOverlayMotion } from "./motion";

const paths: Record<string, string> = {
  play: "m9 6 9 6-9 6V6Z",
  search: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm5-2 4 4",
  bookmark: "M6.5 4.5h11v16L12 17l-5.5 3.5v-16Z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c.7-4 3-6 7-6s6.3 2 7 6",
  home: "m4 10 8-6 8 6v10h-5v-6H9v6H4V10Z",
  close: "m6 6 12 12M18 6 6 18",
  check: "m5 12 4 4L19 6",
  arrow: "m9 18 6-6-6-6",
  card: "M3 7h18v11H3V7Zm0 4h18M7 15h3",
  mail: "M3 6h18v12H3V6Zm1 1 8 6 8-6",
  phone: "M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm4 15h.01",
  copy: "M8 8h11v11H8V8ZM5 15V5h10",
  lock: "M6 10h12v10H6V10Zm3 0V7a3 3 0 0 1 6 0v3",
  film: "M4 4h16v16H4V4Zm0 5h16M8 4v5m8-5v5",
  reel: "M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm1 4h6",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  users: "M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c.5-4 2.8-6 7-6 2.4 0 4.2.7 5.4 2M17 11a3 3 0 1 0 0-6m1 9c2.4.5 3.7 2.5 4 5",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-12v2m0 13v2M3.5 12h2m13 0h2M6 6l1.5 1.5m9 9L18 18M18 6l-1.5 1.5m-9 9L6 18",
  plus: "M12 5v14M5 12h14",
  logout: "M10 5H5v14h5m4-3 4-4-4-4m4 4H9",
  camera: "M9 6 10.5 4h3L15 6h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4Zm3 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  spark: "M12 2.5 13.4 8 19 9.5 13.4 11 12 16.5 10.6 11 5 9.5 10.6 8 12 2.5ZM18 13.5l.7 2.5 2.3.7-2.3.7-.7 2.4-.7-2.4-2.3-.7 2.3-.7.7-2.5Z",
};

export function Icon({ name, className = "h-5 w-5", fill = false }: { name: string; className?: string; fill?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[name]} />
    </svg>
  );
}

export function Logo({ onClick, href = "/", header = false }: { onClick?: () => void; href?: string; header?: boolean }) {
  const image = header ? (
    <img src="/cinema-feel-header.png" alt="cinema feel" className="h-9 w-auto sm:h-11" />
  ) : (
    <img src="/feel-cinema-logo.png" alt="feel cinema" className="h-11 w-auto sm:h-12" />
  );
  if (onClick) {
    return (
      <button onClick={onClick} className="block" aria-label="CinemaFeel нүүр хуудас">
        {image}
      </button>
    );
  }
  return (
    <a href={href} className="block" aria-label="CinemaFeel нүүр хуудас">
      {image}
    </a>
  );
}

export function Modal({ children, onClose, wide = false, priority = false, size }: { children: React.ReactNode; onClose: () => void; wide?: boolean; priority?: boolean; size?: "md" | "lg" | "xl" }) {
  const width = size === "xl" ? "max-w-6xl" : size === "lg" ? "max-w-4xl" : wide ? "max-w-3xl" : "max-w-md";
  const { backdropRef, panelRef, requestClose } = useOverlayMotion(onClose);
  const layer = priority ? "z-[80]" : "z-[70]";
  return (
    <>
      <div ref={backdropRef} className={`fixed inset-0 ${layer} bg-black/85 backdrop-blur-md`} />
      <div className={`fixed inset-0 ${layer} grid place-items-center overflow-y-auto p-4`} role="dialog" aria-modal="true">
        <div ref={panelRef} className={`relative my-6 w-full ${width} overflow-hidden rounded-3xl border border-white/10 bg-[#151519] shadow-2xl`}>
          <button onClick={requestClose} className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/30 text-zinc-300 backdrop-blur-md hover:bg-white/10" aria-label="Хаах">
            <Icon name="close" />
          </button>
          {children}
        </div>
      </div>
    </>
  );
}

export function AdminField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

export function FilePicker({
  accept,
  disabled,
  fileName,
  emptyLabel = "Файл сонгоогүй",
  buttonLabel = "Файл сонгох",
  onFile,
  inputRef,
}: {
  accept?: string;
  disabled?: boolean;
  fileName?: string;
  emptyLabel?: string;
  buttonLabel?: string;
  onFile: (file: File | null) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const ownRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? ownRef;
  const [picked, setPicked] = useState("");
  const shown = fileName !== undefined ? fileName : picked;
  return (
    <div className={`flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-2 ${disabled ? "opacity-40" : ""}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          ref.current?.click();
        }}
        className="h-8 shrink-0 rounded-lg bg-white px-3 text-xs font-extrabold text-black disabled:opacity-40"
      >
        {buttonLabel}
      </button>
      <span className="min-w-0 truncate text-sm text-zinc-400">{shown || emptyLabel}</span>
      <input
        ref={ref}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          setPicked(file?.name ?? "");
          onFile(file);
        }}
      />
    </div>
  );
}

const imageTypes = ["image/jpeg", "image/png", "image/webp"];

export function ImageDrop({
  label,
  badge,
  hint,
  src,
  ratio,
  wide = false,
  onFile,
}: {
  label: string;
  badge?: string;
  hint: string;
  src?: string;
  ratio: string;
  wide?: boolean;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [reject, setReject] = useState("");
  const take = (file: File | null | undefined) => {
    if (!file) return;
    if (!imageTypes.includes(file.type)) {
      setReject("JPG, PNG эсвэл WEBP зураг оруулна уу.");
      return;
    }
    setReject("");
    onFile(file);
  };

  return (
    <div className="min-w-0">
      <button
        type="button"
        aria-label={`${label} оруулах`}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node)) return;
          setOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          take(event.dataTransfer.files?.[0]);
        }}
        className={`group relative block w-full overflow-hidden rounded-2xl border text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff536a] ${over ? "border-[#ff536a] bg-[#ff536a]/10" : src ? "border-white/15 bg-black" : "border-dashed border-white/20 bg-white/[0.03] hover:border-white/40 hover:bg-white/[0.05]"}`}
      >
        <div className={`relative ${ratio} w-full`}>
          {src ? <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" /> : (
            <div className={`absolute inset-0 flex ${wide ? "items-center gap-4 px-5 text-left" : "flex-col items-center justify-center px-3 text-center"}`}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-black">
                <Icon name="camera" className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-white">{label}</span>
                <span className="mt-1 block text-[11px] leading-4 text-zinc-500">{hint}</span>
              </span>
            </div>
          )}
          {src && !over && (
            <>
              <span className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] text-white backdrop-blur-md">
                {badge || label}
              </span>
              <span className="absolute bottom-3 right-3 rounded-full bg-white px-3 py-1.5 text-[11px] font-extrabold text-black shadow-lg">Солих</span>
            </>
          )}
          {over && (
            <span className="absolute inset-0 grid place-items-center bg-black/55 px-3">
              <span className="rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-black">Энд тавина уу</span>
            </span>
          )}
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={imageTypes.join(",")}
        className="sr-only"
        onChange={(event) => {
          take(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {reject && <p className="mt-2 text-[11px] font-bold text-red-400">{reject}</p>}
    </div>
  );
}
