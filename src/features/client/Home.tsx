import { useEffect, useState } from "react";
import { Icon } from "../../components/icons";
import { api, type CatalogCategory, type PublicProvider } from "../../lib/api";
import { useApp, type View } from "../../lib/state";
import { EmptyState, ErrorState, LoadingState, PageIntro } from "../../components/ui/feedback";

export function ProviderAvatar({ provider }: { provider: PublicProvider }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [provider.image]);
  const initials = provider.name.trim().split(/\s+/).slice(0, 2).map((word) => word.charAt(0)).join("").toLocaleUpperCase("es");
  return <span className="w-14 h-14 rounded-2xl bg-pinesoft text-pine font-disp font-bold text-lg grid place-items-center shrink-0 overflow-hidden" aria-hidden="true">
    {provider.image && !failed ? <img src={provider.image} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : initials || <Icon name="user" />}
  </span>;
}

export function PublicProviderCard({ provider, onOpen, onRequest }: { provider: PublicProvider; onOpen: () => void; onRequest: () => void }) {
  return (
    <article className="card card-h client-profile-card">
      <div className="flex gap-3.5 items-start"><ProviderAvatar provider={provider} /><div className="min-w-0">
        <h2 className="font-disp font-bold text-lg break-words leading-tight">{provider.name}</h2>
        {provider.business_name && <p className="text-sm text-mut mt-1 break-words">{provider.business_name}</p>}
        <p className="text-xs font-semibold text-pine mt-2 flex items-center gap-1"><Icon name="badge" className="w-3.5 h-3.5" />Perfil aprobado</p>
      </div></div>
      <p className="text-sm text-mut mt-2">{provider.categories.map((category) => category.name).join(" · ") || "Servicios profesionales"}</p>
      <p className="text-xs text-mut mt-3 break-words flex items-start gap-1.5"><Icon name="pin" className="w-3.5 h-3.5 shrink-0" />{provider.zones.map((zone) => zone.name).join(" · ") || "Consulta la cobertura en el perfil"}</p>
      <p className="text-sm mt-3">{provider.reviews_count > 0 ? `${provider.rating.toFixed(1)} ★ · ${provider.reviews_count} reseñas` : "Aún sin reseñas"}</p>
      {typeof provider.is_available === "boolean" && <p className={`ui-pill self-start mt-3 ${provider.is_available ? "bg-oksoft text-ok" : ""}`}><span className={`w-2 h-2 rounded-full ${provider.is_available ? "bg-ok" : "bg-soft"}`} aria-hidden="true" />{provider.is_available ? "Disponible" : "Fuera de línea"}</p>}
      <div className="ui-action-row">
        <button onClick={onOpen} className="btn-ghost px-4 min-h-11 text-sm">Ver perfil</button>
        <button onClick={onRequest} className="btn-pine px-4 min-h-11 text-sm">Solicitar servicio</button>
      </div>
    </article>
  );
}

export function CatalogState({ loading, error, empty, onRetry, children }: { loading: boolean; error: string; empty: boolean; onRetry: () => void; children: React.ReactNode }) {
  if (loading) return <LoadingState label="Cargando servicios…" />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (empty) return <EmptyState title="No hay resultados disponibles por ahora." description="Puedes volver a consultar más adelante. La disponibilidad depende del servicio y la zona." />;
  return <>{children}</>;
}

export function ClientHome({ go }: { go: (view: View) => void }) {
  const { session } = useApp();
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [providers, setProviders] = useState<PublicProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError("");
    Promise.all([api.categories.list(), api.providersPublic.getAvailable(8)])
      .then(([catalog, available]) => { if (alive) { setCategories(catalog); setProviders(available); } })
      .catch(() => { if (alive) setError("No pudimos cargar los servicios. Inténtalo de nuevo."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reload]);
  return (
    <main className="max-w-6xl mx-auto px-5 pt-6 sm:pt-8 pb-10 animate-fadein">
      <section data-theme="dark" className="client-hero flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="max-w-xl"><p className="text-white/80 text-sm font-semibold">Hola, {session?.name.split(" ")[0] || "bienvenido"}</p>
          <h1 className="font-disp font-bold text-3xl sm:text-4xl tracking-tight mt-3 leading-tight">¿Qué necesitas hoy?</h1>
          <p className="text-white/80 text-sm sm:text-base leading-relaxed mt-3">Un arreglo pendiente, un proyecto nuevo. Encuentra el servicio y crea tu solicitud para tu zona.</p>
          <div className="ui-action-row mt-6"><button onClick={() => go({ t: "explore" })} className="btn-sun min-h-12 px-5 text-sm"><Icon name="search" className="w-4 h-4" />Explorar servicios</button><button onClick={() => go({ t: "request" })} className="min-h-12 px-4 rounded-xl border border-white/30 hover:bg-white/10 font-bold text-sm">Nueva solicitud<Icon name="plus" className="inline w-4 h-4 ml-2" /></button></div>
        </div>
        <div className="grid gap-3 md:w-64 shrink-0">{[{ icon: "search", title: "Elige un servicio" }, { icon: "pin", title: "Indica tu zona" }, { icon: "clip", title: "Sigue tu solicitud" }].map((step) => <div key={step.title} className="flex items-center gap-3 rounded-2xl bg-white/10 border border-white/10 p-3"><span className="w-9 h-9 rounded-xl bg-white/10 grid place-items-center"><Icon name={step.icon as never} className="w-4 h-4" /></span><span className="text-sm font-semibold">{step.title}</span></div>)}</div>
      </section>
      <CatalogState loading={loading} error={error} empty={categories.length === 0} onRetry={() => setReload((value) => value + 1)}>
        <div className="ui-section flex items-end justify-between gap-3"><div><p className="ui-eyebrow mb-2">Todo empieza aquí</p><h2 className="ui-section-title">Servicios</h2></div><span className="text-xs text-mut">Catálogo actual</span></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mt-4">
          {categories.map((category) => <button key={category.id} onClick={() => go({ t: "results", catId: category.id })} className="card card-h client-category"><span className="ui-icon-tile"><Icon name={category.icon as never} className="w-6 h-6" /></span><span className="block font-disp font-bold mt-4 leading-snug">{category.name}</span><span className="mt-2 text-xs text-mut">{category.group_name}</span></button>)}
        </div>
      </CatalogState>
      {!loading && !error && <>
        <div className="ui-section"><p className="ui-eyebrow mb-2">Consulta el directorio</p><h2 className="ui-section-title">Disponibles ahora</h2><p className="text-sm text-mut mt-2">La disponibilidad puede cambiar. La asignación se confirma cuando un profesional acepta.</p></div>
        {providers.length === 0 ? <EmptyState icon="wrench" title="No hay profesionales en línea por ahora" description="Puedes crear una solicitud para tu zona. Las solicitudes compatibles aparecerán en el panel de los profesionales habilitados." action={<button onClick={() => go({ t: "request" })} className="btn-pine min-h-11 px-5 text-sm">Crear solicitud</button>} /> : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">{providers.map((provider) => <PublicProviderCard key={provider.id} provider={provider} onOpen={() => go({ t: "pro", id: provider.id })} onRequest={() => go({ t: "request", proId: provider.id })} />)}</div>}
      </>}
    </main>
  );
}

export function ExploreView({ go }: { go: (view: View) => void }) {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError("");
    api.categories.list().then((catalog) => { if (alive) setCategories(catalog); })
      .catch(() => { if (alive) setError("No pudimos cargar las categorías."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reload]);
  const filtered = categories.filter((category) => `${category.name} ${category.group_name}`.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es")));
  return <main className="max-w-4xl mx-auto px-5 py-6 sm:py-8 animate-fadein"><PageIntro eyebrow="El servicio que buscas" title="Explorar servicios" description="Encuentra una categoría, consulta perfiles o crea una solicitud para tu zona." />
    <label htmlFor="catalog-search" className="block text-sm font-bold">Buscar categoría</label><div className="relative mt-2"><Icon name="search" className="absolute left-4 top-4 w-5 h-5 text-pine" /><input id="catalog-search" type="search" placeholder="Nombre del servicio o categoría" value={query} onChange={(event) => setQuery(event.target.value)} className="w-full card p-4 pl-12" /></div>
    <CatalogState loading={loading} error={error} empty={filtered.length === 0} onRetry={() => setReload((value) => value + 1)}><div className="grid sm:grid-cols-2 gap-3 mt-5">{filtered.map((category) => <button key={category.id} onClick={() => go({ t: "results", catId: category.id })} className="card card-h p-5 text-left flex items-center gap-4"><span className="ui-icon-tile"><Icon name={category.icon as never} /></span><span className="min-w-0 flex-1"><span className="font-bold">{category.name}</span><span className="block text-sm text-mut mt-1">{category.group_name}</span></span><Icon name="chevr" className="w-4 h-4 text-soft shrink-0" /></button>)}</div></CatalogState>
  </main>;
}

export function ResultsView({ catId, go }: { catId: string; go: (view: View) => void }) {
  const [category, setCategory] = useState<CatalogCategory | undefined>();
  const [providers, setProviders] = useState<PublicProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [available, setAvailable] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    let clamped = false;
    setLoading(true); setError("");
    Promise.all([api.categories.list(), api.providersPublic.list({ category: catId, ...(available ? { available: true } : {}), page, limit: 20 })])
      .then(([catalog, result]) => {
        if (!alive) return;
        const meta = result?.meta;
        if (!Array.isArray(result?.data) || !meta ||
          ![meta.page, meta.limit, meta.pages, meta.total].every(Number.isSafeInteger) ||
          meta.page !== page || meta.limit !== 20 || meta.total < 0 ||
          meta.pages !== Math.max(1, Math.ceil(meta.total / 20)) ||
          result.data.length > Math.max(0, Math.min(20, meta.total - (page - 1) * 20))) {
          throw new Error("INVALID_PROVIDER_PAGE");
        }
        setCategory(catalog.find((item) => item.id === catId));
        setPages(meta.pages);
        if (page > meta.pages) {
          clamped = true;
          setPage(meta.pages);
          return;
        }
        setProviders(result.data);
      })
      .catch(() => { if (alive) setError("No pudimos cargar los profesionales."); })
      .finally(() => { if (alive && !clamped) setLoading(false); });
    return () => { alive = false; };
  }, [catId, available, page, reload]);
  return <main className="max-w-4xl mx-auto px-5 py-6">
    <button onClick={() => go({ t: "explore" })} className="btn-ghost h-11 px-4">Volver a servicios</button>
    <div className="mt-6"><PageIntro eyebrow="Directorio de profesionales" title={category?.name || "Profesionales"} description="Consulta servicios, cobertura y reseñas antes de crear tu solicitud." /></div>
    <label className="inline-flex gap-3 items-center min-h-11 px-4 py-2 rounded-xl border border-line bg-card text-sm font-semibold"><Icon name="filter" className="w-4 h-4 text-pine" /><input type="checkbox" className="w-4 h-4" checked={available} onChange={(event) => { setAvailable(event.target.checked); setPage(1); }} /> Solo disponibles</label>
    {!loading && !error && !category ? <p role="status" className="card p-6 mt-5">Esta categoría no existe o ya no está disponible.</p> : <CatalogState loading={loading} error={error} empty={providers.length === 0} onRetry={() => setReload((value) => value + 1)}><div className="grid sm:grid-cols-2 gap-4 mt-5">{providers.map((provider) => <PublicProviderCard key={provider.id} provider={provider} onOpen={() => go({ t: "pro", id: provider.id })} onRequest={() => go({ t: "request", catId, proId: provider.id })} />)}</div></CatalogState>}
    {!loading && !error && category && <button onClick={() => go({ t: "request", catId })} className="btn-pine h-12 px-5 mt-6">Crear solicitud en tu zona</button>}
    {(pages > 1 || page > 1) && <nav aria-label="Páginas de profesionales" aria-busy={loading} className="flex flex-wrap items-center gap-3 mt-5"><button disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)} className="btn-ghost h-11 px-4">Anterior</button><span className="text-sm text-mut" aria-live="polite">{loading || error ? `Página ${page}` : `${page} / ${pages}`}</span><button disabled={loading || page >= pages} onClick={() => setPage((value) => value + 1)} className="btn-ghost h-11 px-4">Siguiente</button></nav>}
  </main>;
}
