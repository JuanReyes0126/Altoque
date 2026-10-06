import { useEffect, useState } from "react";
import { api, type PublicProvider } from "../../lib/api";
import { ApiHttpError } from "../../lib/http";
import type { View } from "../../lib/state";

export function ProviderDetails({ provider, onRequest }: { provider: PublicProvider; onRequest: () => void }) {
  return <>
    <section className="card p-6 mt-5">
      <h1 className="font-disp font-bold text-2xl break-words">{provider.name}</h1>
      {provider.business_name && <p className="text-mut mt-2">{provider.business_name}</p>}
      <p className="text-sm mt-3">{provider.reviews_count > 0 ? `${provider.rating.toFixed(1)} ★ · ${provider.reviews_count} reseñas` : "Aún sin reseñas"}</p>
      <p className={`text-sm mt-3 ${provider.is_available ? "text-ok" : "text-mut"}`}>{provider.is_available ? "Disponible" : "Fuera de línea"}</p>
      {provider.bio && <p className="whitespace-pre-wrap break-words mt-4">{provider.bio}</p>}
      <h2 className="font-bold mt-5">Servicios</h2><p className="text-mut mt-2">{provider.categories.map((category) => category.name).join(" · ")}</p>
      <h2 className="font-bold mt-5">Zonas</h2><p className="text-mut mt-2">{provider.zones.map((zone) => zone.name).join(" · ")}</p>
      <button onClick={onRequest} className="btn-pine h-12 px-5 mt-6">Solicitar este tipo de servicio</button>
      <p className="text-xs text-mut mt-2">La asignación se confirma cuando un profesional de tu zona acepta la solicitud.</p>
    </section>
    <section className="mt-6"><h2 className="font-disp font-bold text-xl">Reseñas recientes</h2>
      {!provider.recent_reviews?.length ? <p role="status" className="card p-5 mt-3 text-mut">Aún no hay reseñas.</p> : provider.recent_reviews.map((review, index) => <article key={`${review.created_at}-${index}`} className="card p-5 mt-3"><p className="font-bold">{review.reviewer_name} · {review.rating} ★</p><p className="text-xs text-mut mt-1">{new Date(review.created_at).toLocaleDateString("es-DO")}</p>{review.comment && <p className="mt-3 break-words">{review.comment}</p>}</article>)}
    </section>
  </>;
}

export function ProProfile({ id, go }: { id: string; go: (view: View) => void }) {
  const [provider, setProvider] = useState<PublicProvider | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError("");
    api.providersPublic.getById(id).then((data) => { if (alive) setProvider(data); })
      .catch((failure: unknown) => { if (alive) setError(failure instanceof ApiHttpError && failure.status === 404 ? "El profesional no existe o no está disponible para consulta." : "No pudimos cargar el perfil profesional."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id, reload]);
  return <main className="max-w-3xl mx-auto px-5 py-6"><button onClick={() => go({ t: "explore" })} className="btn-ghost h-11 px-4">Volver a servicios</button>
    {loading ? <p role="status" className="py-10 text-mut">Cargando perfil…</p> : error ? <section role="alert" className="card p-5 mt-5"><p>{error}</p><button onClick={() => setReload((value) => value + 1)} className="btn-ghost h-11 px-4 mt-3">Reintentar</button></section> : provider && <ProviderDetails provider={provider} onRequest={() => go({ t: "request", proId: provider.id })} />}
  </main>;
}
