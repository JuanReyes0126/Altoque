import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BRANCH_STATES, STATES, type ReqState } from "../data/blueprint";
import { Reveal, usePrefersReducedMotion } from "../lib/anim";
import { Icon } from "./icons";
import { Section, TONES } from "./ui";

const ACTOR_META: Record<ReqState["actor"], { label: string; cls: string }> = {
  cliente: { label: "CLIENTE", cls: "text-azul border-azul/40" },
  pro: { label: "PROFESIONAL", cls: "text-jade border-jade/40" },
  sistema: { label: "SISTEMA", cls: "text-amber border-amber/40" },
  ambos: { label: "AMBOS", cls: "text-flama border-flama/40" },
};

export default function StateMachine() {
  const reduced = usePrefersReducedMotion();
  const [sel, setSel] = useState<ReqState>(STATES[2]);

  const Node = ({ s, i, dashed = false }: { s: ReqState; i: number; dashed?: boolean }) => {
    const t = TONES[s.tone];
    const active = sel.id === s.id;
    return (
      <button
        onClick={() => setSel(s)}
        className={`relative shrink-0 text-left border px-4 py-3.5 transition-all duration-300 group min-w-[9.5rem] ${
          dashed ? "border-dashed" : ""
        } ${active ? `${t.border} ${t.bg} -translate-y-1` : "border-line bg-deep/60 hover:-translate-y-1 hover:border-faint"}`}
        aria-pressed={active}
      >
        <span className={`absolute top-2 right-2.5 font-mono text-[0.55rem] ${active ? t.text : "text-faint"}`}>
          {dashed ? "alt" : String(i + 1).padStart(2, "0")}
        </span>
        <span className={`block w-2 h-2 rounded-full ${t.dot} ${active ? "animate-pulse-dot" : ""}`} />
        <span className={`block mt-2 font-display font-bold text-[0.92rem] leading-tight ${active ? t.text : "text-paper"}`}>{s.label}</span>
        <span className={`block mt-1 font-mono text-[0.56rem] tracking-wider uppercase border px-1.5 py-0.5 w-max ${ACTOR_META[s.actor].cls}`}>
          {ACTOR_META[s.actor].label}
        </span>
      </button>
    );
  };

  return (
    <Section
      id="estados"
      num="05"
      kicker="Sistema de estados"
      title={<>Una solicitud, <span className="text-jade">once destinos posibles.</span></>}
      intro="El corazón operacional del MVP. Cada transición queda firmada en RequestEvent — de ahí salen el tiempo promedio de aceptación y toda la analítica del dashboard. Toca un estado."
    >
      {/* main pipeline */}
      <Reveal>
        <div className="flex items-stretch gap-0 overflow-x-auto no-scrollbar pb-2">
          {STATES.map((s, i) => (
            <div key={s.id} className="flex items-center shrink-0">
              <Node s={s} i={i} />
              {i < STATES.length - 1 && (
                <svg className="w-7 h-5 shrink-0 text-faint" viewBox="0 0 28 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M2 10h18m0 0-5-5m5 5-5 5" className="dashline" strokeDasharray="4 4" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </Reveal>

      {/* branches */}
      <Reveal delay={150}>
        <p className="font-mono text-[0.6rem] tracking-[0.24em] text-faint mt-6 mb-3">RAMAS · LO QUE PASA CUANDO NO PASA</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {BRANCH_STATES.map((s, i) => (
            <Node key={s.id} s={s} i={i} dashed />
          ))}
        </div>
      </Reveal>

      {/* detail */}
      <div className="mt-6 min-h-[8.5rem]">
        <AnimatePresence mode="wait">
          <motion.div
            key={sel.id}
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.2, 0.7, 0.3, 1] }}
            className={`border ${TONES[sel.tone].border} ${TONES[sel.tone].bg} p-5 sm:p-6`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className={`font-mono text-[0.62rem] tracking-[0.2em] ${TONES[sel.tone].text}`}>ESTADO · {sel.id}</span>
              <span className={`font-mono text-[0.56rem] tracking-wider uppercase border px-2 py-0.5 ${ACTOR_META[sel.actor].cls}`}>
                dispara: {ACTOR_META[sel.actor].label}
              </span>
            </div>
            <p className="mt-3 text-[0.95rem] text-paper/90 leading-relaxed max-w-3xl">{sel.desc}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* transition rules */}
      <div className="grid md:grid-cols-2 gap-4 mt-6">
        {[
          { t: "Regla de oro: aceptar es atómico", d: "SELECT … FOR UPDATE dentro de una transacción. Dos pros tocando “Aceptar” al mismo milisegundo: solo uno gana, el otro recibe la solicitud siguiente del ranking.", icon: "lock" as const },
          { t: "Tiempos que mandan", d: "5 min sin aceptación → re-broadcast ampliando zonas. 15 min → se ofrece reprogramar. 7 días sin review → cierre automático. Todo vía cron + RequestEvent, sin estado fantasma.", icon: "clock" as const },
          { t: "Cancelar cuesta", d: "El cliente cancela libre hasta ACCEPTED. Desde ARRIVED, solo Report con revisión admin: protege el tiempo y la gasolina del profesional — clave para retener oferta.", icon: "alert" as const },
          { t: "Rechazo alimenta el ranking", d: "Cada DECLINED registra motivo en meta. Pros que rechazan >60% de solicitudes pierden prioridad en matching. Datos, no castigos arbitrarios.", icon: "chart" as const },
        ].map((r, i) => (
          <Reveal key={r.t} delay={i * 90}>
            <div className="h-full flex gap-4 border border-line bg-deep/60 p-5 card-hover">
              <Icon name={r.icon} className="w-5 h-5 text-amber shrink-0 mt-0.5" />
              <div>
                <p className="font-display font-bold text-sm">{r.t}</p>
                <p className="mt-1.5 text-xs text-dim leading-relaxed">{r.d}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
