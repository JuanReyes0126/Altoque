import { PUSHBACKS, STACK, VERDICT } from "../data/blueprint";
import { Counter, Reveal } from "../lib/anim";
import { Icon } from "./icons";
import { Section } from "./ui";

export function Veredicto() {
  return (
    <Section
      id="veredicto"
      num="01"
      kicker="Análisis de viabilidad"
      title={<>Viable. Y más simple <span className="text-flama">de lo que parece.</span></>}
    >
      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-5">
          {VERDICT.paras.map((p, i) => (
            <Reveal key={i} delay={i * 120}>
              <p className="text-dim leading-relaxed border-l-2 border-line pl-5 text-[0.98rem]">
                <span className="font-mono text-[0.6rem] tracking-[0.2em] text-flama block mb-2">NOTA DE CAMPO {String(i + 1).padStart(2, "0")}</span>
                {p}
              </p>
            </Reveal>
          ))}
          <Reveal delay={240}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line border border-line mt-8">
              {VERDICT.metrics.map((m) => (
                <div key={m.label} className="bg-deep p-4">
                  <p className="font-display font-extrabold text-2xl text-paper">
                    <Counter to={m.v} suffix={m.suf} />
                  </p>
                  <p className="font-mono text-[0.56rem] tracking-[0.12em] uppercase text-faint mt-1 leading-snug">{m.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        <div className="lg:col-span-5">
          <Reveal dir="left" delay={150}>
            <div className="border border-flama/40 bg-flama/5 p-5 relative overflow-hidden">
              <div className="absolute -top-6 -right-6 w-24 h-24 border-2 border-flama/30 rotate-12" aria-hidden />
              <p className="font-display font-extrabold text-lg leading-tight">
                Pediste que no te diera la razón automáticamente.
              </p>
              <p className="mt-3 text-sm text-dim leading-relaxed">
                El brief es sólido — la intuición de producto es correcta. Pero ocho decisiones se ajustaron abajo antes
                de escribir una sola línea de código. Cada una con alternativa concreta.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {["menos tablas", "menos fricción", "más anti-fraude", "cero sobreingeniería"].map((t) => (
                  <span key={t} className="chip !text-flama !border-flama/40">{t}</span>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal dir="left" delay={280}>
            <div className="mt-4 border border-line bg-deep/60 p-5">
              <p className="font-mono text-[0.6rem] tracking-[0.22em] text-jade flex items-center gap-2">
                <Icon name="shield" className="w-4 h-4" /> LO QUE SÍ SE MANTIENE TAL CUAL
              </p>
              <ul className="mt-3 space-y-2 text-sm text-dim">
                {[
                  "Santiago primero, territorio en 4 niveles",
                  "ETA declarada por el pro en vez de GPS (brillante para V1)",
                  "Reviews solo vinculadas a servicios reales",
                  "Verificación por niveles desde el día 1",
                  "Promociones como datos, no como código",
                ].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <Icon name="check" className="w-4 h-4 text-jade shrink-0 mt-0.5" strokeWidth={2.4} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>

      {/* pushbacks */}
      <div className="mt-14">
        <Reveal>
          <p className="font-mono text-[0.66rem] tracking-[0.26em] text-dim mb-5">
            REGISTRO DE AJUSTES — <span className="text-flama">8 OBSERVACIONES AL BRIEF</span>
          </p>
        </Reveal>
        <div className="grid md:grid-cols-2 gap-4">
          {PUSHBACKS.map((pb, i) => (
            <Reveal key={pb.n} delay={(i % 2) * 110}>
              <article className="group h-full border border-line bg-deep/70 p-5 card-hover relative">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-display font-bold text-[1.05rem] leading-snug pr-2 group-hover:text-amber transition-colors duration-300">
                    {pb.title}
                  </h3>
                  <span className="shrink-0 font-mono text-[0.58rem] tracking-[0.16em] text-flama border border-flama/40 px-2 py-1 rotate-2 group-hover:rotate-0 transition-transform duration-300">
                    {pb.n}
                  </span>
                </div>
                <p className="mt-3 text-sm text-dim leading-relaxed">{pb.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}

export function Stack() {
  return (
    <Section
      id="stack"
      num="02"
      kicker="Stack tecnológico"
      title={<>Aburridamente confiable, <span className="text-jade">a propósito.</span></>}
      intro="Cada pieza se eligió por una razón: velocidad de equipo, typesafety y una rampa limpia hacia V2. Nada exótico que haya que reescribir en un año."
    >
      <div className="border border-line bg-deep/50">
        <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 border-b border-line font-mono text-[0.6rem] tracking-[0.2em] text-faint uppercase">
          <span className="col-span-3">Capa</span>
          <span className="col-span-4">Elección</span>
          <span className="col-span-5">Por qué</span>
        </div>
        {STACK.map((s, i) => (
          <Reveal key={s.layer} delay={i * 50}>
            <div className="grid sm:grid-cols-12 gap-2 sm:gap-4 px-5 py-4 border-b border-linesoft last:border-0 group hover:bg-panel/50 transition-colors duration-300">
              <div className="sm:col-span-3 flex items-center gap-2">
                <span className="font-mono text-[0.6rem] text-flama">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-display font-bold text-sm">{s.layer}</span>
              </div>
              <div className="sm:col-span-4">
                <span className="font-mono text-[0.78rem] text-amber">{s.tech}</span>
              </div>
              <p className="sm:col-span-5 text-sm text-dim leading-relaxed">{s.why}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal delay={150}>
        <p className="mt-5 font-mono text-[0.64rem] text-faint leading-relaxed">
          * Nota honesta: este blueprint es un documento interactivo en React/Vite. El producto real se construye con el
          stack de arriba — la propuesta se mantiene idéntica a lo que estás viendo en pantalla: mismo sistema de diseño,
          mismos flujos, mismos estados.
        </p>
      </Reveal>
    </Section>
  );
}
