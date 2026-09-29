import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/icons";
import {
  Carousel, Face, FadeUp, ProCard, ProListItem, RowHead, Sheet, SkelCards, SkelList, useFakeLoad,
} from "../../components/ui/kit";
import {
  GROUPS, ZONES, catById, prosByCat, searchAll, setRole, setZone, useApp, zoneById, type View, type Cat,
} from "../../lib/state";
import { api } from "../../lib/api";
import { PATHS } from "../../lib/router";

const HOME_CATS = ["plomeria", "electricidad", "aire", "cerrajeria", "limpieza", "mecanica", "pintura", "ebanisteria"];
const GROUP_CAT: Record<string, string> = { Hogar: "plomeria", "Técnicos": "aire", Automotriz: "mecanica", Tecnología: "camaras", Eventos: "fotografia", Construcción: "remodelacion" };
const GROUP_IC: Record<string, string> = { Hogar: "home", "Técnicos": "snow", Automotriz: "car", Tecnología: "radar", Eventos: "camera", Construcción: "hammer" };

/* ─────────────────────────── HOME ─────────────────────────── */
export function ClientHome({ go }: { go: (v: View) => void }) {
  const { zoneId, session } = useApp();
  const nav = useNavigate();
  const [zoneOpen, setZoneOpen] = useState(false);
  const [categories, setCategories] = useState<Cat[]>([]);
  const [availableProviders, setAvailableProviders] = useState<any[]>([]);
  const [topProviders, setTopProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // F2: Cargar categorías y proveedores reales desde el backend
  useEffect(() => {
    const loadData = async () => {
      try {
        setError(null);
        
        // Cargar categorías
        const cats = await api.categories.list();
        setCategories(cats);
        
        // Cargar proveedores disponibles
        const available = await api.providersPublic.getAvailable(8);
        setAvailableProviders(available);
        
        // Cargar top providers (mejor valorados)
        const top = await api.providersPublic.list({ sort: "rating", limit: 4 });
        setTopProviders(top.data);
        
      } catch (err) {
        console.error("Error loading data:", err);
        setError("No se pudieron cargar los datos. Por favor, intenta de nuevo.");
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  const zone = zoneById(zoneId);
  const firstName = (session?.name ?? "María Peralta").split(" ")[0];

  return (
    <div className="pb-8">
      {/* sticky header: location */}
      <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-md border-b border-line2">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center gap-3">
          <button onClick={() => setZoneOpen(true)} className="flex items-center gap-2.5 min-w-0 group" aria-label="Cambiar ubicación">
            <span className="w-9 h-9 rounded-full bg-pinesoft text-pine grid place-items-center shrink-0 group-hover:bg-pine group-hover:text-white transition-colors">
              <Icon name="pin" className="w-4.5 h-4.5" strokeWidth={2.2} />
            </span>
            <span className="text-left min-w-0">
              <span className="block text-[0.6rem] font-bold text-soft uppercase tracking-widest leading-none">Entregar en</span>
              <span className="block text-[0.92rem] font-extrabold text-ink truncate max-w-[11rem] sm:max-w-none leading-tight mt-0.5 group-hover:text-pine transition-colors">
                {zone.name}
              </span>
            </span>
            <Icon name="chevd" className="w-4 h-4 text-soft shrink-0" strokeWidth={2.6} />
          </button>
          <span className="ml-auto font-disp font-bold text-[1.05rem] tracking-tight text-ink hidden sm:block">
            altoque<span className="text-sun">.</span>
          </span>
          <Face face={{ f: 3, q: 3 }} name={session?.name ?? "María Peralta"} size="w-9 h-9" />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-5">
        {/* hero: what do you need */}
        <FadeUp>
          <section className="pt-8 pb-2">
            <p className="text-[0.8rem] font-bold text-mut">Hola, {firstName} 👋</p>
            <h1 className="font-disp font-bold text-[1.9rem] sm:text-[2.3rem] leading-[1.05] tracking-tight text-ink mt-1">
              ¿Qué necesitas <span className="text-pine">hoy</span>?
            </h1>
            <p className="text-mut font-medium text-[0.95rem] mt-2">
              Un profesional verificado, en tu zona, en minutos.
            </p>

            <button
              onClick={() => go({ t: "explore" })}
              className="mt-5 w-full card card-h px-5 h-[3.4rem] flex items-center gap-3.5 text-left group"
              aria-label="Buscar servicios"
            >
              <span className="w-10 h-10 rounded-xl bg-pine text-white grid place-items-center shrink-0 group-hover:scale-105 transition-transform">
                <Icon name="search" className="w-5 h-5" strokeWidth={2.2} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[0.92rem] font-semibold text-soft truncate">
                  Buscar plomero, electricista, limpieza…
                </span>
              </span>
              <Icon name="chevr" className="w-5 h-5 text-soft shrink-0" strokeWidth={2.2} />
            </button>

            {/* quick chips */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar mt-4 -mx-5 px-5 sm:mx-0 sm:px-0">
              {[["Fuga de agua", "plomeria"], ["A/C no enfría", "aire"], ["Puerta trabada", "cerrajeria"], ["Limpieza", "limpieza"]].map(([l, c]) => (
                <button key={l} onClick={() => go({ t: "request", catId: c })} className="chip h-9 px-4 text-[0.78rem] hover:border-pine hover:text-pine">
                  <Icon name="bolt" className="w-3.5 h-3.5 text-sun" strokeWidth={2.4} /> {l}
                </button>
              ))}
            </div>
          </section>
        </FadeUp>

        {/* categorías (servicios populares) */}
        <section className="mt-8">
          <RowHead title="Servicios populares" sub="Elige una categoría para empezar" />
          {loading ? (
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 sm:gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="w-full aspect-square max-w-[4.6rem] rounded-2xl skel" />
                  <div className="skel h-3 w-12" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 sm:gap-4">
              {categories.slice(0, 8).map((c, i) => (
                <FadeUp key={c.id} d={i * 45}>
                  <button onClick={() => go({ t: "results", catId: c.id })} className="w-full flex flex-col items-center gap-2 group">
                    <span className="w-full aspect-square max-w-[4.6rem] rounded-2xl bg-card border border-line2 grid place-items-center shadow-card transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lift group-hover:border-pine/40 group-active:scale-95">
                      <Icon name={c.icon as never} className="w-7 h-7 text-pine" strokeWidth={1.7} />
                    </span>
                    <span className="text-[0.7rem] font-bold text-ink leading-tight text-center">{c.name}</span>
                  </button>
                </FadeUp>
              ))}
            </div>
          )}
        </section>

        {/* disponibles ahora */}
        <section className="mt-10">
          <RowHead
            icon="bolt" title="Disponibles ahora" sub="Listos para ir a tu zona"
            action={{ label: "Ver todos", fn: () => go({ t: "results", catId: "plomeria" }) }}
          />
          {loading ? (
            <SkelCards n={4} />
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-mut">{error}</p>
              <button onClick={() => window.location.reload()} className="btn-ghost h-10 px-5 mt-3 text-[0.85rem]">
                Reintentar
              </button>
            </div>
          ) : availableProviders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-mut">No hay proveedores disponibles en este momento</p>
            </div>
          ) : (
            <Carousel>
              {availableProviders.map((p) => (
                <ProCard 
                  key={p.id} 
                  p={p} 
                  onOpen={() => go({ t: "pro", id: p.id })} 
                  onRequest={() => go({ t: "request", proId: p.id })} 
                />
              ))}
            </Carousel>
          )}
        </section>

        {/* CTA profesional */}
        <FadeUp d={100}>
          <section className="mt-10 rounded-3xl bg-pine text-white relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-sun/15" aria-hidden />
            <div className="absolute right-16 bottom-0 w-24 h-24 rounded-full bg-white/5" aria-hidden />
            <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="flex-1">
                <p className="text-[0.65rem] font-extrabold tracking-[0.22em] text-sun uppercase">¿Eres profesional?</p>
                <h3 className="font-disp font-bold text-[1.45rem] sm:text-[1.7rem] leading-tight mt-2">
                  Empieza a conseguir clientes hoy.
                </h3>
                <p className="text-white/80 text-[0.85rem] font-medium mt-2 max-w-md leading-relaxed">
                  Los primeros 100 verificados reciben <strong className="text-sun">3 meses de plan Pro gratis</strong>.
                </p>
              </div>
              <button
                onClick={() => { setRole("provider"); nav(PATHS.pro); }}
                className="shrink-0 inline-flex items-center justify-center gap-2 bg-sun text-[#33230a] font-extrabold rounded-xl px-6 h-12 hover:bg-sun2 transition-colors active:scale-95"
              >
                Modo profesional <Icon name="arrow" className="w-4.5 h-4.5" strokeWidth={2.4} />
              </button>
            </div>
          </section>
        </FadeUp>

        {/* mejor valorados */}
        <section className="mt-10">
          <RowHead icon="star" title="Mejor valorados" sub={`${zone.name} y alrededores`} />
          {loading ? (
            <SkelList n={4} />
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-mut">{error}</p>
            </div>
          ) : topProviders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-mut">Aún no hay proveedores valorados</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {topProviders.map((p, i) => (
                <ProListItem 
                  key={p.id} 
                  p={p} 
                  delay={i * 70} 
                  onOpen={() => go({ t: "pro", id: p.id })} 
                  onRequest={() => go({ t: "request", proId: p.id })} 
                />
              ))}
            </div>
          )}
        </section>

        {/* grupos */}
        {GROUPS.map((g) => {
          const cats = categories.filter((c) => c.group === g).slice(0, 4);
          if (cats.length === 0) return null;
          return (
            <section key={g} className="mt-10">
              <RowHead
                icon={GROUP_IC[g]} title={g} sub={`Servicios de ${g.toLowerCase()}`}
                action={{ label: "Explorar", fn: () => go({ t: "results", catId: GROUP_CAT[g] }) }}
              />
              <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0 pb-1">
                {cats.map((c) => {
                  const pros = prosByCat(c.id);
                  const best = [...pros].sort((a, b) => b.rating - a.rating)[0];
                  return (
                    <button key={c.id} onClick={() => go({ t: "results", catId: c.id })} className="card card-h shrink-0 w-[13.5rem] p-4 text-left">
                      <div className="flex items-center justify-between">
                        <span className="w-11 h-11 rounded-xl bg-pinesoft text-pine grid place-items-center">
                          <Icon name={c.icon as never} className="w-5.5 h-5.5" strokeWidth={1.8} />
                        </span>
                        {best && <Face face={best.face} name={best.name} size="w-8 h-8" />}
                      </div>
                      <p className="font-disp font-bold text-[0.95rem] mt-3">{c.name}</p>
                      <p className="text-[0.7rem] text-mut font-semibold mt-0.5">
                        {pros.length} pro{pros.length === 1 ? "" : "s"} · desde RD${c.base.toLocaleString()}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1 text-pine text-[0.72rem] font-extrabold">
                        Ver profesionales <Icon name="chevr" className="w-3 h-3" strokeWidth={2.8} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* sheet zonas */}
      <Sheet open={zoneOpen} onClose={() => setZoneOpen(false)} title="¿Dónde estás?">
        <p className="text-[0.8rem] text-mut font-medium -mt-1 mb-4">Santiago de los Caballeros · República Dominicana</p>
        <div className="space-y-2">
          {ZONES.map((z) => (
            <button
              key={z.id}
              onClick={() => { setZone(z.id); setZoneOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all ${zoneId === z.id ? "border-pine bg-pinesoft" : "border-line2 bg-card hover:border-pine/40"}`}
            >
              <Icon name="pin" className={`w-4.5 h-4.5 ${zoneId === z.id ? "text-pine" : "text-soft"}`} strokeWidth={2.1} />
              <span className="flex-1">
                <span className="block font-bold text-[0.9rem] text-ink">{z.name}</span>
                {z.km > 0 && <span className="block text-[0.68rem] text-mut font-semibold">a {z.km} km del centro</span>}
              </span>
              {zoneId === z.id && <Icon name="check" className="w-4.5 h-4.5 text-pine" strokeWidth={2.6} />}
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
  const [categories, setCategories] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const res = searchAll(q);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await api.categories.list();
        setCategories(cats);
      } catch (err) {
        console.error("Error loading categories:", err);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadCategories();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-5 pb-10">
      <header className="pt-4 sticky top-0 z-40 bg-paper/90 backdrop-blur-md pb-3">
        <div className="card px-4 flex items-center gap-3 focus-within:border-pine/50 transition-colors h-[3.2rem]">
          <Icon name="search" className="w-5 h-5 text-pine shrink-0" strokeWidth={2.2} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Busca un servicio o profesional…"
            className="w-full h-full bg-transparent outline-none font-semibold text-ink placeholder:text-soft"
            aria-label="Buscar"
          />
          {q && (
            <button onClick={() => setQ("")} className="w-7 h-7 grid place-items-center rounded-full bg-tint text-mut shrink-0" aria-label="Limpiar">
              <Icon name="x" className="w-3.5 h-3.5" strokeWidth={2.4} />
            </button>
          )}
        </div>
      </header>

      {q ? (
        <div className="mt-2 space-y-6">
          {res.cats.length > 0 && (
            <section>
              <p className="text-[0.68rem] font-extrabold tracking-[0.18em] text-soft uppercase mb-3">Servicios</p>
              <div className="space-y-2">
                {res.cats.map((c) => (
                  <button key={c.id} onClick={() => go({ t: "results", catId: c.id })} className="w-full card card-h px-4 py-3.5 flex items-center gap-3.5 text-left">
                    <span className="w-11 h-11 rounded-xl bg-pinesoft text-pine grid place-items-center shrink-0"><Icon name={c.icon as never} className="w-5 h-5" strokeWidth={1.9} /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold text-ink">{c.name}</span>
                      <span className="block text-[0.72rem] text-mut font-semibold">{c.group} · desde RD${c.base.toLocaleString()}</span>
                    </span>
                    <span className="text-[0.72rem] font-bold text-pine shrink-0">{prosByCat(c.id).length} pros</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {res.pros.length > 0 && (
            <section>
              <p className="text-[0.68rem] font-extrabold tracking-[0.18em] text-soft uppercase mb-3">Profesionales</p>
              <div className="space-y-3">
                {res.pros.map((p) => (
                  <ProListItem key={p.id} p={p} onOpen={() => go({ t: "pro", id: p.id })} onRequest={() => go({ t: "request", proId: p.id })} />
                ))}
              </div>
            </section>
          )}
          {res.cats.length === 0 && res.pros.length === 0 && (
            <div className="text-center py-20">
              <span className="text-5xl">🔍</span>
              <p className="font-disp font-bold text-lg mt-4 text-ink">Sin resultados para “{q}”</p>
              <p className="text-[0.85rem] text-mut font-medium mt-1">Prueba con “plomero”, “aire” o “limpieza”.</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {GROUPS.map((g) => (
            <section key={g} className="mb-9 mt-6">
              <p className="font-disp font-bold text-[1.05rem] text-ink mb-3">{g}</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {categories.filter((c) => c.group === g).map((c) => (
                  <button key={c.id} onClick={() => go({ t: "results", catId: c.id })} className="card card-h p-3.5 flex flex-col items-center gap-2 text-center group">
                    <span className="w-12 h-12 rounded-xl bg-pinesoft text-pine grid place-items-center group-hover:bg-pine group-hover:text-white transition-colors">
                      <Icon name={c.icon as never} className="w-6 h-6" strokeWidth={1.8} />
                    </span>
                    <span className="text-[0.7rem] font-bold text-ink leading-tight">{c.name}</span>
                    <span className="text-[0.62rem] text-soft font-semibold -mt-1">{prosByCat(c.id).length} pros</span>
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
  const loading = useFakeLoad(600);
  const [onlyAvail, setOnlyAvail] = useState(true);
  const [onlyVerif, setOnlyVerif] = useState(false);
  const [sort, setSort] = useState<"rating" | "dist" | "eta">("rating");
  const c = catById(catId);
  let list = prosByCat(catId);
  if (onlyAvail) list = list.filter((p) => p.available);
  if (onlyVerif) list = list.filter((p) => p.verified.pro);
  list = [...list].sort((a, b) => (sort === "rating" ? b.rating - a.rating : sort === "dist" ? a.km - b.km : a.eta - b.eta));

  const chips = (
    <div className="flex gap-2 overflow-x-auto no-scrollbar py-3">
      <button onClick={() => setOnlyAvail(!onlyAvail)} className={`chip h-9 px-4 text-[0.72rem] ${onlyAvail ? "chip-on" : ""}`}>
        <span className="w-2 h-2 rounded-full bg-ok" /> Disponibles
      </button>
      <button onClick={() => setOnlyVerif(!onlyVerif)} className={`chip h-9 px-4 text-[0.72rem] ${onlyVerif ? "chip-on" : ""}`}>
        <Icon name="check" className="w-3 h-3" strokeWidth={3} /> Verificados
      </button>
      {([["rating", "Mejor rating"], ["dist", "Más cercanos"], ["eta", "Llegada rápida"]] as const).map(([k, l]) => (
        <button key={k} onClick={() => setSort(k)} className={`chip h-9 px-4 text-[0.72rem] ${sort === k ? "chip-on" : ""}`}>{l}</button>
      ))}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-5 pb-10">
      <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-md pt-3 pb-1 border-b border-line2">
        <div className="flex items-center gap-3">
          <button onClick={() => go({ t: "home" })} className="w-10 h-10 grid place-items-center rounded-full card shrink-0" aria-label="Volver">
            <Icon name="chevl" className="w-4.5 h-4.5" strokeWidth={2.4} />
          </button>
          <span className="w-11 h-11 rounded-xl bg-pine text-white grid place-items-center shrink-0">
            <Icon name={c.icon as never} className="w-5.5 h-5.5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <h1 className="font-disp font-bold text-[1.15rem] leading-tight text-ink truncate">{c.name}</h1>
            <p className="text-[0.72rem] text-mut font-semibold">{prosByCat(catId).length} profesionales · desde RD${c.base.toLocaleString()}</p>
          </div>
          <button onClick={() => go({ t: "request", catId })} className="ml-auto btn-pine h-11 px-5 text-[0.8rem] shrink-0">
            <Icon name="bolt" className="w-4 h-4" strokeWidth={2.2} /> Pedir ahora
          </button>
        </div>
        <div className="lg:hidden">{chips}</div>
      </header>

      <div className="lg:grid lg:grid-cols-[17rem_1fr] lg:gap-8 mt-2">
        <aside className="hidden lg:block sticky top-32 self-start space-y-5">
          <div className="card p-4 space-y-4">
            <p className="text-[0.68rem] font-extrabold tracking-[0.18em] text-soft uppercase">Filtros</p>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-[0.85rem] font-bold text-ink">Solo disponibles</span>
              <input type="checkbox" checked={onlyAvail} onChange={(e) => setOnlyAvail(e.target.checked)} className="accent-[#0e5c49] w-4.5 h-4.5" />
            </label>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-[0.85rem] font-bold text-ink">Solo verificados</span>
              <input type="checkbox" checked={onlyVerif} onChange={(e) => setOnlyVerif(e.target.checked)} className="accent-[#0e5c49] w-4.5 h-4.5" />
            </label>
            <div>
              <p className="text-[0.85rem] font-bold text-ink mb-2">Ordenar por</p>
              {([["rating", "Mejor calificación"], ["dist", "Menor distancia"], ["eta", "Llegada más rápida"]] as const).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                  <input type="radio" name="sort" checked={sort === k} onChange={() => setSort(k)} className="accent-[#0e5c49]" />
                  <span className="text-[0.8rem] text-mut font-semibold">{l}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="card p-3">
            <MapMini />
          </div>
        </aside>

        <div className="mt-2 lg:mt-6">
          {loading ? <SkelList n={5} /> : list.length === 0 ? (
            <div className="text-center py-24">
              <span className="text-5xl">🧭</span>
              <p className="font-disp font-bold text-lg mt-4 text-ink">Nadie cumple esos filtros ahora</p>
              <p className="text-[0.85rem] text-mut font-medium mt-1 max-w-xs mx-auto">Quita un filtro o crea una solicitud y avisaremos a los pros de tu zona.</p>
              <button onClick={() => go({ t: "request", catId })} className="btn-pine h-12 px-6 mt-5 text-[0.85rem]">Crear solicitud</button>
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

import { MapCard } from "../../components/ui/kit";
function MapMini() {
  return <MapCard label="Santiago de los Caballeros" />;
}
