export function AdminDataState({ loading, error, empty, label, onRetry }: {
  loading: boolean; error: string; empty: boolean; label: string; onRetry: () => void;
}) {
  if (loading) return (
    <div className="card px-5 py-10 sm:py-12 text-center">
      <span className="w-12 h-12 rounded-2xl bg-pinesoft text-pine grid place-items-center mx-auto motion-safe:animate-pulse" aria-hidden="true">
        <Icon name="clock" className="w-5 h-5" strokeWidth={1.8} />
      </span>
      <p role="status" className="font-semibold text-ink mt-4">Cargando {label}…</p>
      <p className="text-sm text-mut mt-1.5">La información estará disponible en un momento.</p>
    </div>
  );
  if (error) return (
    <section role="alert" className="card p-5 sm:p-6 border-cor/20 flex flex-col sm:flex-row sm:items-start gap-4">
      <span className="w-11 h-11 shrink-0 rounded-2xl bg-corsoft text-cor grid place-items-center" aria-hidden="true"><Icon name="alert" className="w-5 h-5" strokeWidth={1.8} /></span>
      <div className="min-w-0 flex-1">
        <h3 className="font-disp font-bold text-base text-ink">No pudimos cargar {label}</h3>
        <p className="text-sm text-mut leading-relaxed mt-1.5 break-words">{error}</p>
        <button type="button" onClick={onRetry} className="btn-ghost h-11 px-4 mt-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine">Reintentar</button>
      </div>
    </section>
  );
  if (empty) return (
    <div className="card px-5 py-10 sm:py-12 text-center">
      <span className="w-12 h-12 rounded-2xl bg-tint text-mut grid place-items-center mx-auto" aria-hidden="true"><Icon name="layers" className="w-5 h-5" strokeWidth={1.8} /></span>
      <p role="status" className="font-disp font-bold text-base text-ink mt-4">No hay {label} para mostrar.</p>
      <p className="text-sm text-mut mt-1.5">Cuando haya registros, aparecerán aquí.</p>
    </div>
  );
  return null;
}
import { Icon } from "../../components/icons";
