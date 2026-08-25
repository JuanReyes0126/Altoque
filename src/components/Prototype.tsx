import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Reveal, usePrefersReducedMotion } from "../lib/anim";
import { CAT_ICONS, Icon, type IconName } from "./icons";
import { Avatar, Dot, Section, Stars, TONES } from "./ui";

/* ── atoms ── */
function PB({ children, tone = "border-line text-paper", onClick }: { children: ReactNode; tone?: string; onClick?: () => void }) {
  return <button onClick={onClick} className={`border px-2.5 py-2 font-mono text-[0.6rem] tracking-wide transition-colors ${tone}`}>{children}</button>;
}
function Card({ children, tone = "border-line" }: { children: ReactNode; tone?: string }) {
  return <div className={`border ${tone} bg-panel/40 p-3`}>{children}</div>;
}
function TL({ items }: { items: { l: string; done?: boolean; now?: boolean; tone?: string }[] }) {
  return (
    <ul className="space-y-1">
      {items.map((i) => (
        <li key={i.l} className={`flex items-center gap-2 font-mono text-[0.6rem] ${i.now ? "text-paper" : i.done ? "text-dim" : "text-faint"}`}>
          <span className={`w-3 h-3 grid place-items-center border ${i.done ? "border-jade/70 text-jade" : i.now ? "border-amber text-amber" : "border-line"}`}>
            {i.done ? <Icon name="check" className="w-2 h-2" strokeWidth={3} /> : i.now ? <span className="w-1 h-1 rounded-full bg-amber animate-pulse-dot" /> : null}
          </span>
          {i.l}
        </li>
      ))}
    </ul>
  );
}
const CATS: { n: string; i: IconName }[] = [
  { n: "Plomería", i: "wrench" }, { n: "Electricidad", i: "plug" }, { n: "Aire acondicionado", i: "snow" },
  { n: "Cerrajería", i: "key" }, { n: "Limpieza", i: "broom" }, { n: "Mecánica", i: "car" },
];

function Photo({ n = 1 }: { n?: number }) {
  return (
    <span className="w-12 h-12 border border-line bg-panel grid place-items-center text-faint relative">
      <Icon name="camera" className="w-4 h-4" />
      <span className="absolute bottom-0.5 right-1 font-mono text-[0.5rem]">{n}</span>
    </span>
  );
}

/* ── pantallas del CLIENTE ── */
function ClientScreen({ s }: { s: number }) {
  if (s === 0) return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[0.6rem] text-dim flex items-center gap-1.5"><Icon name="pin" className="w-3 h-3 text-flama" /> Los Jardines, Santiago</p>
        <Avatar initials="MG" className="w-6 h-6 text-[0.5rem] bg-panel2 text-azul" />
      </div>
      <p className="font-display font-extrabold text-lg leading-tight">¿Qué necesitas <span className="text-flama">hoy</span>, María?</p>
      <div className="grid grid-cols-3 gap-1.5">
        {CATS.map((c) => (
          <span key={c.n} className="border border-line bg-panel/50 p-2 text-center">
            <Icon name={c.i} className="w-4 h-4 mx-auto text-dim" />
            <span className="block font-mono text-[0.5rem] mt-1 text-dim leading-tight">{c.n}</span>
          </span>
        ))}
      </div>
      <Card tone="border-amber/40">
        <p className="font-mono text-[0.6rem] text-amber">⚡ LO NECESITO AHORA</p>
        <p className="text-[0.62rem] text-dim mt-0.5">Pros disponibles responden en minutos</p>
      </Card>
      <Card tone="border-azul/40">
        <p className="font-mono text-[0.6rem] text-azul">▦ COTIZAR / PROGRAMAR</p>
        <p className="text-[0.62rem] text-dim mt-0.5">Describe, agrega fotos, recibe ofertas</p>
      </Card>
    </div>
  );
  if (s === 1) return (
    <div className="space-y-3">
      <p className="font-mono text-[0.6rem] text-faint">PASO 1 · ¿QUÉ NECESITAS?</p>
      <div className="grid grid-cols-3 gap-1.5">
        {CATS.map((c) => (
          <span key={c.n} className={`border p-2 text-center transition-colors ${c.n === "Plomería" ? "border-flama bg-flama/15" : "border-line bg-panel/50 opacity-50"}`}>
            <Icon name={c.i} className={`w-4 h-4 mx-auto ${c.n === "Plomería" ? "text-flama" : "text-dim"}`} />
            <span className={`block font-mono text-[0.5rem] mt-1 leading-tight ${c.n === "Plomería" ? "text-flama" : "text-dim"}`}>{c.n}</span>
          </span>
        ))}
      </div>
      <Card tone="border-flama/50">
        <p className="font-display font-bold text-xs">Plomería seleccionada</p>
        <p className="font-mono text-[0.56rem] text-dim mt-1">supportsNow: true · ETA options: [10,15,20,30,45,60]</p>
      </Card>
      <PB tone="bg-flama text-ink border-flama font-bold">CONTINUAR →</PB>
    </div>
  );
  if (s === 2) return (
    <div className="space-y-3">
      <p className="font-mono text-[0.6rem] text-faint">PASO 2 · DESCRIBE EL PROBLEMA</p>
      <div className="border border-line bg-panel/60 p-2.5 min-h-[4.5rem]">
        <p className="text-[0.68rem] leading-relaxed text-paper/90">Fuga debajo del fregadero, empezó hace como 1 hora. Ya cerré la llave de paso…</p>
        <span className="inline-block w-1.5 h-3 bg-flama animate-blink mt-1" />
      </div>
      <div className="flex flex-wrap gap-1">
        {["fuga", "tubería", "urgente", "cocina"].map((c) => <span key={c} className="chip !text-[0.52rem]">{c}</span>)}
      </div>
      <div>
        <p className="font-mono text-[0.56rem] text-faint mb-1.5">FOTOS · 2/6</p>
        <div className="flex gap-1.5"><Photo n={1} /><Photo n={2} />
          <span className="w-12 h-12 border border-dashed border-faint/50 grid place-items-center text-faint"><Icon name="plus" className="w-4 h-4" /></span>
        </div>
        <p className="font-mono text-[0.5rem] text-faint mt-1.5">↑ directa a R2 con URL prefirmada · máx 8 MB</p>
      </div>
    </div>
  );
  if (s === 3) return (
    <div className="space-y-3">
      <p className="font-mono text-[0.6rem] text-faint">PASO 3 · ¿PARA CUÁNDO?</p>
      <Card tone="border-amber bg-amber/15">
        <div className="flex items-center justify-between">
          <p className="font-display font-extrabold text-sm text-amber">⚡ Lo necesito AHORA</p>
          <span className="w-4 h-4 rounded-full border-4 border-amber" />
        </div>
        <p className="text-[0.62rem] text-dim mt-1">Matching inmediato con pros disponibles</p>
      </Card>
      <Card tone="border-line opacity-60">
        <div className="flex items-center justify-between">
          <p className="font-display font-bold text-sm">▦ Quiero programarlo</p>
          <span className="w-4 h-4 rounded-full border border-faint" />
        </div>
        <p className="text-[0.62rem] text-dim mt-1">Recibe cotizaciones · V1.5</p>
      </Card>
      <p className="font-mono text-[0.56rem] text-faint">mode: NOW · emitido a 7 pros compatibles</p>
    </div>
  );
  if (s === 4) return (
    <div className="space-y-3">
      <p className="font-mono text-[0.6rem] text-faint">PASO 4 · ¿DÓNDE ESTÁS?</p>
      <div className="border border-line bg-panel/40 h-24 relative overflow-hidden bp-grid">
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-flama">
          <Icon name="pin" className="w-6 h-6" strokeWidth={2.2} />
        </span>
        <span className="absolute bottom-1 right-1.5 font-mono text-[0.5rem] text-faint">mapa estático V1 · centroide</span>
      </div>
      <div className="space-y-1.5">
        {["Los Jardines", "Ens. Libertad", "Santiago Centro", "Cienfuegos"].map((z, i) => (
          <span key={z} className={`flex items-center justify-between border px-2.5 py-1.5 font-mono text-[0.6rem] ${i === 0 ? "border-jade/60 text-jade bg-jade/10" : "border-line text-dim"}`}>
            {z} {i === 0 && <Icon name="check" className="w-3 h-3" strokeWidth={2.6} />}
          </span>
        ))}
      </div>
      <PB tone="bg-flama text-ink border-flama font-bold w-full">SOLICITAR PLOMERO ⚡</PB>
    </div>
  );
  if (s === 5) return (
    <div className="space-y-3 text-center">
      <p className="font-mono text-[0.6rem] text-faint">PASO 5 · MATCHING</p>
      <div className="relative w-28 h-28 mx-auto">
        <span className="absolute inset-0 rounded-full border border-azul/40" />
        <span className="absolute inset-4 rounded-full border border-azul/30" />
        <span className="absolute inset-8 rounded-full border border-azul/20" />
        <span className="absolute inset-0 rounded-full animate-ring border border-azul/50" />
        <span className="absolute inset-0 rounded-full overflow-hidden animate-sweep">
          <span className="absolute inset-0" style={{ background: "conic-gradient(from 0deg, rgba(90,162,255,0.4), transparent 80deg)" }} />
        </span>
        <Icon name="wrench" className="absolute inset-0 m-auto w-6 h-6 text-azul" />
      </div>
      <p className="font-display font-bold text-sm">Buscando plomeros cerca…</p>
      <p className="font-mono text-[0.56rem] text-dim">categoría ✓ · disponibilidad ✓ · zona ✓ · rating ✓</p>
      <div className="space-y-1.5 text-left">
        {[{ n: "Carlos Rodríguez", d: "3.2 km · ★4.9", on: true }, { n: "Marta Peralta", d: "4.1 km · ★4.8", on: true }, { n: "José Almonte", d: "5.0 km · ★4.7", on: false }].map((p) => (
          <div key={p.n} className={`flex items-center gap-2 border px-2.5 py-1.5 ${p.on ? "border-line" : "border-line opacity-45"}`}>
            <Dot pulse={p.on} className={p.on ? "bg-amber" : "bg-faint"} />
            <span className="font-mono text-[0.6rem] text-paper">{p.n}</span>
            <span className="font-mono text-[0.52rem] text-faint ml-auto">{p.d}</span>
          </div>
        ))}
      </div>
    </div>
  );
  if (s === 6) return (
    <div className="space-y-3">
      <Card tone="border-jade/60 bg-jade/10">
        <div className="flex items-center gap-2.5">
          <Avatar initials="CR" className="w-9 h-9 text-[0.6rem] bg-panel2 text-amber" />
          <div className="flex-1">
            <p className="font-display font-bold text-xs">Carlos aceptó tu servicio</p>
            <p className="font-mono text-[0.56rem] text-dim">★ 4.9 · Plomería · verificado ✓</p>
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between border-t border-jade/20 pt-2.5">
          <span className="font-mono text-[0.6rem] text-jade">LLEGADA ESTIMADA</span>
          <span className="font-display font-extrabold text-2xl text-jade">20<span className="text-sm"> min</span></span>
        </div>
      </Card>
      <TL items={[{ l: "Creada · 2:41 PM", done: true }, { l: "Aceptada · 2:43 PM", done: true }, { l: "En camino", now: true }, { l: "Llegó", done: false }, { l: "Completado", done: false }]} />
      <p className="font-mono text-[0.56rem] text-faint">AT-2026-0042 · notificación por email enviada</p>
    </div>
  );
  if (s === 7) return (
    <div className="space-y-3">
      <div className="text-center border border-amber/50 bg-amber/10 p-4">
        <p className="font-mono text-[0.6rem] tracking-[0.2em] text-amber">EN CAMINO</p>
        <p className="font-display font-extrabold text-4xl text-amber mt-1">18<span className="text-base"> min</span></p>
        <p className="font-mono text-[0.56rem] text-dim mt-1">Carlos viene hacia Los Jardines</p>
      </div>
      <div className="h-1 bg-panel"><div className="h-full bg-amber w-3/4 bar-fill" /></div>
      <TL items={[{ l: "Creada · 2:41 PM", done: true }, { l: "Aceptada · 2:43 PM", done: true }, { l: "En camino · 2:44 PM", now: true }, { l: "Llegó", done: false }, { l: "Completado", done: false }]} />
      <div className="flex gap-1.5">
        <PB tone="border-jade/50 text-jade flex-1">LLAMAR</PB>
        <PB tone="border-line text-dim flex-1">REPORTAR</PB>
      </div>
    </div>
  );
  if (s === 8) return (
    <div className="space-y-3">
      <Card tone="border-jade/60 bg-jade/10">
        <p className="font-display font-bold text-sm text-jade">Carlos llegó al punto</p>
        <p className="font-mono text-[0.56rem] text-dim mt-1">3:02 PM · Los Jardines · desde aquí solo se cancela con reporte</p>
      </Card>
      <TL items={[{ l: "Creada · 2:41 PM", done: true }, { l: "Aceptada · 2:43 PM", done: true }, { l: "En camino · 2:44 PM", done: true }, { l: "Llegó · 3:02 PM", now: true }, { l: "Completado", done: false }]} />
      <Card>
        <p className="font-mono text-[0.56rem] text-faint">PRO EN PANTALLA:</p>
        <p className="font-mono text-[0.62rem] text-paper mt-1">[ ✓ HE LLEGADO ] → siguiente: iniciar</p>
      </Card>
    </div>
  );
  if (s === 9) return (
    <div className="space-y-3">
      <div className="border border-amber/50 bg-amber/10 p-4 text-center">
        <p className="font-mono text-[0.6rem] tracking-[0.2em] text-amber">SERVICIO EN CURSO</p>
        <p className="font-display font-bold text-lg mt-1">Carlos está trabajando</p>
        <p className="font-mono text-[0.56rem] text-dim mt-1">inició 3:05 PM · fuga bajo fregadero</p>
      </div>
      <TL items={[{ l: "Creada · 2:41 PM", done: true }, { l: "Aceptada · 2:43 PM", done: true }, { l: "En camino · 2:44 PM", done: true }, { l: "Llegó · 3:02 PM", done: true }, { l: "Completado", now: true }]} />
    </div>
  );
  if (s === 10) return (
    <div className="space-y-3">
      <Card tone="border-jade/60 bg-jade/10">
        <p className="font-display font-bold text-sm text-jade">✓ Servicio completado</p>
        <p className="font-mono text-[0.56rem] text-dim mt-1">3:38 PM · 56 min totales · AT-2026-0042</p>
      </Card>
      <div className="border border-line p-3 text-center">
        <p className="font-display font-bold text-sm">¿Cómo lo hizo Carlos?</p>
        <div className="flex justify-center gap-1 mt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <svg key={i} viewBox="0 0 24 24" className={`w-6 h-6 ${i <= 5 ? "text-amber" : "text-faint/40"} ${i === 5 ? "scale-110" : ""}`} fill="currentColor">
              <path d="m12 3.2 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.4l5.9-.8L12 3.2Z" />
            </svg>
          ))}
        </div>
        <div className="mt-2.5 border border-line p-2 text-left">
          <p className="text-[0.62rem] text-dim">“Llegó rápido y resolvió al toque. 100% recomendado…”</p>
        </div>
        <PB tone="bg-flama text-ink border-flama font-bold w-full mt-2.5">ENVIAR REVIEW</PB>
      </div>
      <p className="font-mono text-[0.56rem] text-faint">1 review por requestId · doble ciego 48 h</p>
    </div>
  );
  return (
    <div className="space-y-3 text-center">
      <span className="w-14 h-14 mx-auto grid place-items-center border-2 border-jade text-jade rounded-full">
        <Icon name="check" className="w-7 h-7" strokeWidth={2.4} />
      </span>
      <p className="font-display font-extrabold text-xl">¡Listo, María!</p>
      <p className="font-mono text-[0.62rem] text-dim -mt-1">review enviada · ★ 5.0</p>
      <Card>
        <div className="flex items-center gap-2.5 text-left">
          <Avatar initials="CR" className="w-9 h-9 text-[0.6rem] bg-panel2 text-amber" />
          <div className="flex-1">
            <p className="font-display font-bold text-xs">Carlos Rodríguez</p>
            <p className="font-mono text-[0.56rem] text-jade">guardado en Favoritos ♥</p>
          </div>
        </div>
      </Card>
      <p className="font-mono text-[0.56rem] text-faint">próxima vez: 1 toque desde Favoritos</p>
    </div>
  );
}

/* ── pantallas del PROFESIONAL ── */
function ProScreen({ s }: { s: number }) {
  const waiting = (msg: string) => (
    <div className="space-y-3">
      <div className="border-2 border-jade bg-jade/15 p-3 text-center">
        <p className="font-display font-extrabold text-sm text-jade flex items-center justify-center gap-2"><Dot pulse /> DISPONIBLE</p>
        <p className="font-mono text-[0.52rem] text-dim mt-1">recibiendo solicitudes en Los Jardines</p>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {[["HOY", "3"], ["SEMANA", "14"], ["RATING", "4.9"]].map(([l, v]) => (
          <div key={l} className="border border-line p-2 text-center">
            <p className="font-display font-bold text-sm">{v}</p>
            <p className="font-mono text-[0.48rem] text-faint tracking-wider">{l}</p>
          </div>
        ))}
      </div>
      <Card>
        <p className="font-mono text-[0.6rem] text-dim text-center py-2">{msg}<span className="animate-blink">_</span></p>
      </Card>
      <p className="font-mono text-[0.52rem] text-faint text-center">Fundador #017 · referral 2/3 → +1 mes PRO</p>
    </div>
  );

  if (s <= 1) return waiting("Sin solicitudes por ahora…");
  if (s === 2) return waiting("El cliente describe su problema…");
  if (s === 3) return waiting("El cliente elige modalidad ⚡ AHORA…");
  if (s === 4) return waiting("Solicitud entrante en tu zona…");
  if (s === 5) return (
    <div className="space-y-3">
      <div className="border-2 border-amber bg-amber/15 p-3">
        <div className="flex items-center justify-between">
          <p className="font-display font-extrabold text-sm text-amber">⚡ NUEVA SOLICITUD</p>
          <span className="font-mono text-[0.52rem] text-amber animate-blink">04:59</span>
        </div>
        <p className="font-mono text-[0.58rem] text-dim mt-1">PLOMERÍA · Los Jardines · ~3.2 km</p>
        <p className="text-[0.66rem] text-paper/90 mt-2 leading-relaxed">“Fuga debajo del fregadero, empezó hace 1 hora…”</p>
        <div className="flex gap-1.5 mt-2"><Photo n={1} /><Photo n={2} /></div>
        <p className="font-mono text-[0.52rem] text-faint mt-1.5">Cliente: María G. · ★ 4.9 como clienta</p>
      </div>
      <div className="flex gap-1.5">
        <PB tone="border-line text-dim flex-1">RECHAZAR</PB>
        <PB tone="bg-jade text-ink border-jade font-bold flex-1">ACEPTAR</PB>
      </div>
      <p className="font-mono text-[0.52rem] text-faint text-center">aceptar = transacción con row-lock · nadie más la toma</p>
    </div>
  );
  if (s === 6) return (
    <div className="space-y-3">
      <Card tone="border-jade/60">
        <p className="font-display font-bold text-sm">¿Cuánto tardas en llegar?</p>
        <div className="grid grid-cols-3 gap-1.5 mt-2.5">
          {["10", "15", "20", "30", "45", "60"].map((m) => (
            <span key={m} className={`border py-2 text-center font-mono text-[0.62rem] ${m === "20" ? "border-jade bg-jade/20 text-jade font-bold" : "border-line text-dim"}`}>
              {m} min
            </span>
          ))}
        </div>
        <p className="font-mono text-[0.52rem] text-faint mt-2">sugerido: 20 min (distancia de sector) · o personalizado</p>
      </Card>
      <PB tone="bg-jade text-ink border-jade font-bold w-full">CONFIRMAR · 20 MIN →</PB>
      <p className="font-mono text-[0.52rem] text-faint text-center">la ETA es contrato: el cliente la ve al instante</p>
    </div>
  );
  if (s === 7) return (
    <div className="space-y-3">
      <Card tone="border-amber/60 bg-amber/10">
        <p className="font-display font-bold text-sm text-amber">EN CAMINO · 18 min</p>
        <p className="font-mono text-[0.58rem] text-dim mt-1">María G. · Calle 4 #12, Los Jardines</p>
      </Card>
      <TL items={[{ l: "Aceptada · 2:43 PM", done: true }, { l: "En camino", now: true }, { l: "Llegar al punto", done: false }, { l: "Iniciar servicio", done: false }, { l: "Completar", done: false }]} />
      <PB tone="bg-amber text-ink border-amber font-bold w-full">✓ HE LLEGADO</PB>
    </div>
  );
  if (s === 8) return (
    <div className="space-y-3">
      <Card tone="border-jade/60 bg-jade/10">
        <p className="font-display font-bold text-sm text-jade">En el punto · 3:02 PM</p>
        <p className="font-mono text-[0.58rem] text-dim mt-1">Cliente notificada de tu llegada</p>
      </Card>
      <PB tone="bg-jade text-ink border-jade font-bold w-full">▶ INICIAR SERVICIO</PB>
      <p className="font-mono text-[0.52rem] text-faint text-center">cada botón firma un RequestEvent con timestamp</p>
    </div>
  );
  if (s === 9) return (
    <div className="space-y-3">
      <Card tone="border-amber/60 bg-amber/10">
        <p className="font-display font-bold text-sm text-amber">En servicio · 33 min</p>
        <p className="font-mono text-[0.58rem] text-dim mt-1">Fuga bajo fregadero · cambio de sifón</p>
      </Card>
      <PB tone="bg-flama text-ink border-flama font-bold w-full">■ COMPLETAR SERVICIO</PB>
    </div>
  );
  if (s === 10) return (
    <div className="space-y-3">
      <Card tone="border-jade/60 bg-jade/10">
        <p className="font-display font-bold text-sm text-jade">✓ Completado · 3:38 PM</p>
        <p className="font-mono text-[0.58rem] text-dim mt-1">238 → 239 trabajos · esperando review de María</p>
      </Card>
      <div className="grid grid-cols-3 gap-1.5">
        {[["HOY", "4"], ["SEMANA", "15"], ["RATING", "4.9"]].map(([l, v]) => (
          <div key={l} className="border border-line p-2 text-center">
            <p className="font-display font-bold text-sm">{v}</p>
            <p className="font-mono text-[0.48rem] text-faint tracking-wider">{l}</p>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div className="space-y-3">
      <Card tone="border-amber/60 bg-amber/10 text-center">
        <p className="font-display font-extrabold text-sm text-amber">★ 5.0 recibida</p>
        <p className="font-mono text-[0.56rem] text-dim mt-1">“Resolvió al toque” · TrustSignal actualizado</p>
      </Card>
      <Card>
        <p className="font-mono text-[0.56rem] text-faint">REFERIDOS</p>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 h-1.5 bg-panel"><div className="h-full bg-amber w-2/3 bar-fill" /></div>
          <span className="font-mono text-[0.6rem] text-amber">2/3</span>
        </div>
        <p className="font-mono text-[0.52rem] text-dim mt-1.5">1 colega más → +1 mes PRO</p>
      </Card>
      <p className="font-mono text-[0.52rem] text-faint text-center">⛨ Fundador #017 · plan PRO hasta 12/2026</p>
    </div>
  );
}

/* ── steps ── */
const STEPS: { actor: "cliente" | "pro" | "sistema"; title: string; desc: string; state: { l: string; tone: string } }[] = [
  { actor: "cliente", title: "María abre AlToque", desc: "La home abre directo a la acción: “¿Qué necesitas hoy?”. Sin vueltas.", state: { l: "—", tone: "dim" } },
  { actor: "cliente", title: "Elige: Plomería", desc: "Categorías dinámicas desde la BD — el admin agrega nuevas sin deploy.", state: { l: "—", tone: "dim" } },
  { actor: "cliente", title: "Describe + fotos", desc: "Texto libre, chips sugeridos por categoría y hasta 6 fotos subidas directo a R2.", state: { l: "CREATED (borrador)", tone: "azul" } },
  { actor: "cliente", title: "Modalidad: ⚡ Ahora", desc: "El mode NOW dispara matching inmediato. SCHEDULED llegará en V1.5 con el mismo esquema.", state: { l: "—", tone: "dim" } },
  { actor: "cliente", title: "Ubicación: Los Jardines", desc: "Sector con centroide. Sin pedir GPS: 1 toque y la zona queda fijada.", state: { l: "—", tone: "dim" } },
  { actor: "sistema", title: "Matching + broadcast", desc: "Ranking: categoría → disponibilidad → zona → rating → distancia de sector. Carlos recibe la solicitud.", state: { l: "MATCHING", tone: "azul" } },
  { actor: "pro", title: "Carlos acepta · ETA 20 min", desc: "Aceptar es atómico (row-lock). La ETA se elige de una lista configurable — cero GPS, expectativa clara.", state: { l: "ACCEPTED → EN_ROUTE", tone: "jade" } },
  { actor: "pro", title: "En camino", desc: "El cliente ve countdown y timeline. Polling de 5 s hoy; websocket-ready para V2.", state: { l: "EN_ROUTE", tone: "amber" } },
  { actor: "pro", title: "Llegó al punto", desc: "Un botón. Desde aquí cancelar solo vía reporte: protege el tiempo del pro.", state: { l: "ARRIVED", tone: "amber" } },
  { actor: "pro", title: "Servicio en curso", desc: "Cada transición firma un RequestEvent: la analítica del admin nace sola.", state: { l: "IN_PROGRESS", tone: "amber" } },
  { actor: "pro", title: "Completado", desc: "Carlos cierra el servicio. Sus contadores y su TrustSignal se actualizan al instante.", state: { l: "COMPLETED", tone: "jade" } },
  { actor: "cliente", title: "Review ★5 + favorito", desc: "1 review por servicio real. María guarda a Carlos: la próxima es a 1 toque.", state: { l: "REVIEWED", tone: "flama" } },
];

function Phone({ label, tone, children }: { label: string; tone: string; children: ReactNode }) {
  return (
    <div className="w-[17.5rem] sm:w-[19rem] shrink-0 mx-auto">
      <div className={`font-mono text-[0.56rem] tracking-[0.2em] text-center mb-2 ${tone}`}>{label}</div>
      <div className="border border-line bg-ink rounded-[2rem] p-2 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)]">
        <div className="rounded-[1.6rem] border border-line bg-deep overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-2.5 pb-1">
            <span className="font-mono text-[0.5rem] text-faint">3:41 PM</span>
            <span className="w-14 h-3.5 rounded-full bg-ink border border-linesoft mx-auto absolute" />
            <span className="font-mono text-[0.5rem] text-faint">▂▄▆</span>
          </div>
          <div className="px-3.5 py-3 min-h-[26.5rem] max-h-[26.5rem] overflow-y-auto no-scrollbar">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function Prototype() {
  const reduced = usePrefersReducedMotion();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(!reduced);

  useEffect(() => {
    if (!playing || reduced) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % STEPS.length), 3400);
    return () => window.clearInterval(id);
  }, [playing, reduced]);

  const st = STEPS[step];
  const tone = TONES[st.state.tone];
  const go = (d: number) => { setPlaying(false); setStep((s) => (s + d + STEPS.length) % STEPS.length); };

  const ACTOR_CHIP: Record<string, string> = {
    cliente: "text-azul border-azul/50",
    pro: "text-jade border-jade/50",
    sistema: "text-amber border-amber/50",
  };

  return (
    <Section
      id="flujos"
      num="06"
      kicker="Flujo cliente ↔ profesional"
      title={<>Todo el MVP, <span className="text-flama">en 12 toques.</span></>}
      intro="El flujo objetivo de la V1 (§20 del brief) corriendo en vivo: dos teléfonos sincronizados, un estado compartido. Deja que corra solo o avanza paso a paso."
      wide
    >
      {/* caption + controls */}
      <Reveal>
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 lg:order-2 lg:sticky lg:top-28">
            <div className="border border-line bg-deep/70 p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[0.62rem] tracking-[0.2em] text-flama">PASO {String(step + 1).padStart(2, "0")}/{STEPS.length}</span>
                <span className={`font-mono text-[0.56rem] tracking-wider uppercase border px-2 py-0.5 ${ACTOR_CHIP[st.actor]}`}>
                  actúa: {st.actor === "pro" ? "profesional" : st.actor}
                </span>
                <span className={`ml-auto font-mono text-[0.6rem] tracking-wider border px-2 py-1 ${tone.border} ${tone.text}`}>
                  {st.state.l}
                </span>
              </div>

              <div className="mt-4 min-h-[5.2rem]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={reduced ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? undefined : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h3 className="font-display font-extrabold text-xl sm:text-2xl leading-tight">{st.title}</h3>
                    <p className="mt-2 text-sm text-dim leading-relaxed">{st.desc}</p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* progress track */}
              <div className="mt-4 flex gap-1">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setPlaying(false); setStep(i); }}
                    className={`h-1.5 flex-1 transition-all duration-300 ${i === step ? "bg-flama" : i < step ? "bg-flama/40" : "bg-panel2"} hover:bg-flama/70`}
                    aria-label={`Ir al paso ${i + 1}`}
                  />
                ))}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <button onClick={() => go(-1)} className="border border-line px-4 py-2.5 font-mono text-[0.66rem] tracking-wider hover:border-paper transition-colors">← ANTERIOR</button>
                <button onClick={() => go(1)} className="bg-flama text-ink px-5 py-2.5 font-display font-bold text-sm hover:bg-amber transition-colors">SIGUIENTE →</button>
                <button
                  onClick={() => setPlaying((p) => !p)}
                  className={`ml-auto border px-4 py-2.5 font-mono text-[0.66rem] tracking-wider transition-colors ${playing ? "border-jade/60 text-jade" : "border-line text-dim hover:text-paper"}`}
                >
                  {playing ? "❚❚ PAUSAR AUTO" : "▶ AUTO"}
                </button>
              </div>
            </div>

            <p className="mt-4 font-mono text-[0.62rem] text-faint leading-relaxed px-1">
              ↳ Lo que NO ves aquí — y está bien: GPS continuo, pagos, chat. Slots reservados para V2/V3 (sección 03).
            </p>
          </div>

          {/* phones */}
          <div className="lg:col-span-5 lg:order-1">
            <div className="flex flex-col md:flex-row lg:flex-col xl:flex-row gap-5 justify-center">
              <div className="relative">
                <AnimatePresence mode="wait">
                  <motion.div key={`c${step}`} initial={reduced ? false : { opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={reduced ? undefined : { opacity: 0, x: 14 }} transition={{ duration: 0.28 }}>
                    <Phone label="◉ CLIENTE · MARÍA" tone="text-azul"><ClientScreen s={step} /></Phone>
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="relative">
                <AnimatePresence mode="wait">
                  <motion.div key={`p${step}`} initial={reduced ? false : { opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={reduced ? undefined : { opacity: 0, x: -14 }} transition={{ duration: 0.28 }}>
                    <Phone label="◉ PROFESIONAL · CARLOS" tone="text-jade"><ProScreen s={step} /></Phone>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
