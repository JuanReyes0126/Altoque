/**
 * ALTOQUE · Vercel Function — borde dual Web/Node (F1.8)
 *
 * vercel.json reescribe /api/v1/* → /api (esta función). El frontend y el
 * API comparten origen, así las cookies HttpOnly/SameSite=Lax y el chequeo
 * de Origen funcionan sin CORS (v1.1 §18).
 *
 * Runtime Node (no Edge): el PrismaClient estándar lo requiere.
 *
 * ¿POR QUÉ EXISTE ESTE BORDE DUAL?
 * Este proyecto se ha observado desplegado bajo la convención LEGADA de
 * Vercel/Node, que invoca el default export con la firma
 *   (req: IncomingMessage, res: ServerResponse) => void
 * donde la respuesta se ESCRIBE en `res` y no se devuelve nada. Devolver un
 * Web `Response` desde esa firma dispara el warning
 *   "default export returned a 'Response' ..."
 * Por otro lado, un runtime moderno invoca la firma Web
 *   (req: Request) => Response | Promise<Response>.
 *
 * Los dos adaptadores "puros" fallan cada uno en un lado:
 *  - `@hono/node-server/vercel` lee el cuerpo del socket VIVO; si el puente
 *    ya drenó el cuerpo, `request.json()` espera un EOF que nunca llega
 *    (FUNCTION_INVOCATION_TIMEOUT).
 *  - `hono/vercel` devuelve un `Response`, incompatible con la firma legada.
 *
 * Este archivo adapta DINÁMICAMENTE según la convención de invocación:
 *  - Si recibe `(IncomingMessage, ServerResponse)` → lee el cuerpo completo,
 *    construye un `Request` Web, ejecuta la app Hono y VUELCA la `Response`
 *    en `res` (status, headers —incluido Set-Cookie múltiple— y cuerpo).
 *    Devuelve `void` → sin warning.
 *  - Si recibe un `Request` Web → flujo nativo `Request -> Response`.
 *
 * Hono sigue trabajando internamente con Web Standards; las rutas y la
 * lógica de la app NO se alteran.
 *
 * `bodyParser: false` evita que el puente de Vercel consuma el cuerpo antes
 * de tiempo, de modo que este borde lo lee exactamente UNA vez.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { app } from "../server/index.js";

// Impide que el puente de Vercel pre-consuma el cuerpo; lo leemos aquí una vez.
export const config = {
  api: { bodyParser: false },
};

// Límites defensivos: nunca dejar la función colgada ni sin límite de memoria.
const BODY_READ_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB

/** Detecta la convención legada: el 2.º argumento es un `ServerResponse`. */
function isServerResponse(x: unknown): x is ServerResponse {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as ServerResponse).writeHead === "function" &&
    typeof (x as ServerResponse).end === "function"
  );
}

/**
 * Lee el cuerpo completo del `IncomingMessage` exactamente una vez.
 * Devuelve `undefined` para GET/HEAD o si no hay datos (POST vacío).
 * Acotado por timeout y tamaño máximo para no colgar la función.
 */
async function readBody(req: IncomingMessage): Promise<Uint8Array | undefined> {
  const method = (req.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return undefined;

  const chunks: Buffer[] = [];
  let total = 0;

  const readAll = (async () => {
    for await (const chunk of req) {
      const buf = chunk as Buffer;
      total += buf.length;
      if (total > MAX_BODY_BYTES) throw new Error("PAYLOAD_TOO_LARGE");
      chunks.push(buf);
    }
  })();

  const timeout = new Promise<never>((_, reject) => {
    const t = setTimeout(() => reject(new Error("BODY_READ_TIMEOUT")), BODY_READ_TIMEOUT_MS);
    // No retener el proceso si todo lo demás ya terminó.
    if (typeof t.unref === "function") t.unref();
  });

  await Promise.race([readAll, timeout]);

  return chunks.length === 0 ? undefined : Buffer.concat(chunks);
}

/**
 * Convierte los headers de Node a `Headers` preservando duplicados
 * (p. ej. múltiples `Cookie`). Usa `rawHeaders` (pares planos) para no
 * perder repeticiones que `req.headers` colapsaría.
 */
function toWebHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  const raw = req.rawHeaders;
  for (let i = 0; i + 1 < raw.length; i += 2) {
    headers.append(raw[i], raw[i + 1]);
  }
  return headers;
}

/**
 * Construye un `Request` Web absoluto a partir del `IncomingMessage`.
 * El protocolo/host se derivan de `x-forwarded-*` (Vercel) o del host.
 */
function buildRequest(req: IncomingMessage, body: Uint8Array | undefined): Request {
  const fwdProto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0].trim();
  const fwdHost = (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0].trim();
  const proto = fwdProto || "https";
  const host = fwdHost || (req.headers["host"] as string | undefined) || "localhost";
  const url = `${proto}://${host}${req.url || "/"}`;

  const method = (req.method || "GET").toUpperCase();
  const headers = toWebHeaders(req);

  // Solo adjuntar cuerpo para métodos que lo admiten; GET/HEAD lanzarían.
  if (body !== undefined && method !== "GET" && method !== "HEAD") {
    return new Request(url, { method, headers, body, duplex: "half" });
  }
  return new Request(url, { method, headers });
}

/**
 * Vuelca una `Response` Web en el `ServerResponse` de la firma legada:
 * status, headers (preservando múltiples `Set-Cookie`) y cuerpo.
 */
async function writeResponse(web: Response, res: ServerResponse): Promise<void> {
  if (res.writableEnded || res.destroyed) return;

  res.statusCode = web.status;
  if (web.statusText) res.statusMessage = web.statusText;

  // Headers. `Headers.entries()` colapsa `set-cookie`; se maneja aparte.
  const hasGetSetCookie = typeof web.headers.getSetCookie === "function";
  const setCookies = hasGetSetCookie ? web.headers.getSetCookie() : [];

  for (const [key, value] of web.headers) {
    if (key.toLowerCase() === "set-cookie") continue; // manejado abajo
    res.setHeader(key, value);
  }
  if (setCookies.length > 0) {
    // setHeader acepta un array → preserva cada cookie por separado.
    res.setHeader("set-cookie", setCookies);
  } else if (!hasGetSetCookie) {
    // Fallback (Node antiguo sin getSetCookie): una sola cabecera.
    const single = web.headers.get("set-cookie");
    if (single) res.setHeader("set-cookie", single);
  }

  // Cuerpo. Sin `await drain`: las respuestas del API son pequeñas y esto
  // evita cualquier vector de cuelgue (requisito: nunca colgar).
  if (!web.body || web.bodyUsed) {
    res.end();
    return;
  }

  const reader = web.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (res.destroyed) break;
      res.write(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!res.writableEnded) res.end();
}

/** Respuesta de error genérica; no fuga detalles internos. */
function errorResponse(status: number, code: string): Response {
  return new Response(JSON.stringify({ error: { code, message: code } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Camino legado `(IncomingMessage, ServerResponse)`: escribe en `res`, devuelve void. */
async function handleLegacy(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let webResponse: Response;
  try {
    const body = await readBody(req);
    const request = buildRequest(req, body);
    // Se pasa `{ incoming, outgoing }` como env para que el diagnóstico del
    // servidor (c.env.incoming) siga funcionando bajo esta convención.
    webResponse = await app.fetch(request, { incoming: req, outgoing: res });
  } catch (err) {
    console.error("[altoque:api] error manejando request:", err);
    const code =
      err instanceof Error && err.message === "PAYLOAD_TOO_LARGE"
        ? "PAYLOAD_TOO_LARGE"
        : err instanceof Error && err.message === "BODY_READ_TIMEOUT"
          ? "BODY_READ_TIMEOUT"
          : "INTERNAL_ERROR";
    webResponse =
      code === "PAYLOAD_TOO_LARGE"
        ? errorResponse(413, code)
        : code === "BODY_READ_TIMEOUT"
          ? errorResponse(408, code)
          : errorResponse(500, code);
  }

  try {
    await writeResponse(webResponse, res);
  } catch (writeErr) {
    console.error("[altoque:api] error escribiendo respuesta:", writeErr);
    if (!res.writableEnded && !res.destroyed) {
      try {
        res.statusCode = 500;
        res.end();
      } catch {
        /* noop */
      }
    }
  }
}

/**
 * Default export dual:
 *  - firma legada `(req, res)` → maneja y devuelve `void` (sin warning);
 *  - firma Web `(req)` → devuelve la `Response` nativa.
 */
const handler = (async (
  reqOrIncoming: Request | IncomingMessage,
  maybeRes?: ServerResponse,
): Promise<Response | void> => {
  if (maybeRes && isServerResponse(maybeRes)) {
    await handleLegacy(reqOrIncoming as IncomingMessage, maybeRes);
    return; // void → convención legada, sin warning
  }
  // Convención Web nativa: Request -> Response.
  return app.fetch(reqOrIncoming as Request);
}) as unknown as ((req: IncomingMessage, res: ServerResponse) => void | Promise<void>) &
  ((req: Request) => Response | Promise<Response>);

export default handler;
