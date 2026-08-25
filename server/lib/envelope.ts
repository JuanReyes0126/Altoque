/**
 * ALTOQUE · Envelopes consistentes del API (F1.4)
 *
 *   éxito:      { data }
 *   paginado:   { data: [], meta: { page, limit, total, pages } }
 *   error:      { error: { code, message, details? } }
 */
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export const ok = <T>(data: T) => ({ data });

export const page = <T>(data: T[], meta: PageMeta) => ({ data, meta });

export function pageMeta(page: number, limit: number, total: number): PageMeta {
  return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}

export const err = (code: string, message: string, details?: unknown) => ({
  error: { code, message, ...(details !== undefined ? { details } : {}) },
});

/** Paginación segura desde query params (evita límites absurdos). */
export function parsePaging(q: URLSearchParams, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(1, Number(q.get("page") ?? "1") || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(q.get("limit") ?? String(defaultLimit)) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}
