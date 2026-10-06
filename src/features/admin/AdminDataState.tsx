export function AdminDataState({ loading, error, empty, label, onRetry }: {
  loading: boolean; error: string; empty: boolean; label: string; onRetry: () => void;
}) {
  if (loading) return <p role="status" className="py-10 text-center text-mut">Cargando {label}…</p>;
  if (error) return <section role="alert" className="card p-5"><p>{error}</p><button onClick={onRetry} className="btn-ghost h-11 px-4 mt-3">Reintentar</button></section>;
  if (empty) return <p role="status" className="card p-6 text-center text-mut">No hay {label} para mostrar.</p>;
  return null;
}
