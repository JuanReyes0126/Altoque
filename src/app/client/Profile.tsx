import { Icon } from "../../components/icons";
import { AvailDot, Face, FadeUp, FavBtn, Stars, Verif } from "../bits";
import { JOB_IMGS, PROBLEMS, fmt, jobUrl, proById, zoneById, type View } from "../store";

export function ProProfile({ id, go }: { id: string; go: (v: View) => void }) {
  const p = proById(id);
  const jobs = PROBLEMS[p.cats[0]] ?? [];

  return (
    <div className="max-w-5xl mx-auto px-5 pb-32 lg:pb-12">
      {/* header */}
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur-md py-3 flex items-center gap-3">
        <button onClick={() => go({ t: "results", catId: p.cats[0] })} className="w-10 h-10 grid place-items-center rounded-full card shrink-0" aria-label="Volver">
          <Icon name="chevl" className="w-4.5 h-4.5" strokeWidth={2.4} />
        </button>
        <p className="font-disp font-bold truncate">Perfil profesional</p>
        <FavBtn id={p.id} className="ml-auto" />
      </header>

      <div className="lg:grid lg:grid-cols-[1fr_24rem] lg:gap-8">
        {/* columna principal */}
        <div>
          <FadeUp>
            <div className="card overflow-hidden">
              <div className="relative h-44 sm:h-56 overflow-hidden">
                <img
                  src={jobUrl(p.portfolio[0] ?? 0)}
                  alt={`Trabajo de ${p.name}`}
                  className="w-full h-full object-cover"
                  style={{ objectPosition: `${(p.portfolio[0] ?? 0) % 2 === 1 ? "100%" : "0%"} ${(p.portfolio[0] ?? 0) >= 2 ? "100%" : "0%"}` }}
                  onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink2/70 via-transparent" />
                <span className={`absolute top-4 right-4 rounded-full px-3 py-1.5 text-[0.68rem] font-extrabold backdrop-blur-sm ${p.available ? "bg-grn text-white" : "bg-ink2/60 text-white"}`}>
                  {p.available ? "🟢 Disponible ahora" : "⚫ No disponible"}
                </span>
              </div>
              <div className="p-5 sm:p-6 -mt-10 relative">
                <div className="flex items-end gap-4">
                  <Face face={p.face} name={p.name} size="w-20 h-20 sm:w-24 sm:h-24" ring />
                  <div className="pb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="font-disp font-bold text-2xl">{p.name}</h1>
                      {p.founder && <span className="rounded-full bg-sun text-ink2 text-[0.6rem] font-extrabold px-2 py-0.5">★ FUNDADOR</span>}
                    </div>
                    <p className="text-sm text-mut font-semibold mt-0.5">{p.tagline}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 font-bold">
                    <Stars n={p.rating} /> {p.rating}
                    <span className="text-mut2 font-semibold">({p.reviews} reseñas)</span>
                  </span>
                  <Verif />
                  <AvailDot on={p.available} />
                </div>

                <div className="grid grid-cols-3 gap-px bg-edge2 rounded-2xl overflow-hidden mt-5 border border-edge2">
                  {[
                    { v: String(p.jobs), l: "servicios hechos" },
                    { v: `${p.years} años`, l: "de experiencia" },
                    { v: `${p.respMin} min`, l: "respuesta media" },
                  ].map((s) => (
                    <div key={s.l} className="bg-tint/60 px-3 py-3.5 text-center">
                      <p className="font-disp font-bold text-xl text-grn">{s.v}</p>
                      <p className="text-[0.62rem] font-bold text-mut uppercase tracking-wide mt-0.5">{s.l}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl bg-grnsoft border border-grn/15 px-4 py-3.5 flex items-center gap-3">
                  <Icon name="timer" className="w-5 h-5 text-grn shrink-0" strokeWidth={2} />
                  <p className="text-sm font-bold text-grn2">
                    Tiempo de llegada habitual: <span className="font-extrabold">~{p.eta} minutos</span> a tu zona
                  </p>
                </div>

                <p className="mt-5 text-[0.95rem] leading-relaxed text-ink2/85">{p.bio}</p>
              </div>
            </div>
          </FadeUp>

          {/* servicios */}
          <FadeUp d={90}>
            <section className="mt-7">
              <h2 className="font-disp font-bold text-lg mb-3">Servicios que ofrece</h2>
              <div className="flex flex-wrap gap-2">
                {p.tagline.split("·").map((s) => (
                  <span key={s} className="rounded-full bg-card border border-edge px-4 py-2 text-sm font-bold">{s.trim()}</span>
                ))}
              </div>
              {jobs.length > 0 && (
                <>
                  <p className="text-[0.65rem] font-extrabold tracking-[0.18em] text-mut2 uppercase mt-5 mb-2.5">Trabajos frecuentes</p>
                  <div className="flex flex-wrap gap-2">
                    {jobs.slice(0, 5).map((j) => (
                      <button key={j} onClick={() => go({ t: "request", proId: p.id })} className="rounded-full bg-tint hover:bg-grnsoft hover:text-grn transition-colors px-3.5 py-2 text-xs font-bold text-mut">
                        {j}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
          </FadeUp>

          {/* portfolio */}
          <FadeUp d={140}>
            <section className="mt-7">
              <h2 className="font-disp font-bold text-lg mb-3">Trabajos anteriores</h2>
              <div className="grid grid-cols-3 gap-2.5">
                {p.portfolio.concat(p.portfolio[0] !== undefined ? [p.portfolio[0]] : []).slice(0, 3).map((img, i) => (
                  <div key={i} className="relative aspect-square rounded-2xl overflow-hidden bg-tint group">
                    <img
                      src={jobUrl(img)}
                      alt={`Trabajo ${i + 1} de ${p.name}`}
                      className="w-[200%] h-[200%] object-cover transition-transform duration-500 group-hover:scale-105"
                      style={{
                        left: img % 2 === 1 ? "-100%" : "0",
                        top: img >= 2 ? "-100%" : "0",
                        position: "absolute",
                      }}
                      onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                    />
                    <span className="absolute bottom-2 left-2 rounded-full bg-ink2/65 text-white text-[0.58rem] font-bold px-2 py-0.5 backdrop-blur-sm">
                      {JOB_IMGS[img].label}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </FadeUp>

          {/* reseñas */}
          <FadeUp d={180}>
            <section className="mt-7">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-disp font-bold text-lg">Reseñas verificadas</h2>
                <span className="text-sm font-bold text-mut">{p.reviews} en total</span>
              </div>
              <div className="space-y-3">
                {p.reviewsList.map((r, i) => (
                  <div key={i} className="card p-4">
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-full bg-tint grid place-items-center font-disp font-bold text-sm text-grn">{r.name[0]}</span>
                      <div className="flex-1">
                        <p className="font-bold text-sm">{r.name}</p>
                        <div className="flex items-center gap-2">
                          <Stars n={r.rating} size="w-3 h-3" />
                          <span className="text-[0.65rem] text-mut2 font-semibold">{r.ago}</span>
                        </div>
                      </div>
                      <span className="text-[0.58rem] font-extrabold text-grn bg-grnsoft rounded-full px-2 py-1">SERVICIO REAL</span>
                    </div>
                    <p className="text-sm text-ink2/80 mt-3 leading-relaxed">“{r.text}”</p>
                  </div>
                ))}
              </div>
            </section>
          </FadeUp>
        </div>

        {/* columna lateral */}
        <aside className="mt-7 lg:mt-0 space-y-4 lg:sticky lg:top-24 self-start">
          <FadeUp d={120}>
            <div className="card p-5">
              <div className="flex items-baseline gap-1.5">
                <p className="font-disp font-bold text-3xl text-grn">{fmt(p.price)}</p>
                <p className="text-xs font-bold text-mut2">/ visita de diagnóstico</p>
              </div>
              <p className="text-xs text-mut mt-1.5">El precio final se acuerda contigo antes de empezar. Sin sorpresas.</p>
              <button onClick={() => go({ t: "request", proId: p.id })} className="btn-prime w-full h-14 mt-4 text-base" disabled={!p.available}>
                <Icon name="bolt" className="w-5 h-5" strokeWidth={2.2} />
                {p.available ? "Solicitar servicio" : "No disponible ahora"}
              </button>
              <button onClick={() => go({ t: "request", proId: p.id })} className="btn-ghost w-full h-12 mt-2.5 text-sm">
                <Icon name="doc" className="w-4 h-4" strokeWidth={2} /> Pedir cotización
              </button>
            </div>
          </FadeUp>

          <FadeUp d={170}>
            <div className="card p-5">
              <p className="text-[0.65rem] font-extrabold tracking-[0.18em] text-mut2 uppercase mb-3">Confianza</p>
              <ul className="space-y-2.5">
                {[
                  { on: p.verified.id, l: "Identidad verificada", d: "Cédula validada" },
                  { on: p.verified.phone, l: "Teléfono verificado", d: "OTP confirmado" },
                  { on: p.verified.pro, l: "Profesional verificado", d: "Entrevista + referencias" },
                ].map((v) => (
                  <li key={v.l} className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full grid place-items-center ${v.on ? "bg-grnsoft text-grn" : "bg-tint text-mut2"}`}>
                      <Icon name={v.on ? "check" : "clock"} className="w-4 h-4" strokeWidth={2.4} />
                    </span>
                    <span className="flex-1">
                      <span className={`block text-sm font-bold ${v.on ? "" : "text-mut"}`}>{v.l}</span>
                      <span className="block text-[0.65rem] text-mut2 font-semibold">{v.d}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeUp>

          <FadeUp d={210}>
            <div className="card p-5">
              <p className="text-[0.65rem] font-extrabold tracking-[0.18em] text-mut2 uppercase mb-3">Zonas que cubre</p>
              <div className="flex flex-wrap gap-2">
                {p.zones.map((z) => (
                  <span key={z} className="inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-1.5 text-xs font-bold text-mut">
                    <Icon name="pin" className="w-3 h-3" strokeWidth={2.2} /> {zoneById(z).name}
                  </span>
                ))}
              </div>
            </div>
          </FadeUp>
        </aside>
      </div>

      {/* CTA móvil fijo */}
      <div className="fixed bottom-20 inset-x-0 z-40 lg:hidden">
        <div className="max-w-md mx-auto px-5">
          <button onClick={() => go({ t: "request", proId: p.id })} disabled={!p.available} className="btn-prime w-full h-14 text-base shadow-xl">
            <Icon name="bolt" className="w-5 h-5" strokeWidth={2.2} />
            {p.available ? "Solicitar servicio" : "No disponible ahora"}
          </button>
        </div>
      </div>
    </div>
  );
}
