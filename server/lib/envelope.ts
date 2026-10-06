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
export function parsePaging(q: URLSearchParams | Record<string, string>, defaultLimit = 20, maxLimit = 100) {
  const get = (key: string): string | null => {
    if (q instanceof URLSearchParams) {
      return q.get(key);
    }
    return q[key] ?? null;
  };
  const integer = (value: string | null, fallback: number, max: number) => {
    const parsed = value === null || value.trim() === "" ? fallback : Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(1, Math.floor(parsed))) : fallback;
  };
  const limit = integer(get("limit"), defaultLimit, maxLimit);
  // Prisma y PostgreSQL requieren enteros; el offset también debe ser seguro.
  const page = integer(get("page"), 1, Math.floor(2_147_483_647 / limit) + 1);
  return { page, limit, skip: (page - 1) * limit };
}
