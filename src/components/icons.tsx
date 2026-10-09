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
  lock: "M6 10h12v10H6V10Zm3 0V7a3 3 0 0 1 6 0v3",
  film: "M4 4h16v16H4V4Zm0 5h16M8 4v5m8-5v5",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  users: "M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c.5-4 2.8-6 7-6 2.4 0 4.2.7 5.4 2M17 11a3 3 0 1 0 0-6m1 9c2.4.5 3.7 2.5 4 5",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-12v2m0 13v2M3.5 12h2m13 0h2M6 6l1.5 1.5m9 9L18 18M18 6l-1.5 1.5m-9 9L6 18",
  plus: "M12 5v14M5 12h14",
  logout: "M10 5H5v14h5m4-3 4-4-4-4m4 4H9",
};

export function Icon({ name, className = "h-5 w-5", fill = false }: { name: string; className?: string; fill?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[name]} />
    </svg>
  );
}

export function Logo({ onClick, href = "/" }: { onClick?: () => void; href?: string }) {
  const image = (
    <span className="relative block h-10 w-36 overflow-hidden rounded-lg bg-[#f1f2f4] sm:w-44">
      <img src="/cinemafeel-logo.jpg" alt="CinemaFeel" className="absolute left-1/2 top-1/2 w-44 max-w-none -translate-x-1/2 -translate-y-1/2 sm:w-52" />
    </span>
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

export function Modal({ children, onClose, wide = false, priority = false }: { children: React.ReactNode; onClose: () => void; wide?: boolean; priority?: boolean }) {
  return (
    <div className={`fixed inset-0 ${priority ? "z-[80]" : "z-[70]"} grid place-items-center overflow-y-auto bg-black/85 p-4 backdrop-blur-md`} role="dialog" aria-modal="true">
      <div className={`relative my-6 w-full ${wide ? "max-w-3xl" : "max-w-md"} overflow-hidden rounded-3xl border border-white/10 bg-[#151519] shadow-2xl`}>
        <button onClick={onClose} className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/30 text-zinc-300 backdrop-blur-md hover:bg-white/10" aria-label="Хаах">
          <Icon name="close" />
        </button>
        {children}
      </div>
    </div>
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
