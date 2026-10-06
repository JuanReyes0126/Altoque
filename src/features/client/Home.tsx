import { useEffect, useState } from "react";
import { Icon } from "../../components/icons";
import { api, type CatalogCategory, type PublicProvider } from "../../lib/api";
import { useApp, type View } from "../../lib/state";

export function PublicProviderCard({ provider, onOpen, onRequest }: { provider: PublicProvider; onOpen: () => void; onRequest: () => void }) {
  return (
    <article className="card p-5">
      <h2 className="font-disp font-bold text-lg break-words">{provider.name}</h2>
      {provider.business_name && <p className="text-sm text-mut mt-1">{provider.business_name}</p>}
      <p className="text-sm text-mut mt-2">{provider.categories.map((category) => category.name).join(" · ") || "Servicios profesionales"}</p>
      <p className="text-xs text-mut mt-2 break-words">{provider.zones.map((zone) => zone.name).join(" · ")}</p>
      <p className="text-sm mt-3">{provider.reviews_count > 0 ? `${provider.rating.toFixed(1)} ★ · ${provider.reviews_count} reseñas` : "Aún sin reseñas"}</p>
      {typeof provider.is_available === "boolean" && <p className={`text-sm mt-2 ${provider.is_available ? "text-ok" : "text-mut"}`}>{provider.is_available ? "Disponible" : "Fuera de línea"}</p>}
      <div className="flex flex-wrap gap-3 mt-4">
        <button onClick={onOpen} className="btn-ghost px-4 h-11">Ver perfil</button>
        <button onClick={onRequest} className="btn-pine px-4 h-11">Solicitar servicio</button>
      </div>
    </article>
  );
}

export function CatalogState({ loading, error, empty, onRetry, children }: { loading: boolean; error: string; empty: boolean; onRetry: () => void; children: React.ReactNode }) {
  if (loading) return <p role="status" className="py-10 text-center text-mut">Cargando servicios…</p>;
  if (error) return <div role="alert" className="card p-5 mt-5"><p>{error}</p><button onClick={onRetry} className="btn-ghost h-11 px-4 mt-3">Reintentar</button></div>;
  if (empty) return <p role="status" className="card p-8 mt-5 text-center text-mut">No hay resultados disponibles por ahora.</p>;
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
    <main className="max-w-6xl mx-auto px-5 pt-7 pb-10">
      <p className="text-mut">Hola, {session?.name.split(" ")[0] || "bienvenido"}</p>
      <h1 className="font-disp font-bold text-3xl mt-2">¿Qué necesitas hoy?</h1>
      <button onClick={() => go({ t: "explore" })} className="btn-pine h-12 px-5 mt-5">Explorar servicios</button>
      <CatalogState loading={loading} error={error} empty={categories.length === 0} onRetry={() => setReload((value) => value + 1)}>
        <h2 className="font-disp font-bold text-xl mt-8">Servicios</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {categories.map((category) => <button key={category.id} onClick={() => go({ t: "results", catId: category.id })} className="card card-h p-5 text-left"><Icon name={category.icon as never} className="w-6 h-6 text-pine" /><span className="block font-bold mt-3">{category.name}</span></button>)}
        </div>
      </CatalogState>
      {!loading && !error && <>
        <h2 className="font-disp font-bold text-xl mt-9">Disponibles ahora</h2>
        {providers.length === 0 ? <p role="status" className="card p-6 mt-4 text-mut">No hay profesionales en línea por ahora. Puedes crear una solicitud para tu zona.</p> : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">{providers.map((provider) => <PublicProviderCard key={provider.id} provider={provider} onOpen={() => go({ t: "pro", id: provider.id })} onRequest={() => go({ t: "request", proId: provider.id })} />)}</div>}
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
  return <main className="max-w-4xl mx-auto px-5 py-6"><h1 className="font-disp font-bold text-2xl">Explorar servicios</h1>
    <label htmlFor="catalog-search" className="block text-sm font-bold mt-5">Buscar categoría<input id="catalog-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="w-full card p-4 mt-2" /></label>
    <CatalogState loading={loading} error={error} empty={filtered.length === 0} onRetry={() => setReload((value) => value + 1)}><div className="grid sm:grid-cols-2 gap-3 mt-5">{filtered.map((category) => <button key={category.id} onClick={() => go({ t: "results", catId: category.id })} className="card card-h p-5 text-left"><span className="font-bold">{category.name}</span><span className="block text-sm text-mut mt-1">{category.group_name}</span></button>)}</div></CatalogState>
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
    setLoading(true); setError("");
    Promise.all([api.categories.list(), api.providersPublic.list({ category: catId, ...(available ? { available: true } : {}), page, limit: 20 })])
      .then(([catalog, result]) => { if (alive) { setCategory(catalog.find((item) => item.id === catId)); setProviders(result.data); setPages(result.meta.pages); } })
      .catch(() => { if (alive) setError("No pudimos cargar los profesionales."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [catId, available, page, reload]);
  return <main className="max-w-4xl mx-auto px-5 py-6">
    <button onClick={() => go({ t: "explore" })} className="btn-ghost h-11 px-4">Volver a servicios</button>
    <h1 className="font-disp font-bold text-2xl mt-5">{category?.name || "Profesionales"}</h1>
    <label className="flex gap-3 items-center mt-5 min-h-11"><input type="checkbox" checked={available} onChange={(event) => { setAvailable(event.target.checked); setPage(1); }} /> Solo disponibles</label>
    {!loading && !error && !category ? <p role="status" className="card p-6 mt-5">Esta categoría no existe o ya no está disponible.</p> : <CatalogState loading={loading} error={error} empty={providers.length === 0} onRetry={() => setReload((value) => value + 1)}><div className="grid sm:grid-cols-2 gap-4 mt-5">{providers.map((provider) => <PublicProviderCard key={provider.id} provider={provider} onOpen={() => go({ t: "pro", id: provider.id })} onRequest={() => go({ t: "request", catId, proId: provider.id })} />)}</div></CatalogState>}
    {!loading && !error && category && <button onClick={() => go({ t: "request", catId })} className="btn-pine h-12 px-5 mt-6">Crear solicitud en tu zona</button>}
    {!loading && !error && pages > 1 && <nav aria-label="Páginas de profesionales" className="flex items-center gap-3 mt-5"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="btn-ghost h-11 px-4">Anterior</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="btn-ghost h-11 px-4">Siguiente</button></nav>}
  </main>;
}
