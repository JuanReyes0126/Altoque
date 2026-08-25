import { useState } from "react";
import { ARCH_NOTES, ENTITIES, ENTITY_GROUPS, TREE } from "../data/blueprint";
import { Reveal } from "../lib/anim";
import { Icon, type IconName } from "./icons";
import { Section } from "./ui";

const LAYER_ICON: Record<string, IconName> = { layers: "layers", lock: "lock", db: "db", radar: "radar" };

function Connector() {
  return (
    <svg className="w-6 h-8 mx-auto text-faint" viewBox="0 0 24 32" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 0v26m0 0-5-5m5 5 5-5" className="dashline" strokeDasharray="4 4" />
    </svg>
  );
}

export function Arquitectura() {
  return (
    <Section
      id="arquitectura"
      num="03"
      kicker="Arquitectura y estructura"
      title={<>Un monolito modular <span className="text-azul">con las puertas marcadas.</span></>}
      intro="Una sola aplicación, dominios separados y tres slots reservados (realtime, pagos, GPS) para que V2 y V3 se enchufen sin cirugía. Nada de microservicios: a esta escala son deuda, no escala."
    >
      <div className="grid lg:grid-cols-12 gap-6">
        {/* diagram */}
        <div className="lg:col-span-5">
          <Reveal dir="left">
            <div className="border border-line bg-deep/60 p-5 h-full">
              <p className="font-mono text-[0.6rem] tracking-[0.22em] text-faint mb-4">DIAGRAMA · CAPAS</p>

              <div className="border border-azul/40 bg-azul/5 p-3.5 text-center">
                <p className="font-display font-bold text-sm">Cliente · PWA mobile-first</p>
                <p className="font-mono text-[0.6rem] text-dim mt-1">React + Next.js App Router · instalable</p>
              </div>
              <Connector />
              <div className="border border-amber/40 bg-amber/5 p-3.5">
                <p className="font-display font-bold text-sm text-center">Edge · middleware</p>
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {["rate limit", "CSRF", "sesión", "RBAC", "CSP"].map((t) => (
                    <span key={t} className="chip !text-amber !border-amber/30">{t}</span>
                  ))}
                </div>
              </div>
              <Connector />
              <div className="border border-jade/40 bg-jade/5 p-3.5">
                <p className="font-display font-bold text-sm text-center">Dominio · features/</p>
                <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                  {["auth", "catalog", "requests", "providers", "reviews", "referrals", "notifications", "admin"].map((f) => (
                    <span key={f} className="font-mono text-[0.62rem] text-jade border border-jade/25 bg-jade/5 px-2 py-1.5 text-center">{f}/</span>
                  ))}
                </div>
                <p className="font-mono text-[0.56rem] text-faint text-center mt-2">cada cambio de estado emite un evento de dominio</p>
              </div>
              <Connector />
              <div className="border border-line bg-panel/60 p-3.5">
                <p className="font-display font-bold text-sm text-center">Infraestructura</p>
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {["Prisma → PostgreSQL", "R2 storage", "Resend email", "Upstash", "Sentry + PostHog"].map((t) => (
                    <span key={t} className="chip">{t}</span>
                  ))}
                </div>
              </div>

              <p className="font-mono text-[0.6rem] tracking-[0.22em] text-faint mt-6 mb-3">SLOTS RESERVADOS · NO CONSTRUIR AÚN</p>
              <div className="space-y-2">
                {[
                  { t: "V2 · Realtime — Ably / WebSockets", d: "sustituye polling de 5 s" },
                  { t: "V2 · PaymentService — Azul / CardNet", d: "interfaz definida, implementación vacía" },
                  { t: "V3 · GeoService — GPS + Mapbox", d: "hoy: centroides + Haversine" },
                ].map((s) => (
                  <div key={s.t} className="border border-dashed border-faint/50 px-3 py-2 flex items-center justify-between gap-3">
                    <span className="font-mono text-[0.64rem] text-dim">{s.t}</span>
                    <span className="font-mono text-[0.56rem] text-faint">{s.d}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        {/* tree + notes */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          <Reveal delay={120}>
            <div className="border border-line bg-ink p-5 overflow-x-auto">
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-[0.6rem] tracking-[0.22em] text-faint">ESTRUCTURA DEL REPOSITORIO</p>
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-flama/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-jade/70" />
                </div>
              </div>
              <pre className="font-mono text-[0.68rem] sm:text-[0.74rem] leading-[1.75] text-dim whitespace-pre">
                {TREE.split("\n").map((line, i) => (
                  <span key={i} className={`block hover:text-paper transition-colors duration-200 ${
                    line.includes("#") ? "" : ""
                  } ${/features|app|prisma/.test(line) ? "text-paper/90" : ""}`}>
                    {line}
                  </span>
                ))}
              </pre>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-3 gap-4">
            {ARCH_NOTES.map((n, i) => (
              <Reveal key={n.t} delay={200 + i * 110}>
                <div className="h-full border border-line bg-deep/60 p-4 card-hover">
                  <Icon name={LAYER_ICON[["layers", "radar", "db"][i]] ?? "layers"} className="w-5 h-5 text-azul" />
                  <p className="mt-3 font-display font-bold text-sm">{n.t}</p>
                  <p className="mt-2 text-xs text-dim leading-relaxed">{n.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

export function Datos() {
  const [sel, setSel] = useState(ENTITIES[7].name); // ServiceRequest por defecto
  const entity = ENTITIES.find((e) => e.name === sel)!;
  const [group, setGroup] = useState<string>("all");
  const list = group === "all" ? ENTITIES : ENTITIES.filter((e) => e.group === group);

  return (
    <Section
      id="datos"
      num="04"
      kicker="Modelo de base de datos"
      title={<>19 entidades, <span className="text-amber">cinco familias.</span></>}
      intro="PostgreSQL + Prisma. El brief proponía ~21 nombres; quedaron 19 al fusionar Quote y Booking dentro de ServiceRequest (PB-01). Toca cualquier entidad para ver sus campos y relaciones."
    >
      <div className="grid lg:grid-cols-12 gap-6">
        {/* list */}
        <div className="lg:col-span-5">
          <Reveal dir="left">
            <div className="flex flex-wrap gap-1.5 mb-4">
              <button onClick={() => setGroup("all")} className={`chip cursor-pointer transition-colors ${group === "all" ? "!text-ink !bg-paper !border-paper" : "hover:!text-paper"}`}>
                Todas · {ENTITIES.length}
              </button>
              {ENTITY_GROUPS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => { setGroup(g.id); const first = ENTITIES.find((e) => e.group === g.id); if (first) setSel(first.name); }}
                  className={`chip cursor-pointer transition-colors ${group === g.id ? "!text-ink !bg-paper !border-paper" : "hover:!text-paper"}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </Reveal>
          <div className="space-y-1.5 max-h-[34rem] overflow-y-auto pr-1 no-scrollbar">
            {list.map((e, i) => {
              const active = e.name === sel;
              return (
                <Reveal key={e.name} delay={Math.min(i * 40, 300)}>
                  <button
                    onClick={() => setSel(e.name)}
                    className={`w-full text-left px-4 py-3 border transition-all duration-300 group ${
                      active ? "border-flama/60 bg-flama/10 translate-x-1" : "border-line bg-deep/50 hover:border-azul/40 hover:translate-x-1"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className={`font-mono text-[0.78rem] font-bold ${active ? "text-flama" : "text-paper group-hover:text-azul"}`}>{e.name}</span>
                      <span className="font-mono text-[0.56rem] text-faint tracking-wider uppercase">
                        {ENTITY_GROUPS.find((g) => g.id === e.group)?.label}
                      </span>
                    </span>
                  </button>
                </Reveal>
              );
            })}
          </div>
        </div>

        {/* detail */}
        <div className="lg:col-span-7">
          <Reveal delay={120}>
            <div key={entity.name} className="border border-line bg-deep/70 tick-corners">
              <div className="px-5 py-4 border-b border-line flex items-start justify-between gap-4">
                <div>
                  <p className="font-display font-extrabold text-xl">{entity.name}</p>
                  <p className="mt-1.5 text-sm text-dim leading-relaxed max-w-xl">{entity.desc}</p>
                </div>
                <span className="chip shrink-0 hidden sm:inline">{ENTITY_GROUPS.find((g) => g.id === entity.group)?.label}</span>
              </div>
              <div className="grid md:grid-cols-5">
                <div className="md:col-span-3 p-5 border-b md:border-b-0 md:border-r border-line">
                  <p className="font-mono text-[0.58rem] tracking-[0.22em] text-faint mb-3">CAMPOS CLAVE</p>
                  <ul className="space-y-2">
                    {entity.fields.map((f) => (
                      <li key={f.name} className="font-mono text-[0.7rem] leading-relaxed">
                        <span className="text-amber">{f.name}</span>
                        <span className="text-dim"> : {f.type}</span>
                        {f.note && <span className="block text-faint text-[0.6rem] pl-3 border-l border-linesoft ml-1 mt-0.5">{f.note}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="md:col-span-2 p-5">
                  <p className="font-mono text-[0.58rem] tracking-[0.22em] text-faint mb-3">RELACIONES</p>
                  <ul className="space-y-2.5">
                    {entity.rels.map((r) => (
                      <li key={r} className="flex gap-2 text-[0.72rem] text-dim font-mono leading-snug">
                        <Icon name="arrow" className="w-3.5 h-3.5 text-jade shrink-0 mt-0.5" strokeWidth={2.2} />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
