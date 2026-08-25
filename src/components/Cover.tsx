import { useEffect, useState } from "react";
import { COVER_STATS, MARQUEE, PIPELINE } from "../data/blueprint";
import { Counter, Reveal, Scramble, usePrefersReducedMotion } from "../lib/anim";
import { CAT_ICONS, Icon } from "./icons";
import { Avatar, Dot, Stars, TONES } from "./ui";

function LiveSim() {
  const reduced = usePrefersReducedMotion();
  const [stage, setStage] = useState(0);
  const [countdown, setCountdown] = useState(20);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setStage((s) => (s + 1) % PIPELINE.length), 3000);
    return () => window.clearInterval(id);
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    if (stage === 2) {
      setCountdown(20);
      const id = window.setInterval(() => setCountdown((c) => (c > 1 ? c - 1 : 20)), 140);
      return () => window.clearInterval(id);
    }
  }, [stage, reduced]);

  const p = PIPELINE[stage];
  const tone = TONES[p.tone];
  const pct = ((stage + 1) / PIPELINE.length) * 100;

  return (
    <div className="relative">
      {/* radar rings */}
      <div className="absolute -top-16 -right-10 w-64 h-64 opacity-25 pointer-events-none hidden sm:block" aria-hidden>
        <div className="absolute inset-0 rounded-full border border-azul/40" />
        <div className="absolute inset-8 rounded-full border border-azul/30" />
        <div className="absolute inset-16 rounded-full border border-azul/20" />
        <div className="absolute inset-0 rounded-full overflow-hidden animate-sweep">
          <div className="absolute inset-0" style={{ background: "conic-gradient(from 0deg, rgba(90,162,255,0.35), transparent 70deg)" }} />
        </div>
      </div>

      <div className="relative border border-line bg-deep/80 backdrop-blur-sm tick-corners">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
          <span className="font-mono text-[0.6rem] tracking-[0.22em] text-dim">SIMULACIÓN · SOLICITUD AT-2026-0042</span>
          <span className="flex items-center gap-1.5 font-mono text-[0.6rem] text-jade">
            <Dot pulse /> EN VIVO
          </span>
        </div>

        <div className="p-4 sm:p-5">
          {/* pro card */}
          <div className="flex items-center gap-3">
            <Avatar initials="CR" className="w-11 h-11 text-xs bg-panel2 text-amber" />
            <div className="flex-1 min-w-0">
              <p className="font-display font-bold text-sm leading-tight">Carlos Rodríguez</p>
              <p className="font-mono text-[0.62rem] text-dim mt-0.5 flex items-center gap-2 flex-wrap">
                <Stars n={5} size="w-2.5 h-2.5" /> 4.9 · 238 servicios · ~3.2 km
              </p>
            </div>
            <span className="chip !text-jade !border-jade/40 flex items-center gap-1.5">
              <Dot pulse /> Verificado
            </span>
          </div>

          {/* current status */}
          <div className={`mt-4 border ${tone.border} ${tone.bg} px-3.5 py-3 transition-colors duration-500`}>
            <div className="flex items-center justify-between gap-3">
              <p className={`font-display font-bold text-sm ${tone.text}`}>{p.label}</p>
              {stage === 2 && (
                <span className="font-mono text-xs text-amber tabular-nums">
                  {countdown} min<span className="animate-blink">_</span>
                </span>
              )}
              {stage === 4 && <Stars n={5} size="w-3 h-3" />}
            </div>
            {p.eta && <p className="font-mono text-[0.62rem] text-dim mt-1">{p.eta}</p>}
          </div>

          {/* progress */}
          <div className="mt-3 h-1 bg-panel overflow-hidden">
            <div className={`h-full ${tone.dot} transition-all duration-700`} style={{ width: `${pct}%` }} />
          </div>

          {/* pipeline steps */}
          <ol className="mt-4 space-y-1.5">
            {PIPELINE.map((s, i) => (
              <li key={s.label} className={`flex items-center gap-2.5 font-mono text-[0.66rem] transition-all duration-500 ${i < stage ? "text-dim" : i === stage ? "text-paper" : "text-faint"}`}>
                <span className={`w-4 h-4 grid place-items-center border ${i < stage ? "border-jade/60 text-jade" : i === stage ? `${TONES[s.tone].border} ${TONES[s.tone].text}` : "border-line text-faint"}`}>
                  {i < stage ? <Icon name="check" className="w-2.5 h-2.5" strokeWidth={2.6} /> : <span className="text-[0.5rem]">{i + 1}</span>}
                </span>
                {s.label}
                {i === stage && <span className={`ml-auto w-1.5 h-1.5 rounded-full ${TONES[s.tone].dot} animate-pulse-dot`} />}
              </li>
            ))}
          </ol>
        </div>

        <div className="px-4 py-2.5 border-t border-line flex items-center justify-between">
          <span className="font-mono text-[0.58rem] text-faint tracking-wider">CLIENTE → MATCHING → PRO → REVIEW</span>
          <span className="font-mono text-[0.58rem] text-faint">SIN GPS · SIN PAGOS · V1</span>
        </div>
      </div>
    </div>
  );
}

export default function Cover() {
  return (
    <div id="top" className="relative">
      {/* doc strip */}
      <div className="border-b border-line">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[0.6rem] tracking-[0.18em] text-faint">
          <span>DOC. AT-BP-001</span>
          <span>REV. 1.0</span>
          <span className="hidden sm:inline">ESCALA 1:1</span>
          <span className="hidden md:inline">SANTIAGO DE LOS CABALLEROS · RD</span>
          <span className="ml-auto text-amber border border-amber/40 px-2 py-0.5">PARA APROBACIÓN</span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-8 pt-28 sm:pt-32 lg:pt-24 pb-10">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-8 items-start">
          {/* left: title block */}
          <div className="lg:col-span-7">
            <Reveal>
              <p className="flex items-center gap-3 font-mono text-[0.68rem] tracking-[0.24em] text-jade">
                <Icon name="radar" className="w-4 h-4" />
                BLUEPRINT TÉCNICO · MVP · 6–8 SEMANAS
              </p>
              <h1 className="mt-6 font-display font-extrabold tracking-[-0.02em] leading-[0.98] text-[clamp(2.6rem,7.5vw,5.6rem)]">
                <Scramble text="“Necesito un" />
                <br />
                <span className="text-flama">
                  <Scramble text="plomero ahora.”" speed={34} />
                </span>
              </h1>
            </Reveal>
            <Reveal delay={150}>
              <p className="mt-7 max-w-xl text-dim text-base sm:text-lg leading-relaxed">
                Esa frase es el producto entero. Este documento es el plano para construir{" "}
                <strong className="text-paper font-semibold">AlToque</strong>: la plataforma dominicana de servicios
                on-demand — pensada para todo el país, lanzada calle por calle en{" "}
                <strong className="text-paper font-semibold">Santiago de los Caballeros</strong>. Arquitectura, datos,
                flujos, seguridad y plan de obra. Sin GPS en vivo, sin pagos, sin sobreingeniería: un MVP excelente.
              </p>
            </Reveal>
            <Reveal delay={280}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a href="#flujos" className="group inline-flex items-center gap-2.5 bg-flama text-ink font-display font-bold text-sm px-5 py-3 hover:bg-amber transition-colors duration-300">
                  Ver el flujo en vivo
                  <Icon name="arrow" className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2.2} />
                </a>
                <a href="#datos" className="inline-flex items-center gap-2.5 border border-line text-paper font-display font-semibold text-sm px-5 py-3 hover:border-azul/60 hover:text-azul transition-colors duration-300">
                  <Icon name="db" className="w-4 h-4" />
                  Modelo de datos
                </a>
                <a href="#aprobacion" className="font-mono text-[0.68rem] tracking-wider text-dim underline decoration-line underline-offset-4 hover:text-paper transition-colors">
                  Ir directo a aprobar ↓
                </a>
              </div>
            </Reveal>

            <Reveal delay={380}>
              <dl className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-px bg-line border border-line">
                {COVER_STATS.map((s, i) => (
                  <div key={s.l} className="bg-ink p-4 sm:p-5">
                    <dt className="order-2 font-mono text-[0.58rem] tracking-[0.16em] text-faint uppercase mt-1.5">{s.l}</dt>
                    <dd className="font-display font-extrabold text-2xl sm:text-3xl text-paper">
                      <Counter to={parseInt(s.k)} />
                      {s.k === "6" && <span className="text-flama text-lg"> sem</span>}
                    </dd>
                    <span className="sr-only">{i}</span>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          {/* right: live sim */}
          <div className="lg:col-span-5 lg:pt-4 animate-float-y motion-reduce:animate-none">
            <Reveal delay={200} dir="left">
              <LiveSim />
              <div className="mt-4 flex items-center justify-between border border-line bg-deep/60 px-4 py-3">
                <span className="font-mono text-[0.6rem] tracking-[0.18em] text-dim">MODALIDADES V1</span>
                <span className="flex gap-2">
                  <span className="chip !text-amber !border-amber/40">⚡ Ahora</span>
                  <span className="chip !text-azul !border-azul/40">◷ Programar</span>
                </span>
              </div>
            </Reveal>
          </div>
        </div>
      </div>

      {/* marquee */}
      <div className="border-y border-line bg-deep/50 overflow-hidden py-3" aria-hidden>
        <div className="flex w-max animate-marquee gap-2 pr-2 motion-reduce:animate-none">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex gap-2">
              {MARQUEE.map((c) => (
                <span key={`${dup}-${c}`} className="inline-flex items-center gap-2 border border-linesoft px-3 py-1.5 font-mono text-[0.66rem] tracking-wider text-dim whitespace-nowrap">
                  <Icon name={CAT_ICONS[c] ?? "wrench"} className="w-3.5 h-3.5 text-faint" />
                  {c}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
