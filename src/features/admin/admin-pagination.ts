export const ADMIN_PAGE_LIMIT = 20;

export interface AdminPageMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface AdminPage<T> {
  data: T[];
  meta: AdminPageMeta;
}

export type AdminPageLoader<T> = (params: { page: number; limit: number }) => Promise<AdminPage<T>>;

/** Un contrato incompleto es un error de carga, nunca una lista vacía. */
export function validateAdminPage<T>(result: AdminPage<T>, requestedPage: number): AdminPage<T> {
  const meta = result?.meta;
  const availableRows = meta ? Math.max(0, Math.min(meta.limit, meta.total - (requestedPage - 1) * meta.limit)) : 0;
  if (!Array.isArray(result?.data) || !meta ||
    ![meta.page, meta.limit, meta.total, meta.pages].every(Number.isSafeInteger) ||
    meta.page !== requestedPage || meta.limit !== ADMIN_PAGE_LIMIT || meta.total < 0 ||
    meta.pages !== Math.max(1, Math.ceil(meta.total / meta.limit)) ||
    result.data.length > availableRows) {
    throw new Error("INVALID_ADMIN_PAGE");
  }
  return result;
}

export function adminPageRange(meta: AdminPageMeta, rowCount: number) {
  const start = rowCount > 0 ? (meta.page - 1) * meta.limit + 1 : 0;
  return { start, end: rowCount > 0 ? Math.min(meta.total, start + rowCount - 1) : 0 };
}

export function boundedAdminPage(page: number, pages: number) {
  return Math.max(1, Math.min(pages, Math.floor(page)));
}

/** Cancelar la consulta impide publicar resultados, errores o cambios de página obsoletos. */
export function startAdminPageRequest<T>(load: AdminPageLoader<T>, page: number, callbacks: {
  onSuccess: (result: AdminPage<T>) => void; onOutOfRange: (lastPage: number) => void; onError: () => void;
}) {
  let canceled = false;
  const finished = (async () => {
    try {
      const response = await load({ page, limit: ADMIN_PAGE_LIMIT });
      if (canceled) return;
      const result = validateAdminPage(response, page);
      if (page > result.meta.pages) callbacks.onOutOfRange(result.meta.pages);
      else callbacks.onSuccess(result);
    } catch {
      if (!canceled) callbacks.onError();
    }
  })();
  return { finished, cancel: () => { canceled = true; } };
}
