import { useState } from "react";
import { FOUNDER_TIERS, PLANS, REFERRAL_CHECKLIST, REVIEW_RULES, SECURITY, WIREFRAMES } from "../data/blueprint";
import { Reveal } from "../lib/anim";
import { Icon } from "./icons";
import { Avatar, Section, Stars, TONES } from "./ui";

/* ── 07 · Pantallas ── */
export function Pantallas() {
  return (
    <Section
      id="pantallas"
      num="07"
      kicker="Wireframes textuales"
      title={<>Las pantallas, <span className="text-azul">antes de los píxeles.</span></>}
      intro="Seis pantallas cargan el 90% del producto. Dibujadas en texto a propósito: primero la jerarquía de la información, después el maquillaje."
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {WIREFRAMES.map((w, i) => (
          <Reveal key={w.name} delay={(i % 3) * 110}>
            <figure className="group h-full border border-line bg-deep/60 card-hover flex flex-col">
              <figcaption className="px-4 pt-4">
                <p className="font-display font-bold text-sm">{w.name}</p>
                <p className="font-mono text-[0.58rem] text-faint mt-0.5">{w.note}</p>
              </figcaption>
              <pre className="mt-3 mx-4 mb-4 border border-linesoft bg-ink p-3 font-mono text-[0.56rem] sm:text-[0.6rem] leading-[1.6] text-dim overflow-x-auto group-hover:text-paper/80 transition-colors duration-500 flex-1">
                {w.art}
              </pre>
            </figure>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ── 08 · Confianza ── */
export function Confianza() {
  return (
    <Section
      id="confianza"
      num="08"
      kicker="Autenticación, seguridad y reviews"
      title={<>La confianza es <span className="text-jade">el producto.</span></>}
      intro="Nadie deja entrar a un desconocido a su casa por un directorio. La verificación por niveles, las reviews blindadas y la seguridad desde el día 1 son el foso competitivo — no un accesorio."
    >
      {/* verification demo */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5">
          <Reveal dir="left">
            <div className="border border-line bg-deep/70 p-5 tick-corners h-full">
              <p className="font-mono text-[0.6rem] tracking-[0.22em] text-faint mb-4">ASÍ SE VE LA CONFIANZA</p>
              <div className="flex items-center gap-3">
                <Avatar initials="CR" tone="bg-panel2 text-amber" className="w-12 h-12 text-sm" />
                <div>
                  <p className="font-display font-extrabold text-lg leading-tight">Carlos Rodríguez</p>
                  <p className="flex items-center gap-2 font-mono text-[0.62rem] text-dim mt-1">
                    <Stars n={5} size="w-3 h-3" /> 4.9 · 127 reseñas · 238 trabajos
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  { t: "Identidad verificada", lvl: "nivel 2/3", icon: "shield" as const, tone: "jade" },
                  { t: "Teléfono verificado", lvl: "OTP activo", icon: "phone" as const, tone: "jade" },
                  { t: "Profesional verificado", lvl: "doc. revisado", icon: "check" as const, tone: "jade" },
                  { t: "Proveedor Fundador", lvl: "#017 de 100", icon: "flag" as const, tone: "amber" },
                ].map((b) => (
                  <div key={b.t} className={`border ${TONES[b.tone].border} ${TONES[b.tone].bg} px-3 py-2.5`}>
                    <p className={`flex items-center gap-1.5 font-mono text-[0.6rem] font-bold ${TONES[b.tone].text}`}>
                      <Icon name={b.icon} className="w-3.5 h-3.5" /> {b.t}
                    </p>
                    <p className="font-mono text-[0.52rem] text-faint mt-0.5">{b.lvl}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 font-mono text-[0.58rem] text-faint leading-relaxed">
                Cada verificación es una fila en la tabla Verification con nivel — agregar “Licencia técnica” o
                “Empresa registrada” mañana es un INSERT, no una migración.
              </p>
            </div>
          </Reveal>
        </div>

        <div className="lg:col-span-7">
          <Reveal delay={120}>
            <p className="font-mono text-[0.6rem] tracking-[0.24em] text-faint mb-4">REVIEWS BLINDADAS · 5 REGLAS</p>
            <div className="space-y-2.5">
              {REVIEW_RULES.map((r, i) => (
                <div key={r.t} className="flex gap-4 border border-line bg-deep/60 p-4 card-hover">
                  <span className="font-mono text-[0.62rem] text-flama font-bold shrink-0 mt-0.5">R{i + 1}</span>
                  <div>
                    <p className="font-display font-bold text-sm">{r.t}</p>
                    <p className="mt-1 text-xs text-dim leading-relaxed">{r.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>

      {/* security grid */}
      <div className="mt-14">
        <Reveal>
          <p className="font-mono text-[0.6rem] tracking-[0.24em] text-faint mb-5 flex items-center gap-2">
            <Icon name="lock" className="w-4 h-4 text-amber" /> SEGURIDAD DESDE EL DÍA 1 · 12 FRENTE
          </p>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SECURITY.map((s, i) => (
            <Reveal key={s.t} delay={(i % 3) * 90}>
              <div className="h-full border border-line bg-deep/50 p-4 card-hover">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display font-bold text-[0.86rem]">{s.t}</p>
                  <span className="chip !text-jade !border-jade/40 shrink-0">V1</span>
                </div>
                <p className="mt-2 text-xs text-dim leading-relaxed">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={150}>
          <p className="mt-5 font-mono text-[0.64rem] text-faint">
            * Cumplimiento RD: Ley 172-13 de protección de datos personales — política de privacidad y retención definidas antes de beta.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}

/* ── 09 · Crecimiento ── */
function monthsFor(refs: number) {
  let extra = 0;
  if (refs >= 3) extra += 1;
  if (refs >= 5) extra += 2;
  if (refs >= 10) extra += 3;
  return extra;
}

export function Crecimiento() {
  const [refs, setRefs] = useState(5);
  const extra = monthsFor(refs);

  return (
    <Section
      id="crecimiento"
      num="09"
      kicker="Fundadores, referidos y planes"
      title={<>Reclutar oferta es <span className="text-flama">infraestructura.</span></>}
      intro="El programa de Proveedores Fundadores vive en la tabla Promotion con reglas jsonb: cambiar “100 cupos” por “150” es editar una fila. El referido solo cuenta cuando el colega completa su primer servicio — anti-fraude de diseño, no de parche."
    >
      {/* founder tiers */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {FOUNDER_TIERS.map((t, i) => (
          <Reveal key={t.req} delay={i * 100}>
            <article className={`relative h-full border p-5 card-hover overflow-hidden ${TONES[t.tone].border} ${t.tone === "flama" ? "bg-flama/10" : "bg-deep/60"}`}>
              {t.badge && (
                <span className={`absolute -right-7 top-5 rotate-45 font-mono text-[0.5rem] tracking-[0.2em] px-8 py-1 ${TONES[t.tone].solid}`}>
                  {t.badge}
                </span>
              )}
              <p className={`font-display font-extrabold text-4xl ${TONES[t.tone].text}`}>{t.req}</p>
              <p className="mt-2 font-display font-bold text-sm leading-snug">{t.title}</p>
              <p className="mt-1.5 text-xs text-dim leading-relaxed">{t.detail}</p>
              <p className={`mt-4 pt-3 border-t border-linesoft font-mono text-[0.66rem] font-bold ${TONES[t.tone].text}`}>
                → {t.reward}
              </p>
            </article>
          </Reveal>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        {/* calculator */}
        <Reveal dir="left">
          <div className="border border-line bg-deep/70 p-6 h-full">
            <p className="font-mono text-[0.6rem] tracking-[0.22em] text-amber mb-1">CALCULADORA DE REFERIDOS</p>
            <p className="text-sm text-dim">¿Cuántos colegas verificados trae un fundador?</p>
            <input
              type="range" min={0} max={12} value={refs}
              onChange={(e) => setRefs(parseInt(e.target.value))}
              className="w-full mt-5 accent-[#ff4b3a] cursor-pointer"
              aria-label="Número de colegas referidos"
            />
            <div className="flex justify-between font-mono text-[0.56rem] text-faint mt-1">
              <span>0</span><span>3 → +1</span><span>5 → +2</span><span>10 → +3</span><span>12</span>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-px bg-line border border-line text-center">
              <div className="bg-ink p-4">
                <p className="font-display font-extrabold text-3xl text-paper">{refs}</p>
                <p className="font-mono text-[0.54rem] tracking-wider text-faint uppercase mt-1">colegas</p>
              </div>
              <div className="bg-ink p-4">
                <p className="font-display font-extrabold text-3xl text-amber">+{extra}<span className="text-sm"> m</span></p>
                <p className="font-mono text-[0.54rem] tracking-wider text-faint uppercase mt-1">PRO extra</p>
              </div>
              <div className="bg-ink p-4">
                <p className="font-display font-extrabold text-3xl text-jade">{refs >= 10 ? "SÍ" : "—"}{refs >= 10 && <span className="text-sm"> ⛨</span>}</p>
                <p className="font-mono text-[0.54rem] tracking-wider text-faint uppercase mt-1">embajador</p>
              </div>
            </div>
            <p className="mt-4 font-mono text-[0.6rem] text-faint leading-relaxed">
              Base: 3 meses PRO por ser de los primeros 100. Cada hito suma. Todo calculado por el motor de Promotion — nunca hardcodeado.
            </p>
          </div>
        </Reveal>

        {/* checklist + anti fraude */}
        <div className="flex flex-col gap-4">
          <Reveal delay={100}>
            <div className="border border-line bg-deep/60 p-5">
              <p className="font-mono text-[0.6rem] tracking-[0.22em] text-jade mb-3 flex items-center gap-2">
                <Icon name="shield" className="w-4 h-4" /> UN REFERIDO CUENTA CUANDO…
              </p>
              <ol className="space-y-2">
                {REFERRAL_CHECKLIST.map((c, i) => (
                  <li key={c} className="flex items-start gap-3">
                    <span className={`w-5 h-5 grid place-items-center border font-mono text-[0.56rem] shrink-0 ${i === REFERRAL_CHECKLIST.length - 1 ? "border-flama text-flama font-bold" : "border-jade/50 text-jade"}`}>
                      {i === REFERRAL_CHECKLIST.length - 1 ? <Icon name="star" className="w-3 h-3" /> : <Icon name="check" className="w-3 h-3" strokeWidth={2.6} />}
                    </span>
                    <span className={`text-sm ${i === REFERRAL_CHECKLIST.length - 1 ? "text-paper font-semibold" : "text-dim"}`}>
                      {c}
                      {i === REFERRAL_CHECKLIST.length - 1 && <span className="font-mono text-[0.56rem] text-flama ml-2">(ajuste PB-05)</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>

          {/* planes */}
          <Reveal delay={200}>
            <div className="border border-line bg-deep/60 p-5 flex-1">
              <p className="font-mono text-[0.6rem] tracking-[0.22em] text-faint mb-4">PLANES · DEFINIDOS HOY, COBRO EN V2</p>
              <div className="grid sm:grid-cols-3 gap-3">
                {PLANS.map((p) => (
                  <div key={p.name} className={`border p-3.5 ${p.name === "PRO" ? "border-amber/60 bg-amber/5" : "border-line"}`}>
                    <div className="flex items-center justify-between">
                      <p className="font-display font-extrabold text-sm">{p.name}</p>
                      <span className={`chip !text-[0.5rem] ${p.tag.startsWith("V1") ? "!text-jade !border-jade/40" : "!text-azul !border-azul/40"}`}>{p.tag}</span>
                    </div>
                    <p className={`font-mono text-[0.7rem] mt-1 ${p.name === "PRO" ? "text-amber" : "text-dim"}`}>{p.price}/mes</p>
                    <ul className="mt-2.5 space-y-1.5">
                      {p.perks.map((pk) => (
                        <li key={pk} className="flex gap-1.5 text-[0.64rem] text-dim leading-snug">
                          <span className="text-jade mt-px">·</span>{pk}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
