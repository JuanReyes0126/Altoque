import type { ReactNode } from "react";
import { AdminDataState } from "./AdminDataState";
import { adminPageRange, type AdminPageMeta } from "./admin-pagination";

export function AdminPagination({ page, meta, rowCount, loading, error, disabled = false, label, onPage }: {
  page: number; meta: AdminPageMeta | null; rowCount: number; loading: boolean; error: string;
  disabled?: boolean; label: string; onPage: (page: number) => void;
}) {
  const pages = Math.max(page, meta?.pages ?? 1);
  const range = meta ? adminPageRange(meta, rowCount) : { start: 0, end: 0 };
  return (
    <nav aria-label={`Páginas de ${label}`} aria-busy={loading} className="card flex flex-col sm:flex-row sm:items-center gap-3 p-4 sm:px-5">
      <p className="text-[0.8rem] text-mut font-medium flex-1 tabular-nums" aria-live="polite" aria-atomic="true">
        {loading || error || !meta ? `Página ${page}` :
          `${range.start}–${range.end} de ${meta.total} · Página ${page} de ${pages}`}
      </p>
      <div className="flex items-center gap-2">
        <button type="button" disabled={loading || disabled || page <= 1} onClick={() => onPage(page - 1)} className="btn-ghost h-11 px-4 flex-1 sm:flex-none disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine">Anterior</button>
        <button type="button" disabled={loading || disabled || !meta || page >= pages} onClick={() => onPage(page + 1)} className="btn-ghost h-11 px-4 flex-1 sm:flex-none disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine">Siguiente</button>
      </div>
    </nav>
  );
}

/** Los controles permanecen visibles también ante carga, error o una colección vacía. */
export function AdminPageView({ children, onRetry, ...props }: {
  children: ReactNode; onRetry: () => void; page: number; meta: AdminPageMeta | null; rowCount: number;
  loading: boolean; error: string; disabled?: boolean; label: string; onPage: (page: number) => void;
}) {
  const { loading, error, rowCount, label } = props;
  return (
    <section className="space-y-4 min-w-0" aria-busy={loading} aria-label={`Listado de ${label}`}>
      <AdminDataState loading={loading} error={error} empty={rowCount === 0} label={label} onRetry={onRetry} />
      {!loading && !error && rowCount > 0 ? children : null}
      <AdminPagination {...props} />
    </section>
  );
}
