import { useEffect, useState } from "react";
import { api, type PublicProvider } from "../../lib/api";
import { ApiHttpError } from "../../lib/http";
import type { View } from "../../lib/state";
import { Icon } from "../../components/icons";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/feedback";
import { ProviderAvatar } from "./Home";

export function ProviderDetails({ provider, onRequest }: { provider: PublicProvider; onRequest: () => void }) {
  return <>
    <section className="card p-6 sm:p-8 mt-5">
      <div className="flex items-start gap-4"><ProviderAvatar provider={provider} /><div className="min-w-0"><p className="ui-eyebrow mb-2">Perfil profesional</p><h1 className="font-disp font-bold text-2xl break-words">{provider.name}</h1></div></div>
      {provider.business_name && <p className="text-mut mt-2">{provider.business_name}</p>}
      <p className="text-sm mt-3">{provider.reviews_count > 0 ? `${provider.rating.toFixed(1)} ★ · ${provider.reviews_count} reseñas` : "Aún sin reseñas"}</p>
      <p className={`ui-pill mt-3 ${provider.is_available ? "bg-oksoft text-ok" : ""}`}><span aria-hidden="true" className={`w-2 h-2 rounded-full ${provider.is_available ? "bg-ok" : "bg-soft"}`} />{provider.is_available ? "Disponible" : "Fuera de línea"}</p>
      {provider.bio && <p className="whitespace-pre-wrap break-words mt-6 leading-relaxed text-mut">{provider.bio}</p>}
      <div className="grid sm:grid-cols-2 gap-5 border-t border-line2 pt-6 mt-6">
        <section><h2 className="font-bold flex items-center gap-2"><Icon name="wrench" className="w-4 h-4 text-pine" />Servicios</h2><p className="text-sm text-mut leading-relaxed mt-2">{provider.categories.map((category) => category.name).join(" · ")}</p></section>
        <section><h2 className="font-bold flex items-center gap-2"><Icon name="pin" className="w-4 h-4 text-pine" />Zonas</h2><p className="text-sm text-mut leading-relaxed mt-2">{provider.zones.map((zone) => zone.name).join(" · ")}</p></section>
      </div>
      <button onClick={onRequest} className="btn-pine min-h-12 px-5 mt-7 w-full sm:w-auto">Solicitar este tipo de servicio<Icon name="arrow" className="w-4 h-4" /></button>
      <p className="text-xs text-mut mt-2">La asignación se confirma cuando un profesional de tu zona acepta la solicitud.</p>
    </section>
    <section className="mt-6"><h2 className="font-disp font-bold text-xl">Reseñas recientes</h2>
      {!provider.recent_reviews?.length ? <EmptyState icon="star" title="Aún no hay reseñas." description="Las valoraciones de servicios completados aparecerán aquí cuando estén disponibles." /> : provider.recent_reviews.map((review, index) => <article key={`${review.created_at}-${index}`} className="card p-5 mt-3"><p className="font-bold">{review.reviewer_name} · {review.rating} ★</p><p className="text-xs text-mut mt-1">{new Date(review.created_at).toLocaleDateString("es-DO")}</p>{review.comment && <p className="mt-3 break-words leading-relaxed">{review.comment}</p>}</article>)}
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
    {loading ? <LoadingState label="Cargando perfil…" /> : error ? <ErrorState message={error} onRetry={() => setReload((value) => value + 1)} /> : provider && <ProviderDetails provider={provider} onRequest={() => go({ t: "request", proId: provider.id })} />}
  </main>;
}
