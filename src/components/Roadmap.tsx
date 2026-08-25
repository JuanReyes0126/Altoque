import { useState } from "react";
import { BIZ_RISKS, COVERAGE, KPIS, PHASES, SCOPE_MVP, SCOPE_V2, SCOPE_V3, TECH_RISKS } from "../data/blueprint";
import { Reveal, useInView } from "../lib/anim";
import { Icon } from "./icons";
import { Section, TONES } from "./ui";

/* ── 10 · Alcance y riesgos ── */
export function Alcance() {
  return (
    <Section
      id="alcance"
      num="10"
      kicker="Alcance y riesgos"
      title={<>Qué entra, qué espera, <span className="text-amber">qué puede doler.</span></>}
      intro="El MVP se recorta con bisturí: todo lo que demuestra el flujo §20 entra; lo demás tiene fase asignada. Y los riesgos se nombran antes de que existan."
    >
      <div className="grid lg:grid-cols-3 gap-4">
        <Reveal dir="left">
          <div className="h-full border border-jade/50 bg-jade/5 p-5">
            <p className="font-display font-extrabold text-lg text-jade">V1 · MVP</p>
            <p className="font-mono text-[0.58rem] tracking-[0.18em] text-faint mt-1">SEMANAS 1–8 · SANTIAGO</p>
            <ul className="mt-4 space-y-2">
              {SCOPE_MVP.map((s) => (
                <li key={s} className="flex gap-2.5 text-[0.78rem] text-paper/85 leading-snug">
                  <Icon name="check" className="w-3.5 h-3.5 text-jade shrink-0 mt-0.5" strokeWidth={2.6} />{s}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        {[
          { title: "V2 · Monetizar", weeks: "MES 3–5", items: SCOPE_V2, tone: "amber" },
          { title: "V3 · Escalar", weeks: "MES 6–12", items: SCOPE_V3, tone: "azul" },
        ].map((col, ci) => (
          <Reveal key={col.title} delay={120 + ci * 110}>
            <div className={`h-full border ${TONES[col.tone].border} bg-deep/60 p-5`}>
              <p className={`font-display font-extrabold text-lg ${TONES[col.tone].text}`}>{col.title}</p>
              <p className="font-mono text-[0.58rem] tracking-[0.18em] text-faint mt-1">{col.weeks}</p>
              <ul className="mt-4 space-y-2">
                {col.items.map((s) => (
                  <li key={s} className="flex gap-2.5 text-[0.78rem] text-dim leading-snug">
                    <span className={`${TONES[col.tone].dot} w-1.5 h-1.5 rounded-full shrink-0 mt-1.5`} />{s}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>

      {/* riesgos */}
      <div className="grid lg:grid-cols-2 gap-4 mt-8">
        {[
          { title: "RIESGOS TÉCNICOS", risks: TECH_RISKS, tone: "azul" },
          { title: "RIESGOS DE NEGOCIO", risks: BIZ_RISKS, tone: "flama" },
        ].map((g, gi) => (
          <Reveal key={g.title} delay={gi * 120}>
            <div className="border border-line bg-deep/50 p-5">
              <p className={`font-mono text-[0.62rem] tracking-[0.24em] ${TONES[g.tone].text} mb-4`}>{g.title}</p>
              <div className="space-y-3">
                {g.risks.map((r) => (
                  <div key={r.r} className="border border-linesoft bg-ink/60 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-display font-bold text-[0.86rem] leading-snug">{r.r}</p>
                      <span className={`chip shrink-0 ${r.p === "Alto" ? "!text-flama !border-flama/50" : r.p === "Medio" ? "!text-amber !border-amber/50" : "!text-jade !border-jade/50"}`}>
                        {r.p}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-dim leading-relaxed">
                      <span className="font-mono text-[0.56rem] text-jade tracking-wider">MITIGACIÓN → </span>{r.m}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ── 11 · Plan + cobertura ── */
function CoverageBoard() {
  const { ref, inView } = useInView<HTMLDivElement>(0.25);
  const max = Math.max(...COVERAGE.map((c) => c.reg));
  return (
    <div ref={ref} className="border border-line bg-deep/60">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b border-line">
        <p className="font-mono text-[0.62rem] tracking-[0.22em] text-faint">TABLERO DE COBERTURA · SANTIAGO · LO QUE EL ADMIN VE</p>
        <div className="flex gap-3 font-mono text-[0.56rem] text-dim">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-azul" />registrados</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-jade" />verificados</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-amber" />disponibles</span>
        </div>
      </div>
      <div className="divide-y divide-linesoft">
        {COVERAGE.map((c, i) => (
          <div key={c.cat} className="grid grid-cols-12 gap-3 items-center px-5 py-3 hover:bg-panel/40 transition-colors">
            <div className="col-span-12 sm:col-span-3 flex items-center gap-2">
              <span className="font-display font-bold text-sm">{c.cat}</span>
              {c.critical && <span className="chip !text-flama !border-flama/50 !text-[0.5rem]">reclutar</span>}
            </div>
            <div className="col-span-9 sm:col-span-7 space-y-1">
              {([["reg", "bg-azul", c.reg], ["ver", "bg-jade", c.ver], ["disp", "bg-amber", c.disp]] as const).map(([k, bg, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <div className="flex-1 h-[5px] bg-panel overflow-hidden">
                    <div
                      className={`h-full ${bg} ${inView ? "bar-fill" : "w-0"}`}
                      style={{ width: inView ? `${(v / max) * 100}%` : "0%", animationDelay: `${i * 60}ms` }}
                    />
                  </div>
                  <span className="font-mono text-[0.6rem] text-dim w-5 text-right tabular-nums">{v}</span>
                </div>
              ))}
            </div>
            <div className="hidden sm:block col-span-2 text-right">
              <span className={`font-mono text-[0.62rem] ${c.critical ? "text-flama" : "text-jade"}`}>
                {c.critical ? "⚠ CRÍTICA" : "● OK"}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="px-5 py-3 border-t border-line font-mono text-[0.58rem] text-faint">
        Lectura inmediata: Grúas (1 disponible) y Cerrajería (3) necesitan reclutamiento antes de abrir esos barrios. Datos de seed para el demo.
      </p>
    </div>
  );
}

export function Plan() {
  return (
    <Section
      id="plan"
      num="11"
      kicker="Plan de obra"
      title={<>Ocho semanas, <span className="text-azul">cuatro fases, cero humo.</span></>}
      intro="Cada fase termina con algo usable en un teléfono. La beta cerrada abre solo cuando 30 fundadores estén aprobados — no antes, aunque el calendario llore."
    >
      {/* phases */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 relative">
        <div className="hidden lg:block absolute top-0 bottom-0 left-0 right-0 border-t-2 border-dashed border-line mt-8" aria-hidden />
        {PHASES.map((p, i) => (
          <Reveal key={p.id} delay={i * 120}>
            <article className={`relative h-full border bg-deep/70 p-5 card-hover ${TONES[p.tone].border}`}>
              <div className="flex items-center justify-between">
                <span className={`w-10 h-10 grid place-items-center font-display font-extrabold text-sm ${TONES[p.tone].solid}`}>{p.id}</span>
                <span className="font-mono text-[0.56rem] tracking-[0.16em] text-faint">{p.weeks.toUpperCase()}</span>
              </div>
              <p className={`mt-4 font-display font-extrabold text-lg ${TONES[p.tone].text}`}>{p.title}</p>
              <ul className="mt-3 space-y-2">
                {p.items.map((it) => (
                  <li key={it} className="flex gap-2 text-xs text-dim leading-snug">
                    <span className={`${TONES[p.tone].dot} w-1.5 h-1.5 rounded-full shrink-0 mt-1.5`} />{it}
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>
        ))}
      </div>

      {/* coverage + kpis */}
      <div className="mt-10 space-y-6">
        <Reveal><CoverageBoard /></Reveal>
        <Reveal delay={120}>
          <div className="border border-line bg-deep/50 p-5">
            <p className="font-mono text-[0.62rem] tracking-[0.22em] text-faint mb-4">MÉTRICAS QUE DECIDEN SI LA V1 FUNCIONÓ · PRIMEROS 30 DÍAS</p>
            <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line">
              {KPIS.map((k) => (
                <div key={k.k} className="bg-ink p-4">
                  <dt className="font-mono text-[0.58rem] tracking-[0.14em] uppercase text-faint">{k.k}</dt>
                  <dd className="mt-1.5 font-display font-bold text-sm text-amber">{k.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

/* ── 12 · Aprobación ── */
export function Aprobacion({ approved, onApprove }: { approved: boolean; onApprove: () => void }) {
  const [justStamped, setJustStamped] = useState(false);
  const stamp = () => {
    if (approved) return;
    onApprove();
    setJustStamped(true);
    window.setTimeout(() => setJustStamped(false), 1600);
  };

  return (
    <Section
      id="aprobacion"
      num="12"
      kicker="Decisión"
      title={<>El plano está sobre la mesa. <span className="text-flama">Falta tu sello.</span></>}
    >
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <Reveal dir="left">
          <div className="relative border border-line bg-deep/70 p-6 sm:p-8 min-h-[22rem] flex flex-col justify-center overflow-hidden">
            <div className="font-mono text-[0.62rem] space-y-2 text-dim">
              {[
                ["DOCUMENTO", "AT-BP-001 · Blueprint técnico V1"],
                ["PROYECTO", "AlToque RD — servicios on-demand"],
                ["LANZAMIENTO", "Santiago de los Caballeros"],
                ["ALCANCE", "MVP §20: solicitud → aceptación → ETA → servicio → review"],
                ["DURACIÓN", "6–8 semanas a beta cerrada"],
                ["EQUIPO", "2–3 ingenieros + 1 reclutador de pros"],
                ["REVISADO", "19 entidades · 11 estados · 12 frentes de seguridad"],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-4 border-b border-linesoft pb-2">
                  <span className="w-28 shrink-0 text-faint tracking-[0.18em]">{k}</span>
                  <span className="text-paper">{v}</span>
                </div>
              ))}
            </div>

            <button
              onClick={stamp}
              disabled={approved}
              className={`mt-8 group inline-flex items-center justify-center gap-3 px-6 py-4 font-display font-extrabold text-base tracking-wide transition-all duration-300 w-full sm:w-auto ${
                approved
                  ? "border-2 border-jade text-jade cursor-default"
                  : "bg-flama text-ink hover:bg-amber active:scale-95"
              }`}
            >
              {approved ? (
                <>
                  <Icon name="check" className="w-5 h-5" strokeWidth={2.6} /> APROBADO — FASE 0 EN MARCHA
                </>
              ) : (
                <>
                  SELLA LA APROBACIÓN
                  <Icon name="arrow" className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1.5" strokeWidth={2.2} />
                </>
              )}
            </button>
            <p className="mt-3 font-mono text-[0.6rem] text-faint">
              {approved ? "Sello registrado en AdminAction · actor: TÚ · at: ahora mismo" : "Un toque. Como debe ser todo en esta plataforma."}
            </p>

            {approved && (
              <div className={`pointer-events-none absolute inset-0 grid place-items-center ${justStamped ? "stamp-in" : ""}`} style={{ transform: "rotate(-8deg)" }}>
                <div className="border-[3px] border-jade/80 text-jade px-8 py-4 text-center bg-ink/70 backdrop-blur-[2px]">
                  <p className="font-display font-extrabold text-3xl sm:text-4xl tracking-wide">APROBADO</p>
                  <p className="font-mono text-[0.6rem] tracking-[0.3em] mt-1">ALTOQUE RD · {new Date().toLocaleDateString("es-DO")}</p>
                </div>
              </div>
            )}
          </div>
        </Reveal>

        <div className="space-y-4">
          <Reveal delay={120}>
            <div className="border border-line bg-deep/60 p-5">
              <p className="font-mono text-[0.62rem] tracking-[0.22em] text-jade mb-4">SI APRUEBAS, LA SEMANA 1 ARRANCA ASÍ</p>
              <ol className="space-y-3">
                {[
                  "Schema Prisma de las 19 entidades + migración inicial",
                  "Seed: 22 categorías, 6 grupos, sectores de Santiago con centroides",
                  "Auth OTP por teléfono + sesiones + RBAC funcionando",
                  "Design system en Tailwind basado en este blueprint",
                  "Storage R2 con prefirmado: subir foto ya funciona",
                  "Reclutamiento: primera lista de 30 plomeros y electricistas",
                ].map((s, i) => (
                  <li key={s} className="flex gap-3">
                    <span className="font-mono text-[0.66rem] text-flama font-bold shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-sm text-dim leading-snug">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
          <Reveal delay={220}>
            <div className="border border-amber/40 bg-amber/5 p-5">
              <p className="font-display font-bold text-sm flex items-center gap-2">
                <Icon name="alert" className="w-4 h-4 text-amber" /> Una condición honesta
              </p>
              <p className="mt-2 text-sm text-dim leading-relaxed">
                Este blueprint no se construye solo: el éxito de la beta depende de reclutar los 30 fundadores{" "}
                <em className="text-paper not-italic font-semibold">antes</em> de abrir al público. Si ese reclutamiento se
                retrasa, el calendario se mueve con él — mejor una semana tarde con pros reales que a tiempo con una
                plataforma vacía.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}

export function Footer() {
  return (
    <footer className="relative border-t border-line mt-10">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-10">
        <div className="flex flex-col lg:flex-row gap-8 lg:items-end justify-between">
          <div>
            <p className="font-display font-extrabold text-2xl tracking-tight">
              ALTOQUE<span className="text-flama">·</span>RD
            </p>
            <p className="mt-2 font-mono text-[0.62rem] text-faint leading-relaxed max-w-md">
              Blueprint técnico V1 · documento AT-BP-001 · revisado para construcción.
              Hecho en Santiago, para todo el país. 19.4517° N, 70.6970° O.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line border border-line font-mono text-[0.58rem]">
            {[
              ["PROYECTO", "Servicios on-demand"],
              ["FASE", "V1 · MVP"],
              ["REV", "1.0"],
              ["ESTADO", "Para aprobación"],
            ].map(([k, v]) => (
              <div key={k} className="bg-ink px-4 py-3">
                <p className="text-faint tracking-[0.2em]">{k}</p>
                <p className="text-paper mt-0.5">{v}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 pt-5 border-t border-linesoft flex flex-wrap items-center justify-between gap-3 font-mono text-[0.58rem] text-faint">
          <span>© 2026 · Blueprint interactivo — el producto real se construye al aprobarse</span>
          <span className="flex items-center gap-4">
            <a href="#top" className="hover:text-paper transition-colors">↑ Volver al cajetín</a>
            <a href="#flujos" className="hover:text-paper transition-colors">Rever el flujo</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
