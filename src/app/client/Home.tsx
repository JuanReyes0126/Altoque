import { useEffect, useState } from "react";
import { Icon } from "../../components/icons";
import {
  AvailDot, Carousel, Face, FadeUp, ProCard, ProListItem, RowHead, Sheet, SkelCards, SkelList, Stars, useFakeLoad, Verif,
} from "../bits";
import {
  CATS, GROUPS, PROS, PROBLEMS, TICKER, ZONES, catById, prosByCat, searchAll, setRole, setZone, useApp, zoneById, type View,
} from "../store";

const HOME_CATS = ["plomeria", "electricidad", "aire", "cerrajeria", "limpieza", "mecanica", "ebanisteria", "pintura", "remodelacion", "fotografia"];
const GROUP_CAT: Record<string, string> = { Hogar: "plomeria", "Técnicos": "aire", Automotriz: "mecanica", Tecnología: "camaras", Eventos: "fotografia", Construcción: "remodelacion" };
const GROUP_EMOJI: Record<string, string> = { Hogar: "🏠", "Técnicos": "❄️", Automotriz: "🚗", Tecnología: "💻", Eventos: "🎉", Construcción: "🏗️" };

/* ─────────────────────────── HOME ─────────────────────────── */
export function ClientHome({ go }: { go: (v: View) => void }) {
  const { zoneId } = useApp();
  const [zoneOpen, setZoneOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const loading = useFakeLoad(850);

  useEffect(() => { const t = setInterval(() => setTick((v) => (v + 1) % TICKER.length), 3200); return () => clearInterval(t); }, []);

  const available = PROS.filter((p) => p.available);
  const top = [...PROS].sort((a, b) => b.rating - a.rating || b.reviews - a.reviews).slice(0, 4);

  return (
    <div className="pb-8">
      {/* header */}
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur-md border-b border-edge2">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-3">
          <button onClick={() => setZoneOpen(true)} className="flex items-center gap-1.5 min-w-0 group" aria-label="Cambiar ubicación">
            <span className="w-8 h-8 rounded-full bg-grnsoft text-grn grid place-items-center shrink-0">
              <Icon name="pin" className="w-4 h-4" strokeWidth={2.2} />
            </span>
            <span className="text-left min-w-0">
              <span className="block text-[0.6rem] font-bold text-mut2 uppercase tracking-wider">Entregar en</span>
              <span className="block text-sm font-extrabold truncate max-w-[9.5rem] sm:max-w-none group-hover:text-grn transition-colors">
                {zoneById(zoneId).name}
              </span>
            </span>
            <Icon name="chevd" className="w-3.5 h-3.5 text-mut2 shrink-0" strokeWidth={2.4} />
          </button>
          <span className="ml-auto flex items-center gap-2">
            <span className="hidden sm:flex font-disp font-bold text-lg tracking-tight">altoque<span className="text-fire">.</span></span>
            <button className="relative w-9 h-9 grid place-items-center rounded-full card" aria-label="Notificaciones">
              <Icon name="bell" className="w-4.5 h-4.5 text-mut" strokeWidth={2} />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-fire" />
            </button>
            <Face face={{ f: 3, q: 3 }} name="María Peralta" size="w-9 h-9" />
          </span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-5">
        {/* ticker */}
        <div className="mt-4 overflow-hidden rounded-full bg-card border border-edge2 px-4 h-9 flex items-center gap-2.5">
          <span className="relative flex w-2 h-2 shrink-0">
            <span className="absolute inset-0 rounded-full bg-grn animate-ping opacity-60 motion-reduce:hidden" />
            <span className="relative w-2 h-2 rounded-full bg-grn" />
          </span>
          <p key={tick} className="text-xs font-semibold text-mut truncate animate-fadein">{TICKER[tick]}</p>
          <span className="ml-auto text-[0.6rem] font-extrabold text-grn bg-grnsoft rounded-full px-2 py-0.5 shrink-0">EN VIVO</span>
        </div>

        {/* buscador */}
        <FadeUp>
          <button
            onClick={() => go({ t: "explore" })}
            className="mt-5 w-full card card-h px-5 py-4.5 flex items-center gap-3.5 text-left group"
            aria-label="Buscar servicios"
          >
            <span className="w-11 h-11 rounded-2xl bg-grn text-white grid place-items-center shrink-0 group-hover:scale-105 transition-transform">
              <Icon name="search" className="w-5 h-5" strokeWidth={2.2} />
            </span>
            <span className="min-w-0">
              <span className="block font-disp font-bold text-lg leading-tight">¿Qué necesitas hoy?</span>
              <span className="block text-sm text-mut2 truncate">Plomero, aire acondicionado, limpieza…</span>
            </span>
            <Icon name="chevr" className="w-5 h-5 text-mut2 ml-auto shrink-0" strokeWidth={2.2} />
          </button>
        </FadeUp>

        {/* categorías */}
        <FadeUp d={80}>
          <div className="mt-7">
            <RowHead title="Categorías" sub="Elige y encuentra profesionales al instante" />
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-5 lg:grid-cols-10 sm:gap-3">
              {HOME_CATS.map((id, i) => {
                const c = catById(id);
                return (
                  <button
                    key={id}
                    onClick={() => go({ t: "results", catId: id })}
                    className="flex flex-col items-center gap-2 w-[4.6rem] sm:w-auto shrink-0 group"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <span className="w-16 h-16 rounded-[1.4rem] bg-card border border-edge2 grid place-items-center shadow-sm transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-md group-hover:border-grn/40 group-active:scale-95">
                      <Icon name={c.icon as never} className="w-7 h-7 text-grn" strokeWidth={1.8} />
                    </span>
                    <span className="text-[0.68rem] font-bold text-ink2 leading-tight text-center">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </FadeUp>

        {/* disponibles ahora */}
        <section className="mt-9">
          <RowHead
            icon="bolt" title="Disponibles ahora" sub="Profesionales listos para ir a tu zona"
            action={{ label: "Ver todos", fn: () => go({ t: "results", catId: "plomeria" }) }}
          />
          {loading ? <SkelCards n={4} /> : (
            <Carousel>
              {available.slice(0, 8).map((p) => (
                <ProCard key={p.id} p={p} onOpen={() => go({ t: "pro", id: p.id })} onRequest={() => go({ t: "request", proId: p.id })} />
              ))}
            </Carousel>
          )}
        </section>

        {/* CTA profesional */}
        <FadeUp d={100}>
          <section className="mt-10 rounded-3xl bg-grn text-white relative overflow-hidden">
            <div className="absolute inset-0 mapgrid-dark opacity-40" aria-hidden />
            <div className="absolute -right-8 -top-8 w-44 h-44 rounded-full bg-sun/15" aria-hidden />
            <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="flex-1">
                <p className="text-[0.65rem] font-extrabold tracking-[0.22em] text-sun uppercase">¿Eres profesional?</p>
                <h3 className="font-disp font-bold text-2xl sm:text-[1.7rem] leading-tight mt-2">
                  Empieza a conseguir clientes hoy mismo.
                </h3>
                <p className="text-white/75 text-sm mt-2 max-w-md">
                  Los primeros 100 verificados reciben <strong className="text-sun">3 meses de plan Pro gratis</strong>. Sin mensualidades hasta entonces.
                </p>
              </div>
              <button
                onClick={() => setRole("pro")}
                className="shrink-0 inline-flex items-center justify-center gap-2 bg-sun text-ink2 font-extrabold rounded-full px-6 h-13 hover:bg-white transition-colors active:scale-95 py-3.5"
              >
                Modo profesional <Icon name="arrow" className="w-4.5 h-4.5" strokeWidth={2.4} />
              </button>
            </div>
          </section>
        </FadeUp>

        {/* mejor valorados */}
        <section className="mt-10">
          <RowHead icon="star" title="Mejor valorados cerca de ti" sub={zoneById(zoneId).name + " y alrededores"} />
          {loading ? <SkelList n={4} /> : (
            <div className="grid md:grid-cols-2 gap-4">
              {top.map((p, i) => (
                <ProListItem key={p.id} p={p} delay={i * 70} onOpen={() => go({ t: "pro", id: p.id })} onRequest={() => go({ t: "request", proId: p.id })} />
              ))}
            </div>
          )}
        </section>

        {/* populares */}
        <section className="mt-10">
          <RowHead icon="bolt" title="Servicios populares" sub="Lo que más se pide esta semana en Santiago" />
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0 pb-1">
            {["plomeria", "aire", "limpieza", "camaras", "pintura", "mecanica", "grua"].map((id, i) => {
              const c = catById(id);
              return (
                <button
                  key={id}
                  onClick={() => go({ t: "results", catId: id })}
                  className="card card-h shrink-0 px-4 py-3 flex items-center gap-3 text-left"
                >
                  <span className="w-10 h-10 rounded-xl bg-sunsoft text-[#8a5a00] grid place-items-center">
                    <Icon name={c.icon as never} className="w-5 h-5" strokeWidth={1.9} />
                  </span>
                  <span>
                    <span className="block font-bold text-sm">{c.name}</span>
                    <span className="block text-[0.68rem] text-mut font-semibold">desde RD${c.base.toLocaleString()}</span>
                  </span>
                  <Icon name="chevr" className="w-4 h-4 text-mut2 ml-2" strokeWidth={2.4} />
                </button>
              );
            })}
          </div>
        </section>

        {/* grupos */}
        {GROUPS.filter((g) => g !== "Hogar").slice(0, 4).concat(["Hogar"]).map((g) => {
          const cats = CATS.filter((c) => c.group === g).slice(0, 4);
          return (
            <section key={g} className="mt-10">
              <RowHead
                title={`${GROUP_EMOJI[g] ?? ""} ${g}`} sub={`${cats.length}+ servicios en ${g.toLowerCase()}`}
                action={{ label: "Explorar", fn: () => go({ t: "results", catId: GROUP_CAT[g] }) }}
              />
              <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0 pb-1">
                {cats.map((c) => {
                  const pros = prosByCat(c.id);
                  const best = [...pros].sort((a, b) => b.rating - a.rating)[0];
                  return (
                    <button key={c.id} onClick={() => go({ t: "results", catId: c.id })} className="card card-h shrink-0 w-[13.5rem] p-4 text-left">
                      <div className="flex items-center justify-between">
                        <span className="w-11 h-11 rounded-2xl bg-tint text-grn grid place-items-center">
                          <Icon name={c.icon as never} className="w-5.5 h-5.5" strokeWidth={1.8} />
                        </span>
                        {best && <Face face={best.face} name={best.name} size="w-8 h-8" />}
                      </div>
                      <p className="font-disp font-bold mt-3">{c.name}</p>
                      <p className="text-xs text-mut font-semibold mt-0.5">
                        {pros.length} pro{pros.length === 1 ? "" : "s"} · desde RD${c.base.toLocaleString()}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1 text-grn text-xs font-extrabold">
                        Ver profesionales <Icon name="chevr" className="w-3 h-3" strokeWidth={2.6} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* sheet de zonas */}
      <Sheet open={zoneOpen} onClose={() => setZoneOpen(false)} title="¿Dónde estás?">
        <p className="text-sm text-mut -mt-1 mb-4">Santiago de los Caballeros · República Dominicana</p>
        <div className="space-y-2">
          {ZONES.map((z) => (
            <button
              key={z.id}
              onClick={() => { setZone(z.id); setZoneOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all ${zoneId === z.id ? "border-grn bg-grnsoft" : "border-edge2 bg-card hover:border-grn/40"}`}
            >
              <Icon name="pin" className={`w-4.5 h-4.5 ${zoneId === z.id ? "text-grn" : "text-mut2"}`} strokeWidth={2.1} />
              <span className="flex-1">
                <span className="block font-bold text-sm">{z.name}</span>
                {z.km > 0 && <span className="block text-[0.65rem] text-mut font-semibold">a {z.km} km del centro</span>}
              </span>
              {zoneId === z.id && <Icon name="check" className="w-4.5 h-4.5 text-grn" strokeWidth={2.6} />}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

/* ─────────────────────────── EXPLORAR ─────────────────────────── */
export function ExploreView({ go }: { go: (v: View) => void }) {
  const [q, setQ] = useState("");
  const res = searchAll(q);
  return (
    <div className="max-w-6xl mx-auto px-5 pb-10">
      <header className="pt-5 sticky top-0 z-40 bg-bg/90 backdrop-blur-md pb-3">
        <div className="card px-4 py-1 flex items-center gap-3 focus-within:border-grn/50 transition-colors">
          <Icon name="search" className="w-5 h-5 text-grn shrink-0" strokeWidth={2.2} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Busca un servicio o profesional…"
            className="w-full h-13 bg-transparent outline-none font-semibold placeholder:text-mut2"
            aria-label="Buscar"
          />
          {q && (
            <button onClick={() => setQ("")} className="w-7 h-7 grid place-items-center rounded-full bg-tint text-mut" aria-label="Limpiar">
              <Icon name="x" className="w-3.5 h-3.5" strokeWidth={2.4} />
            </button>
          )}
        </div>
      </header>

      {q ? (
        <div className="mt-4 space-y-6">
          {res.cats.length > 0 && (
            <section>
              <p className="text-[0.65rem] font-extrabold tracking-[0.18em] text-mut2 uppercase mb-3">Servicios</p>
              <div className="space-y-2">
                {res.cats.map((c) => (
                  <button key={c.id} onClick={() => go({ t: "results", catId: c.id })} className="w-full card card-h px-4 py-3.5 flex items-center gap-3.5 text-left">
                    <span className="w-11 h-11 rounded-xl bg-grnsoft text-grn grid place-items-center"><Icon name={c.icon as never} className="w-5 h-5" strokeWidth={1.9} /></span>
                    <span className="flex-1">
                      <span className="block font-bold">{c.name}</span>
                      <span className="block text-xs text-mut font-semibold">{c.group} · desde RD${c.base.toLocaleString()}</span>
                    </span>
                    <span className="text-xs font-bold text-grn">{prosByCat(c.id).length} pros</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {res.pros.length > 0 && (
            <section>
              <p className="text-[0.65rem] font-extrabold tracking-[0.18em] text-mut2 uppercase mb-3">Profesionales</p>
              <div className="space-y-3">
                {res.pros.map((p) => (
                  <ProListItem key={p.id} p={p} onOpen={() => go({ t: "pro", id: p.id })} onRequest={() => go({ t: "request", proId: p.id })} />
                ))}
              </div>
            </section>
          )}
          {res.cats.length === 0 && res.pros.length === 0 && (
            <div className="text-center py-16">
              <span className="text-4xl">🔍</span>
              <p className="font-disp font-bold mt-3">Sin resultados para “{q}”</p>
              <p className="text-sm text-mut mt-1">Prueba con “plomero”, “aire” o “limpieza”.</p>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto no-scrollbar mt-1 mb-6">
            {["Fuga de agua", "A/C no enfría", "Limpieza profunda", "Puerta trabada", "Cámaras"].map((s) => (
              <button key={s} onClick={() => setQ(s.split(" ")[0])} className="shrink-0 rounded-full border border-edge bg-card px-4 py-2 text-xs font-bold text-mut hover:border-grn/50 hover:text-grn transition-colors">
                {s}
              </button>
            ))}
          </div>
          {GROUPS.map((g) => (
            <section key={g} className="mb-8">
              <p className="font-disp font-bold text-lg mb-3">{GROUP_EMOJI[g] ?? ""} {g}</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {CATS.filter((c) => c.group === g).map((c) => (
                  <button key={c.id} onClick={() => go({ t: "results", catId: c.id })} className="card card-h p-3.5 flex flex-col items-center gap-2 text-center group">
                    <span className="w-12 h-12 rounded-2xl bg-tint text-grn grid place-items-center group-hover:bg-grnsoft transition-colors">
                      <Icon name={c.icon as never} className="w-6 h-6" strokeWidth={1.8} />
                    </span>
                    <span className="text-[0.7rem] font-bold leading-tight">{c.name}</span>
                    <span className="text-[0.6rem] text-mut2 font-semibold -mt-1">{prosByCat(c.id).length} pros</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

/* ─────────────────────────── RESULTADOS ─────────────────────────── */
export function ResultsView({ catId, go }: { catId: string; go: (v: View) => void }) {
  const loading = useFakeLoad(650);
  const [onlyAvail, setOnlyAvail] = useState(true);
  const [onlyVerif, setOnlyVerif] = useState(false);
  const [sort, setSort] = useState<"rating" | "dist" | "eta">("rating");
  const c = catById(catId);
  let list = prosByCat(catId);
  if (onlyAvail) list = list.filter((p) => p.available);
  if (onlyVerif) list = list.filter((p) => p.verified.pro);
  list = [...list].sort((a, b) => (sort === "rating" ? b.rating - a.rating : sort === "dist" ? a.km - b.km : a.eta - b.eta));

  const FilterChips = (
    <div className="flex gap-2 overflow-x-auto no-scrollbar py-3">
      <button onClick={() => setOnlyAvail(!onlyAvail)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-extrabold transition-all ${onlyAvail ? "chip-on" : "border-edge bg-card text-mut"}`}>
        🟢 Disponibles ahora
      </button>
      <button onClick={() => setOnlyVerif(!onlyVerif)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-extrabold transition-all ${onlyVerif ? "chip-on" : "border-edge bg-card text-mut"}`}>
        ✓ Verificados
      </button>
      {([["rating", "★ Mejor rating"], ["dist", "📍 Más cercanos"], ["eta", "⚡ Llegada rápida"]] as const).map(([k, l]) => (
        <button key={k} onClick={() => setSort(k)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-extrabold transition-all ${sort === k ? "chip-on" : "border-edge bg-card text-mut"}`}>
          {l}
        </button>
      ))}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-5 pb-10">
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur-md pt-4 pb-1 border-b border-edge2">
        <div className="flex items-center gap-3">
          <button onClick={() => go({ t: "home" })} className="w-10 h-10 grid place-items-center rounded-full card shrink-0" aria-label="Volver">
            <Icon name="chevl" className="w-4.5 h-4.5" strokeWidth={2.4} />
          </button>
          <span className="w-11 h-11 rounded-2xl bg-grn text-white grid place-items-center shrink-0">
            <Icon name={c.icon as never} className="w-5.5 h-5.5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <h1 className="font-disp font-bold text-xl leading-tight truncate">{c.name}</h1>
            <p className="text-xs text-mut font-semibold">{prosByCat(catId).length} profesionales en Santiago · visita desde RD${c.base.toLocaleString()}</p>
          </div>
          <button
            onClick={() => go({ t: "request", catId })}
            className="ml-auto btn-prime h-11 px-5 text-sm shrink-0"
          >
            <Icon name="bolt" className="w-4 h-4" strokeWidth={2.2} /> Pedir ahora
          </button>
        </div>
        <div className="lg:hidden">{FilterChips}</div>
      </header>

      <div className="lg:grid lg:grid-cols-[17rem_1fr] lg:gap-8 mt-2">
        {/* sidebar desktop */}
        <aside className="hidden lg:block sticky top-32 self-start space-y-5">
          <div className="card p-4 space-y-3">
            <p className="text-[0.65rem] font-extrabold tracking-[0.18em] text-mut2 uppercase">Filtros</p>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm font-bold">Solo disponibles</span>
              <input type="checkbox" checked={onlyAvail} onChange={(e) => setOnlyAvail(e.target.checked)} className="accent-[#0c5f46] w-4.5 h-4.5" />
            </label>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm font-bold">Solo verificados</span>
              <input type="checkbox" checked={onlyVerif} onChange={(e) => setOnlyVerif(e.target.checked)} className="accent-[#0c5f46] w-4.5 h-4.5" />
            </label>
            <div>
              <p className="text-sm font-bold mb-2">Ordenar por</p>
              {([["rating", "Mejor calificación"], ["dist", "Menor distancia"], ["eta", "Llegada más rápida"]] as const).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                  <input type="radio" name="sort" checked={sort === k} onChange={() => setSort(k)} className="accent-[#0c5f46]" />
                  <span className="text-sm text-mut font-semibold">{l}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="card p-3">
            <MapCardMini zoneId="cerros" />
          </div>
        </aside>

        {/* listado */}
        <div className="mt-2 lg:mt-6">
          {loading ? <SkelList n={5} /> : list.length === 0 ? (
            <div className="text-center py-20">
              <span className="text-5xl">🧭</span>
              <p className="font-disp font-bold text-lg mt-4">Nadie cumple esos filtros ahora</p>
              <p className="text-sm text-mut mt-1 max-w-xs mx-auto">Prueba quitando “Disponibles ahora” o crea una solicitud y avisaremos a los pros de la zona.</p>
              <button onClick={() => go({ t: "request", catId })} className="btn-prime h-12 px-6 mt-5 text-sm">Crear solicitud</button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {list.map((p, i) => (
                <ProListItem key={p.id} p={p} delay={i * 60} onOpen={() => go({ t: "pro", id: p.id })} onRequest={() => go({ t: "request", proId: p.id })} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { MapCard } from "../bits";
function MapCardMini({ zoneId }: { zoneId: string }) {
  return <MapCard zoneId={zoneId} h="h-44" label="Santiago de los Caballeros" />;
}

/* re-export para comodidad */
export { Verif, Stars, AvailDot, Face };
