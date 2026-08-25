import { useState } from "react";
import { Icon } from "../../components/icons";
import { AvailDot, Face, FadeUp, JobPhoto, Stars, Verif } from "../bits";
import { catById, proById, toggleFav, useApp, zoneById, type View } from "../store";

export function ProProfile({ id, go }: { id: string; go: (v: View) => void }) {
  const p = proById(id);
  const { favorites } = useApp();
  const [tab, setTab] = useState<"about" | "reviews" | "portfolio">("about");
  const fav = favorites.includes(p.id);

  return (
    <div className="pb-32">
      {/* header */}
      <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-md border-b border-line2">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center gap-3">
          <button onClick={() => go({ t: "home" })} className="w-10 h-10 grid place-items-center rounded-full card shrink-0" aria-label="Volver">
            <Icon name="chevl" className="w-4.5 h-4.5" strokeWidth={2.4} />
          </button>
          <p className="font-disp font-bold text-[1rem] text-ink truncate">Perfil profesional</p>
          <button
            onClick={() => toggleFav(p.id)}
            className="ml-auto w-10 h-10 grid place-items-center rounded-full card"
            aria-label={fav ? "Quitar de favoritos" : "Guardar en favoritos"}
          >
            <Icon name="heart" className={`w-4.5 h-4.5 ${fav ? "text-cor" : "text-mut"}`} strokeWidth={2} fill={fav ? "currentColor" : "none"} />
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5">
        {/* hero card */}
        <FadeUp>
          <section className="card p-6 mt-5">
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                <Face face={p.face} name={p.name} size="w-24 h-24" />
                {p.available && <span className="absolute bottom-1 right-1"><AvailDot /></span>}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="font-disp font-bold text-[1.5rem] leading-tight text-ink">{p.name}</h1>
                <div className="flex items-center gap-2 flex-wrap mt-1.5">
                  <span className="inline-flex items-center gap-1 text-[0.9rem] font-extrabold text-ink">
                    <span className="text-sun">★</span>{p.rating.toFixed(1)}
                  </span>
                  <span className="text-[0.8rem] text-mut font-semibold">({p.reviews} reseñas)</span>
                  {p.verified.pro && <Verif label="Profesional verificado" />}
                </div>
                <p className="text-[0.82rem] text-mut font-semibold mt-1.5">{p.tagline}</p>
                <div className="flex items-center gap-2 mt-2.5">
                  {p.available ? (
                    <span className="inline-flex items-center gap-1.5 text-[0.72rem] font-bold text-ok bg-oksoft rounded-full px-2.5 py-1">
                      <AvailDot pulse={false} /> Disponible · llega en ~{p.eta} min
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[0.72rem] font-bold text-soft bg-tint rounded-full px-2.5 py-1">
                      <span className="w-2 h-2 rounded-full bg-soft" /> Ocupado ahora
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* stats */}
            <div className="grid grid-cols-3 gap-3 mt-5">
              {[
                { v: p.jobs.toString(), l: "trabajos" },
                { v: `${p.years} años`, l: "experiencia" },
                { v: `~${p.respMin} min`, l: "respuesta" },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl bg-tint px-3 py-3 text-center">
                  <p className="font-disp font-bold text-[1.05rem] text-ink leading-none">{s.v}</p>
                  <p className="text-[0.66rem] text-mut font-bold uppercase tracking-wide mt-1.5">{s.l}</p>
                </div>
              ))}
            </div>
          </section>
        </FadeUp>

        {/* trust row */}
        <FadeUp d={80}>
          <section className="card p-5 mt-4">
            <p className="text-[0.68rem] font-extrabold tracking-[0.18em] text-soft uppercase mb-3">Confianza</p>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { ok: p.verified.id, l: "Identidad verificada" },
                { ok: p.verified.phone, l: "Teléfono verificado" },
                { ok: p.verified.pro, l: "Profesional verificado" },
              ].map((v) => (
                <div key={v.l} className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${v.ok ? "bg-oksoft text-ok" : "bg-tint text-soft"}`}>
                  <span className={`w-5 h-5 rounded-full grid place-items-center shrink-0 ${v.ok ? "bg-ok text-white" : "bg-line text-soft"}`}>
                    <Icon name={v.ok ? "check" : "x"} className="w-2.5 h-2.5" strokeWidth={3.2} />
                  </span>
                  <span className="text-[0.78rem] font-bold">{v.l}</span>
                </div>
              ))}
            </div>
          </section>
        </FadeUp>

        {/* tabs */}
        <div className="flex gap-2 mt-6 border-b border-line2">
          {([["about", "Acerca de"], ["reviews", `Reseñas (${p.reviews})`], ["portfolio", "Portfolio"]] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-1 pb-3 mr-5 text-[0.85rem] font-bold border-b-[3px] -mb-[1px] transition-colors ${tab === k ? "border-pine text-ink" : "border-transparent text-soft hover:text-mut"}`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* tab content */}
        {tab === "about" && (
          <div className="mt-5 space-y-5 animate-fadein">
            <section>
              <p className="font-disp font-bold text-[0.95rem] text-ink mb-2">Sobre mí</p>
              <p className="text-[0.88rem] text-mut font-medium leading-relaxed">{p.bio}</p>
            </section>
            <section>
              <p className="font-disp font-bold text-[0.95rem] text-ink mb-2">Servicios</p>
              <div className="flex flex-wrap gap-2">
                {p.cats.map((c) => (
                  <span key={c} className="chip h-9 px-4 text-[0.76rem] text-ink border-pine/40 bg-pinesoft">
                    <Icon name={catById(c).icon as never} className="w-3.5 h-3.5 text-pine" strokeWidth={2} /> {catById(c).name}
                  </span>
                ))}
              </div>
            </section>
            <section>
              <p className="font-disp font-bold text-[0.95rem] text-ink mb-2">Zonas de trabajo</p>
              <div className="flex flex-wrap gap-2">
                {p.zones.map((z) => (
                  <span key={z} className="chip h-9 px-4 text-[0.76rem]">
                    <Icon name="pin" className="w-3.5 h-3.5 text-pine" strokeWidth={2.2} /> {zoneById(z).name}
                  </span>
                ))}
              </div>
            </section>
            <section className="card p-5 bg-pinesoft border-pine/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] font-extrabold tracking-[0.16em] text-pine uppercase">Tarifa orientativa</p>
                  <p className="font-disp font-bold text-[1.4rem] text-ink mt-1">RD${p.price.toLocaleString()}</p>
                  <p className="text-[0.72rem] text-mut font-semibold">precio base · el final lo acuerdas con el pro</p>
                </div>
                <span className="w-12 h-12 rounded-2xl bg-pine text-white grid place-items-center shrink-0">
                  <Icon name="spark" className="w-6 h-6" strokeWidth={1.8} />
                </span>
              </div>
            </section>
          </div>
        )}

        {tab === "reviews" && (
          <div className="mt-5 space-y-3.5 animate-fadein">
            <div className="card p-5 flex items-center gap-5">
              <div className="text-center">
                <p className="font-disp font-bold text-[2.2rem] text-ink leading-none">{p.rating.toFixed(1)}</p>
                <Stars n={p.rating} />
                <p className="text-[0.7rem] text-mut font-bold mt-1">{p.reviews} reseñas</p>
              </div>
              <div className="flex-1 space-y-1.5">
                {[5, 4, 3, 2, 1].map((r) => {
                  const pct = r === 5 ? 78 : r === 4 ? 16 : r === 3 ? 4 : r === 2 ? 1 : 1;
                  return (
                    <div key={r} className="flex items-center gap-2">
                      <span className="text-[0.68rem] font-bold text-mut w-3">{r}</span>
                      <Icon name="star" className="w-3 h-3 text-sun" fill="currentColor" strokeWidth={0} />
                      <div className="flex-1 h-1.5 rounded-full bg-tint overflow-hidden">
                        <div className="h-full rounded-full bg-sun" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {p.reviewsList.map((r, i) => (
              <FadeUp key={i} d={i * 70}>
                <div className="card p-5">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-pinesoft text-pine grid place-items-center font-disp font-bold text-[0.75rem]">
                      {r.name.split(" ").map((w) => w[0]).join("")}
                    </span>
                    <div className="flex-1">
                      <p className="text-[0.85rem] font-extrabold text-ink">{r.name}</p>
                      <p className="text-[0.66rem] text-soft font-bold">{r.ago}</p>
                    </div>
                    <Stars n={r.rating} />
                  </div>
                  <p className="text-[0.85rem] text-mut font-medium leading-relaxed mt-3">{r.text}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        )}

        {tab === "portfolio" && (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3 animate-fadein">
            {p.portfolio.map((img, i) => (
              <FadeUp key={i} d={i * 70}>
                <div className="rounded-2xl overflow-hidden aspect-square bg-tint">
                  <JobPhoto i={img} />
                </div>
              </FadeUp>
            ))}
          </div>
        )}
      </div>

      {/* sticky CTA */}
      <div className="fixed bottom-0 inset-x-0 z-50 pb-[max(5.4rem,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-paper via-paper/90 to-transparent pointer-events-none">
        <div className="max-w-3xl mx-auto px-5 pointer-events-auto">
          <button
            onClick={() => go({ t: "request", proId: p.id })}
            disabled={!p.available}
            className="btn-pine w-full h-14 text-[0.95rem] disabled:opacity-40 disabled:shadow-none"
          >
            <Icon name="bolt" className="w-5 h-5" strokeWidth={2.2} />
            {p.available ? "Solicitar servicio" : "No disponible ahora"}
          </button>
        </div>
      </div>
    </div>
  );
}
