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
    <nav aria-label={`Páginas de ${label}`} className="flex flex-wrap items-center gap-3 pt-3">
      <p className="text-[0.8rem] text-mut flex-1 min-w-40" aria-live="polite">
        {loading || error || !meta ? `Página ${page}` :
          `${range.start}–${range.end} de ${meta.total} · Página ${page} de ${pages}`}
      </p>
      <button type="button" disabled={loading || disabled || page <= 1} onClick={() => onPage(page - 1)} className="btn-ghost h-11 px-4">Anterior</button>
      <button type="button" disabled={loading || disabled || !meta || page >= pages} onClick={() => onPage(page + 1)} className="btn-ghost h-11 px-4">Siguiente</button>
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
    <section className="space-y-3" aria-busy={loading}>
      <AdminDataState loading={loading} error={error} empty={rowCount === 0} label={label} onRetry={onRetry} />
      {!loading && !error && rowCount > 0 ? children : null}
      <AdminPagination {...props} />
    </section>
  );
}
