import { useCallback, useEffect, useState } from "react";
import { ADMIN_PAGE_LIMIT, boundedAdminPage, startAdminPageRequest, type AdminPage, type AdminPageLoader } from "./admin-pagination";

/** Solo una página por consulta; respuestas de consultas anteriores se descartan. */
export function useAdminPagination<T>(load: AdminPageLoader<T>) {
  const [request, setRequest] = useState({ page: 1, revision: 0 });
  const [result, setResult] = useState<(AdminPage<T> & { revision: number; error: string }) | null>(null);
  const { page, revision } = request;

  useEffect(() => {
    const query = startAdminPageRequest(load, page, {
      onSuccess: (next) => setResult({ ...next, revision, error: "" }),
      // Un total que disminuye puede dejar fuera de rango la página actual.
      onOutOfRange: (lastPage) => setRequest((current) => current.revision === revision
        ? { page: lastPage, revision: current.revision + 1 } : current),
      onError: () => setResult((previous) => ({
        data: [], revision, error: "No pudimos cargar la información. Inténtalo nuevamente.",
        meta: previous?.meta ?? { page, limit: ADMIN_PAGE_LIMIT, total: 0, pages: 1 },
      })),
    });
    return query.cancel;
  }, [load, page, revision]);

  const loading = result?.revision !== revision;
  const error = !loading ? result?.error ?? "" : "";
  const data = !loading && !error ? result?.data ?? [] : [];
  const meta = result?.meta ?? null;

  const goToPage = useCallback((nextPage: number) => {
    if (loading || !Number.isFinite(nextPage)) return;
    const next = boundedAdminPage(nextPage, Math.max(page, meta?.pages ?? 1));
    setRequest((current) => next === current.page ? current : { page: next, revision: current.revision + 1 });
  }, [loading, meta?.pages, page]);

  const retry = useCallback(() => setRequest((current) => ({ ...current, revision: current.revision + 1 })), []);
  return { data, meta, page, loading, error, goToPage, retry };
}
