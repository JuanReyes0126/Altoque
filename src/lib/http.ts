/// <reference types="vite/client" />
/* ════════════════════════════════════════════════════════════════
   ALTOQUE · Cliente HTTP del navegador (src/lib/http)
   F1.8 — Único punto de fetch() del frontend.

   - credentials: "include" → la cookie HttpOnly de Better Auth viaja
     en cada petición (mismo origen en Vercel: sin CORS).
   - Entiende los DOS formatos de error del backend:
       Better Auth  → { code, message }  (USER_ALREADY_EXISTS, …)
       Rutas Altoque → { error: { code, message } }
   - Los códigos se traducen a mensajes legibles en las pantallas;
     jamás se guarda un token en localStorage.
   ════════════════════════════════════════════════════════════════ */

/** En dev local se puede apuntar al API (`VITE_API_URL=http://localhost:8787`).
 *  En Vercel queda vacío: mismo origen, sin CORS. */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

/** Protección UX (F1.8): si el servidor no responde en este plazo, la UI
 *  deja de quedar colgada en "Un momento…" y muestra un error legible.
 *  NO es la solución del signup — solo evita un hang infinito del cliente. */
const REQUEST_TIMEOUT_MS = 15_000;

export class ApiHttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** true para respuestas sin cuerpo (sign-out, etc.) */
  noContent?: boolean;
}

export async function http<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  let text = "";
  const multipart = typeof FormData !== "undefined" && opts.body instanceof FormData;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      credentials: "include",
      // El navegador añade el boundary de multipart; no convertir fotos en {}.
      headers: opts.body !== undefined && !multipart ? { "Content-Type": "application/json" } : undefined,
      body: multipart ? opts.body as FormData : opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    if (!opts.noContent) text = await res.text();
  } catch (e) {
    // Timeout: el servidor aceptó la conexión pero no respondió a tiempo.
    // Distinto de NETWORK_ERROR (no hubo conexión / backend caído).
    if (controller.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) {
      throw new ApiHttpError(0, "REQUEST_TIMEOUT", "Altoque tardó demasiado en responder. Inténtalo nuevamente.");
    }
    // fallo de red / backend caído
    throw new ApiHttpError(0, "NETWORK_ERROR", "No pudimos conectar con Altoque. Revisa tu conexión e inténtalo de nuevo.");
  } finally {
    clearTimeout(timer);
  }

  if (opts.noContent) {
    if (!res.ok) throw new ApiHttpError(res.status, "ERROR", "La solicitud no pudo completarse.");
    return undefined as T;
  }

  // Mejor Auth devuelve 204/JSON vacío en algunas operaciones.
  let body: unknown;
  try { body = text ? JSON.parse(text) : {}; }
  catch {
    throw new ApiHttpError(res.status, "INVALID_RESPONSE", "No pudimos interpretar la respuesta de Altoque. Inténtalo nuevamente.");
  }

  if (!res.ok) {
    // Better Auth: { code, message } · Altoque: { error: { code, message } }
    const object = body !== null && typeof body === "object" ? body as Record<string, unknown> : {};
    const error = object.error ?? object;
    const inner = error !== null && typeof error === "object" ? error as { code?: unknown; message?: unknown } : {};
    const code = typeof inner.code === "string" ? inner.code : "ERROR";
    const message = typeof inner.message === "string" && inner.message ? inner.message : "Ocurrió un error inesperado.";
    throw new ApiHttpError(res.status, code, message);
  }

  return body as T;
}
