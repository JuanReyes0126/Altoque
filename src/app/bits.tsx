import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "../components/icons";
import { faceUrl, fmt, proById, quadPos, zoneById, type Pro } from "./store";

/* ── animación de entrada suave ── */
export function FadeUp({ children, d = 0, className = "" }: { children: ReactNode; d?: number; className?: string }) {
  return (
    <div className={`animate-rise ${className}`} style={{ animationDelay: `${d}ms` }}>
      {children}
    </div>
  );
}

/* ── carga simulada (skeletons) ── */
export function useFakeLoad(ms = 700) {
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), ms); return () => clearTimeout(t); }, [ms]);
  return loading;
}

/* ── avatar fotográfico (recorte de cuadrícula 2×2) ── */
export function Face({ face, name, size = "w-12 h-12", rounded = "rounded-full", ring = false }: { face: { f: number; q: number }; name: string; size?: string; rounded?: string; ring?: boolean }) {
  const [err, setErr] = useState(false);
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <span className={`relative shrink-0 overflow-hidden ${size} ${rounded} ${ring ? "ring-2 ring-white shadow-md" : ""}`}>
      {err ? (
        <span className="absolute inset-0 grid place-items-center font-disp font-bold text-white bg-grn text-sm">{initials}</span>
      ) : (
        <img
          src={faceUrl(face.f)}
          alt={name}
          className="absolute w-[200%] h-[200%] object-cover"
          style={{ left: face.q % 2 === 1 ? "-100%" : "0", top: face.q >= 2 ? "-100%" : "0" }}
          onError={() => setErr(true)}
          draggable={false}
        />
      )}
    </span>
  );
}

/* ── estrellas ── */
export function Stars({ n, size = "w-3.5 h-3.5", onSet }: { n: number; size?: string; onSet?: (v: number) => void }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={!onSet}
          onClick={() => onSet?.(i)}
          className={onSet ? "transition-transform duration-150 hover:scale-125 active:scale-95 cursor-pointer" : "cursor-default"}
          aria-label={`${i} estrellas`}
        >
          <svg viewBox="0 0 24 24" className={`${size} ${i <= Math.round(n) ? "text-sun" : "text-edge"}`} fill="currentColor">
            <path d="m12 3.2 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.4l5.9-.8L12 3.2Z" />
          </svg>
        </button>
      ))}
    </span>
  );
}

/* ── insignias ── */
export function Verif({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-grnsoft text-grn pl-1.5 pr-2 py-0.5 text-[0.62rem] font-bold">
      <Icon name="badge" className="w-3 h-3" strokeWidth={2.2} />
      {compact ? "Verif." : "Verificado"}
    </span>
  );
}

export function AvailDot({ on, label = true, dark = false }: { on: boolean; label?: boolean; dark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[0.68rem] font-bold ${on ? "text-grn" : dark ? "text-nmut" : "text-mut2"}`}>
      <span className="relative flex w-2 h-2">
        {on && <span className="absolute inset-0 rounded-full bg-grn animate-ping opacity-60 motion-reduce:hidden" />}
        <span className={`relative rounded-full w-2 h-2 ${on ? "bg-grn" : "bg-mut2"}`} />
      </span>
      {label && (on ? "Disponible" : "No disponible")}
    </span>
  );
}

/* ── switch grande de disponibilidad ── */
export function BigToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      className={`relative w-[5.2rem] h-[2.9rem] rounded-full transition-colors duration-300 ${on ? "bg-grn" : "bg-nsurf border border-nline"}`}
    >
      <span
        className={`absolute top-1 w-[2.15rem] h-[2.15rem] rounded-full bg-white shadow-lg grid place-items-center transition-all duration-300 ease-[cubic-bezier(.2,1.2,.4,1)] ${on ? "left-[2.65rem]" : "left-1"}`}
      >
        <span className={`w-2 h-2 rounded-full ${on ? "bg-grn" : "bg-mut2"}`} />
      </span>
    </button>
  );
}

/* ── hoja inferior (sheet) ── */
export function Sheet({ open, onClose, title, children, tall = false }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; tall?: boolean }) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-ink2/45 backdrop-blur-[2px] animate-fadein" />
      <div className={`relative w-full sm:max-w-md bg-card sm:rounded-3xl rounded-t-3xl animate-slideup shadow-2xl ${tall ? "h-[88dvh]" : "max-h-[88dvh]"} overflow-hidden flex flex-col`}>
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <span className="w-10 h-1.5 rounded-full bg-edge" />
        </div>
        {title && (
          <div className="flex items-center justify-between px-5 pt-3 pb-2">
            <h3 className="font-disp font-bold text-lg">{title}</h3>
            <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-full bg-tint text-mut hover:bg-edge2 transition-colors" aria-label="Cerrar">
              <Icon name="x" className="w-4 h-4" strokeWidth={2.4} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto no-scrollbar px-5 pb-8 pt-2">{children}</div>
      </div>
    </div>
  );
}

/* ── mapa estilizado ── */
export function MapCard({ zoneId, dark = false, h = "h-40", pin = true, label }: { zoneId: string; dark?: boolean; h?: string; pin?: boolean; label?: string }) {
  const zone = zoneById(zoneId);
  const seed = zoneId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const x = 30 + (seed % 40); const y = 25 + ((seed * 7) % 40);
  return (
    <div className={`relative overflow-hidden rounded-2xl ${h} ${dark ? "mapgrid-dark" : "mapgrid"}`}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <path d={`M-5 ${30 + (seed % 20)} C 30 ${10 + (seed % 25)}, 60 ${70 - (seed % 20)}, 105 ${40 + (seed % 15)}`} fill="none" stroke={dark ? "rgba(233,240,234,.14)" : "rgba(12,95,70,.16)"} strokeWidth="4" />
        <path d={`M${20 + (seed % 15)} -5 C ${35 + (seed % 10)} 35, ${25 + (seed % 12)} 70, ${45 + (seed % 10)} 105`} fill="none" stroke={dark ? "rgba(233,240,234,.1)" : "rgba(12,95,70,.12)"} strokeWidth="3" />
        <circle cx={x} cy={y} r="7" fill={dark ? "rgba(255,179,0,.1)" : "rgba(12,95,70,.08)"} />
      </svg>
      {pin && (
        <div className="absolute" style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-100%)" }}>
          <span className="relative block">
            <span className="absolute -inset-3 rounded-full bg-grn/25 animate-radar motion-reduce:hidden" />
            <Icon name="pin" className="w-7 h-7 text-grn drop-shadow-md relative" strokeWidth={2.2} />
          </span>
        </div>
      )}
      <span className={`absolute left-3 bottom-3 rounded-full px-3 py-1 text-[0.68rem] font-bold ${dark ? "bg-ncard/90 text-ntxt border border-nline" : "bg-white/90 text-ink2 border border-edge2 shadow-sm"}`}>
        📍 {label ?? zone.name}
      </span>
    </div>
  );
}

/* ── radar de búsqueda/en camino ── */
export function Radar({ size = 180, children }: { size?: number; children?: ReactNode }) {
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute rounded-full border-2 border-grn/30 animate-radar motion-reduce:animate-none"
          style={{ width: "100%", height: "100%", animationDelay: `${i * 0.8}s` }}
        />
      ))}
      <span className="absolute rounded-full bg-grnsoft w-[62%] h-[62%] grid place-items-center">
        <span className="rounded-full bg-white w-[74%] h-[74%] grid place-items-center shadow-lg overflow-hidden">{children}</span>
      </span>
    </div>
  );
}

/* ── tarjeta de profesional (carrusel) ── */
export function ProCard({ p, onOpen, onRequest }: { p: Pro; onOpen: () => void; onRequest: () => void }) {
  return (
    <div className="card card-h w-[15rem] shrink-0 p-4 flex flex-col text-left">
      <div className="flex items-start justify-between">
        <Face face={p.face} name={p.name} size="w-14 h-14" ring />
        <div className="flex items-center gap-2">
          <AvailDot on={p.available} label={false} />
          <FavBtn id={p.id} />
        </div>
      </div>
      <button onClick={onOpen} className="text-left mt-3">
        <p className="font-disp font-bold text-[1.02rem] leading-tight">{p.name}</p>
        <p className="text-mut text-xs mt-0.5">{p.tagline}</p>
      </button>
      <div className="flex items-center gap-1.5 mt-2 text-xs">
        <Stars n={p.rating} size="w-3 h-3" />
        <span className="font-bold">{p.rating}</span>
        <span className="text-mut2">({p.reviews})</span>
        <Verif compact />
      </div>
      <div className="flex items-center gap-3 mt-2 text-[0.7rem] text-mut font-semibold">
        <span className="inline-flex items-center gap-1"><Icon name="pin" className="w-3.5 h-3.5 text-mut2" />{p.km} km</span>
        <span className="inline-flex items-center gap-1"><Icon name="timer" className="w-3.5 h-3.5 text-mut2" />~{p.eta} min</span>
        <span>{p.jobs} servicios</span>
      </div>
      <div className="flex gap-2 mt-4 pt-3 border-t border-edge2">
        <button onClick={onOpen} className="btn-ghost flex-1 h-10 text-xs">Ver perfil</button>
        <button onClick={onRequest} className="btn-prime flex-1 h-10 text-xs" disabled={!p.available}>
          {p.available ? "Solicitar" : "Ocupado"}
        </button>
      </div>
    </div>
  );
}

/* ── fila de profesional (resultados) ── */
export function ProListItem({ p, onOpen, onRequest, delay = 0 }: { p: Pro; onOpen: () => void; onRequest: () => void; delay?: number }) {
  return (
    <FadeUp d={delay}>
      <div className={`card card-h p-4 flex gap-4 items-center ${!p.available ? "opacity-60" : ""}`}>
        <button onClick={onOpen} className="relative shrink-0">
          <Face face={p.face} name={p.name} size="w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem]" rounded="rounded-2xl" />
          <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${p.available ? "bg-grn" : "bg-mut2"}`} />
        </button>
        <button onClick={onOpen} className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-disp font-bold">{p.name}</p>
            {p.founder && (
              <span className="rounded-full bg-sunsoft text-[0.58rem] font-extrabold px-2 py-0.5 text-[#8a5a00]">FUNDADOR</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-xs flex-wrap">
            <Stars n={p.rating} size="w-3 h-3" />
            <span className="font-bold">{p.rating}</span>
            <span className="text-mut2">({p.reviews})</span>
            <span className="text-edge">·</span>
            <span className="text-mut font-semibold">{p.jobs} servicios</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-[0.68rem] text-mut font-semibold flex-wrap">
            <Verif compact />
            <span className="inline-flex items-center gap-1"><Icon name="pin" className="w-3 h-3 text-mut2" />{p.km} km</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-grnsoft text-grn px-2 py-0.5 font-bold">
              <Icon name="timer" className="w-3 h-3" /> Llega ~{p.eta} min
            </span>
            <span>desde {fmt(p.price)}</span>
          </div>
        </button>
        <div className="flex flex-col gap-2 shrink-0">
          <button onClick={onRequest} className="btn-prime px-4 h-11 text-sm" disabled={!p.available}>
            {p.available ? "Solicitar" : "Ocupado"}
          </button>
          <FavBtn id={p.id} />
        </div>
      </div>
    </FadeUp>
  );
}

export function FavBtn({ id, className = "" }: { id: string; className?: string }) {
  const { favorites, toggleFav } = useFav();
  const on = favorites.includes(id);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); toggleFav(id); }}
      aria-label={on ? "Quitar de favoritos" : "Guardar en favoritos"}
      className={`w-9 h-9 grid place-items-center rounded-full border transition-all duration-200 active:scale-90 ${on ? "bg-firesoft border-fire/30 text-fire" : "bg-card border-edge2 text-mut2 hover:text-fire"} ${className}`}
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <path d="M12 20.5S4 15.5 4 9.8A4.3 4.3 0 0 1 8.3 5.5c1.6 0 3 .8 3.7 2.1.7-1.3 2.1-2.1 3.7-2.1A4.3 4.3 0 0 1 20 9.8c0 5.7-8 10.7-8 10.7Z" />
      </svg>
    </button>
  );
}

function useFav() {
  const s = useAppStore();
  return { favorites: s.favorites, toggleFav: (id: string) => toggleFavStore(id) };
}
import { useApp as useAppStore, toggleFav as toggleFavStore } from "./store";

/* ── skeletons ── */
export function SkelCards({ n = 3 }: { n?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="w-[15rem] shrink-0 card p-4 space-y-3">
          <div className="flex justify-between"><div className="skel w-14 h-14 rounded-full" /><div className="skel w-8 h-8 rounded-full" /></div>
          <div className="skel h-4 w-3/4" />
          <div className="skel h-3 w-1/2" />
          <div className="skel h-8 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function SkelList({ n = 4 }: { n?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="card p-4 flex gap-4 items-center">
          <div className="skel w-16 h-16 rounded-2xl" />
          <div className="flex-1 space-y-2"><div className="skel h-4 w-2/3" /><div className="skel h-3 w-1/2" /><div className="skel h-3 w-1/3" /></div>
          <div className="skel h-10 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/* ── sección con título y "ver todo" ── */
export function RowHead({ icon, title, sub, action }: { icon?: IconName; title: string; sub?: string; action?: { label: string; fn: () => void } }) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div>
        <h2 className="font-disp font-bold text-xl sm:text-2xl flex items-center gap-2.5">
          {icon && (
            <span className="w-9 h-9 rounded-xl bg-grnsoft text-grn grid place-items-center">
              <Icon name={icon} className="w-4.5 h-4.5" strokeWidth={2} />
            </span>
          )}
          {title}
        </h2>
        {sub && <p className="text-mut text-sm mt-1">{sub}</p>}
      </div>
      {action && (
        <button onClick={action.fn} className="text-grn font-bold text-sm hover:underline underline-offset-4 flex items-center gap-1">
          {action.label} <Icon name="chevr" className="w-3.5 h-3.5" strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}

export function Carousel({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 300, behavior: "smooth" });
  return (
    <div className="relative">
      <div ref={ref} className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5 sm:mx-0 sm:px-0 snap-x">{children}</div>
      <div className="hidden lg:flex absolute -right-2 top-1/3 gap-2">
        <button onClick={() => scroll(-1)} className="w-10 h-10 rounded-full card grid place-items-center text-mut hover:text-ink2 transition-colors" aria-label="Anterior">
          <Icon name="chevl" className="w-4 h-4" strokeWidth={2.4} />
        </button>
        <button onClick={() => scroll(1)} className="w-10 h-10 rounded-full card grid place-items-center text-mut hover:text-ink2 transition-colors" aria-label="Siguiente">
          <Icon name="chevr" className="w-4 h-4" strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

export const initialsOf = (name: string) => name.split(" ").map((w) => w[0]).slice(0, 2).join("");
export const proFace = (id: string) => proById(id).face;
