import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "../components/icons";
import { catById, faceUrl, jobUrl, quadPos, type Pro } from "./store";

/* ── reduced motion ── */
export function useReducedMotion() {
  const [rm, setRm] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const h = () => setRm(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return rm;
}

/* ── entrance animation ── */
export function FadeUp({ children, d = 0, className = "" }: { children: ReactNode; d?: number; className?: string }) {
  return (
    <div className={`animate-rise ${className}`} style={{ animationDelay: `${d}ms` }}>
      {children}
    </div>
  );
}

/* ── fake loading hook ── */
export function useFakeLoad(ms = 700) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return loading;
}

/* ── avatar with real photo (quadrant crop) + initials fallback ── */
export function Face({ face, name, size = "w-12 h-12", className = "" }: { face: { f: number; q: number }; name: string; size?: string; className?: string }) {
  const [err, setErr] = useState(false);
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  if (err) {
    return (
      <span className={`${size} ${className} rounded-full grid place-items-center bg-pinesoft text-pine font-disp font-bold text-sm shrink-0`}>
        {initials}
      </span>
    );
  }
  return (
    <span className={`${size} ${className} relative rounded-full overflow-hidden bg-tint shrink-0 ring-2 ring-card`}>
      <span
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${faceUrl(face.f)})`,
          backgroundSize: "200% 200%",
          backgroundPosition: quadPos(face.q),
        }}
        role="img"
        aria-label={name}
      />
      <img src={faceUrl(face.f)} alt="" className="hidden" onError={() => setErr(true)} />
    </span>
  );
}

/* ── job / portfolio photo ── */
export function JobPhoto({ i, className = "w-full h-full" }: { i: number; className?: string }) {
  const [err, setErr] = useState(false);
  if (err) return <span className={`${className} grid place-items-center bg-tint text-soft`}><Icon name="camera" className="w-6 h-6" /></span>;
  return (
    <img src={jobUrl(i)} alt="Trabajo realizado" className={`${className} object-cover`} onError={() => setErr(true)} loading="lazy" />
  );
}

/* ── star rating ── */
export function Stars({ n, size = "w-3.5 h-3.5" }: { n: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-[1px]" aria-label={`${n} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 24 24" className={`${size} ${i <= Math.round(n) ? "text-sun" : "text-line"}`} fill="currentColor">
          <path d="m12 3.2 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.4l5.9-.8L12 3.2Z" />
        </svg>
      ))}
    </span>
  );
}

/* ── verified pill ── */
export function Verif({ label = "Verificado" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-pine font-bold text-[0.68rem]">
      <span className="w-3.5 h-3.5 rounded-full bg-pine grid place-items-center">
        <Icon name="check" className="w-2 h-2 text-white" strokeWidth={3.4} />
      </span>
      {label}
    </span>
  );
}

/* ── availability dot ── */
export function AvailDot({ pulse = true }: { pulse?: boolean }) {
  return (
    <span className="relative inline-flex w-2.5 h-2.5">
      {pulse && <span className="absolute inset-0 rounded-full bg-ok animate-pulse-ring" />}
      <span className="relative w-2.5 h-2.5 rounded-full bg-ok" />
    </span>
  );
}

/* ── section header ── */
export function RowHead({ icon, title, sub, action }: { icon?: string; title: string; sub?: string; action?: { label: string; fn: () => void } }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-4">
      <div>
        <h2 className="font-disp font-bold text-[1.15rem] leading-tight text-ink flex items-center gap-2">
          {icon && (
            <span className="w-7 h-7 rounded-lg bg-pinesoft text-pine grid place-items-center shrink-0">
              <Icon name={icon as never} className="w-4 h-4" strokeWidth={2} />
            </span>
          )}
          {title}
        </h2>
        {sub && <p className="text-[0.78rem] text-mut font-medium mt-0.5">{sub}</p>}
      </div>
      {action && (
        <button onClick={action.fn} className="text-[0.78rem] font-bold text-pine hover:text-pine2 whitespace-nowrap flex items-center gap-1 shrink-0">
          {action.label} <Icon name="chevr" className="w-3.5 h-3.5" strokeWidth={2.6} />
        </button>
      )}
    </div>
  );
}

/* ── horizontal scroller ── */
export function Carousel({ children }: { children: ReactNode }) {
  return <div className="flex gap-3.5 overflow-x-auto no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0 pb-1 snap-x">{children}</div>;
}

/* ── compact pro card (carousels) ── */
export function ProCard({ p, onOpen, onRequest }: { p: Pro; onOpen: () => void; onRequest: () => void }) {
  return (
    <div className="card card-h snap-start shrink-0 w-[13.2rem] p-4 flex flex-col">
      <button onClick={onOpen} className="text-left">
        <div className="relative inline-block">
          <Face face={p.face} name={p.name} size="w-14 h-14" />
          {p.available && <span className="absolute -bottom-0.5 -right-0.5"><AvailDot /></span>}
        </div>
        <p className="font-disp font-bold text-[0.95rem] mt-2.5 leading-tight">{p.name}</p>
        <p className="text-[0.7rem] text-mut font-semibold mt-0.5 flex items-center gap-1">
          <span className="text-sun">★</span> {p.rating.toFixed(1)}
          <span className="text-soft">· {p.reviews} reseñas</span>
        </p>
        <p className="text-[0.7rem] text-mut font-medium mt-1 line-clamp-1">{p.cats[0] ? catById(p.cats[0]).name : ""}</p>
      </button>
      <div className="mt-auto pt-3 flex items-center justify-between gap-2">
        <span className="text-[0.68rem] font-bold text-mut">{p.km} km</span>
        <button onClick={onRequest} className="btn-pine h-8 px-3.5 text-[0.72rem]">Solicitar</button>
      </div>
    </div>
  );
}

/* ── full-width pro list card (results, favoritos) ── */
export function ProListItem({ p, onOpen, onRequest, delay = 0, fav, onFav }: { p: Pro; onOpen: () => void; onRequest: () => void; delay?: number; fav?: boolean; onFav?: () => void }) {
  return (
    <FadeUp d={delay}>
      <div className="card card-h p-4 flex gap-3.5">
        <button onClick={onOpen} className="relative shrink-0 self-start" aria-label={`Ver perfil de ${p.name}`}>
          <Face face={p.face} name={p.name} size="w-16 h-16" />
          {p.available && <span className="absolute bottom-0 right-0"><AvailDot /></span>}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button onClick={onOpen} className="text-left min-w-0">
              <p className="font-disp font-bold text-[1rem] leading-tight truncate">{p.name}</p>
              <p className="text-[0.74rem] text-mut font-semibold mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-0.5 text-ink font-bold"><span className="text-sun">★</span>{p.rating.toFixed(1)}</span>
                <span className="text-soft">({p.reviews})</span>
                {p.verified.pro && <Verif />}
              </p>
            </button>
            {onFav && (
              <button onClick={onFav} className="shrink-0 w-8 h-8 grid place-items-center rounded-full hover:bg-tint transition-colors" aria-label="Favorito">
                <Icon name="heart" className={`w-4.5 h-4.5 ${fav ? "text-cor fill-cor" : "text-soft"}`} strokeWidth={2} fill={fav ? "currentColor" : "none"} />
              </button>
            )}
          </div>

          <p className="text-[0.72rem] text-mut font-medium mt-1 line-clamp-1">{p.tagline}</p>

          <div className="flex items-center gap-2 flex-wrap mt-2">
            {p.available ? (
              <span className="inline-flex items-center gap-1.5 text-[0.68rem] font-bold text-ok bg-oksoft rounded-full px-2 py-0.5">
                <AvailDot pulse={false} /> Disponible · llega en ~{p.eta} min
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[0.68rem] font-bold text-soft bg-tint rounded-full px-2 py-0.5">
                <span className="w-2 h-2 rounded-full bg-soft" /> Ocupado
              </span>
            )}
            <span className="text-[0.68rem] font-bold text-mut inline-flex items-center gap-1">
              <Icon name="pin" className="w-3 h-3" strokeWidth={2.4} /> {p.km} km
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 mt-3">
            <span className="text-[0.7rem] font-bold text-ink">
              desde <span className="font-disp">RD${p.price.toLocaleString()}</span>
            </span>
            <button onClick={onRequest} disabled={!p.available} className="btn-pine h-9 px-4 text-[0.74rem] disabled:opacity-40 disabled:shadow-none">
              Solicitar
            </button>
          </div>
        </div>
      </div>
    </FadeUp>
  );
}

/* ── skeletons ── */
export function SkelCards({ n = 4 }: { n?: number }) {
  return (
    <div className="flex gap-3.5 overflow-hidden -mx-5 px-5 sm:mx-0 sm:px-0">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="shrink-0 w-[13.2rem] p-4 card">
          <div className="skel w-14 h-14 rounded-full" />
          <div className="skel h-4 w-3/4 mt-3" />
          <div className="skel h-3 w-1/2 mt-2" />
          <div className="skel h-8 w-full mt-4" />
        </div>
      ))}
    </div>
  );
}
export function SkelList({ n = 4 }: { n?: number }) {
  return (
    <div className="space-y-3.5">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="card p-4 flex gap-3.5">
          <div className="skel w-16 h-16 rounded-full shrink-0" />
          <div className="flex-1">
            <div className="skel h-4 w-1/2" />
            <div className="skel h-3 w-2/3 mt-2.5" />
            <div className="skel h-3 w-1/3 mt-2.5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── bottom sheet ── */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70]">
      <button className="absolute inset-0 bg-ink/45 backdrop-blur-[2px] animate-fadein" onClick={onClose} aria-label="Cerrar" />
      <div className="absolute inset-x-0 bottom-0 animate-slideup">
        <div className="mx-auto max-w-md bg-card rounded-t-[26px] border-t border-x border-line2 shadow-lift max-h-[82vh] overflow-y-auto no-scrollbar">
          <div className="sticky top-0 bg-card pt-3 pb-2 px-5 border-b border-line2">
            <span className="mx-auto block w-10 h-1 rounded-full bg-line mb-3" />
            <div className="flex items-center justify-between">
              {title && <h3 className="font-disp font-bold text-lg text-ink">{title}</h3>}
              <button onClick={onClose} className="ml-auto w-8 h-8 grid place-items-center rounded-full bg-tint text-mut" aria-label="Cerrar">
                <Icon name="x" className="w-4 h-4" strokeWidth={2.4} />
              </button>
            </div>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ── big toggle switch ── */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label ?? "Disponibilidad"}
      onClick={() => onChange(!on)}
      className={`relative w-[4.4rem] h-10 rounded-full transition-colors duration-300 shrink-0 ${on ? "bg-ok" : "bg-line"}`}
    >
      <span className={`absolute top-1 w-8 h-8 rounded-full bg-card shadow-md transition-transform duration-300 ease-out ${on ? "translate-x-[2.4rem]" : "translate-x-1"}`}>
        <span className={`w-full h-full grid place-items-center ${on ? "text-ok" : "text-soft"}`}>
          <Icon name={on ? "check" : "x"} className="w-3.5 h-3.5" strokeWidth={3} />
        </span>
      </span>
    </button>
  );
}

/* ── stylized animated map ── */
export function MapCard({ dark = false, moving = false, label }: { dark?: boolean; moving?: boolean; label?: string }) {
  const rm = useReducedMotion();
  const bg = dark ? "#141d17" : "#e9eee6";
  const road = dark ? "#243129" : "#ffffff";
  const block = dark ? "#1b2620" : "#dfe7db";
  const accent = dark ? "#ffc24b" : "#0e5c49";

  return (
    <div className={`relative overflow-hidden rounded-2xl ${dark ? "bg-nsurf" : "bg-tint"}`}>
      <svg viewBox="0 0 400 300" className="w-full h-full block" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <rect width="400" height="300" fill={bg} />
        {/* blocks */}
        {[
          [20, 20, 90, 70], [130, 20, 110, 70], [260, 20, 120, 70],
          [20, 110, 90, 80], [130, 110, 110, 80], [260, 110, 120, 80],
          [20, 210, 90, 70], [130, 210, 110, 70], [260, 210, 120, 70],
        ].map(([x, y, w, h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} rx="8" fill={block} />
        ))}
        {/* park */}
        <rect x="130" y="110" width="110" height="80" rx="8" fill={dark ? "#1e3a2b" : "#cfe3c8"} />
        <circle cx="160" cy="140" r="7" fill={dark ? "#2c523c" : "#b5d3a8"} />
        <circle cx="190" cy="165" r="9" fill={dark ? "#2c523c" : "#b5d3a8"} />
        {/* roads */}
        <rect x="0" y="95" width="400" height="12" fill={road} />
        <rect x="0" y="195" width="400" height="12" fill={road} />
        <rect x="115" y="0" width="12" height="300" fill={road} />
        <rect x="245" y="0" width="12" height="300" fill={road} />
        <path d="M0 40 Q 200 60 400 30" stroke={road} strokeWidth="9" fill="none" />

        {/* user location */}
        <g transform="translate(251 201)">
          <circle r="26" fill={accent} opacity="0.12" />
          <circle r="6" fill={accent} />
          <circle r="6" fill="none" stroke={dark ? "#0e1512" : "#fff"} strokeWidth="2.5" />
        </g>

        {/* moving pro marker (solo con movimiento permitido) */}
        {moving && !rm && (
          <g>
            <g>
              <animateMotion dur="9s" repeatCount="indefinite" path="M 60 40 Q 150 100 251 201" />
              <circle r="15" fill={accent} />
              <path d="M -6 0 l 5 -5 v 3 h 7 v 4 h -7 v 3 z" fill={dark ? "#0e1512" : "#fff"} transform="rotate(45)" />
            </g>
          </g>
        )}
      </svg>

      {label && (
        <span className="absolute bottom-2.5 left-2.5 text-[0.62rem] font-bold text-white/90 bg-ink/70 backdrop-blur rounded-full px-2.5 py-1">
          {label}
        </span>
      )}
      {!moving && (
        <span className="absolute top-2.5 right-2.5 w-8 h-8 grid place-items-center rounded-full bg-card/90 backdrop-blur shadow-sm text-mut">
          <Icon name="pin" className="w-4 h-4" strokeWidth={2.2} />
        </span>
      )}
    </div>
  );
}

/* ── radar pulse (searching) ── */
export function Radar() {
  const rm = useReducedMotion();
  return (
    <div className="relative w-24 h-24 grid place-items-center">
      {!rm && (
        <>
          <span className="absolute inset-0 rounded-full bg-pine/20 animate-pulse-ring" />
          <span className="absolute inset-0 rounded-full bg-pine/15 animate-pulse-ring" style={{ animationDelay: "0.7s" }} />
        </>
      )}
      <span className="relative w-16 h-16 rounded-full bg-pine grid place-items-center shadow-lift">
        <Icon name="radar" className="w-8 h-8 text-white" strokeWidth={1.8} />
      </span>
    </div>
  );
}

/* ── countdown mm:ss ── */
export function useCountdown(total: number) {
  const [left, setLeft] = useState(total);
  useEffect(() => { setLeft(total); }, [total]);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  const m = Math.floor(left / 60);
  const s = left % 60;
  return { left, str: `${m}:${s.toString().padStart(2, "0")}` };
}
