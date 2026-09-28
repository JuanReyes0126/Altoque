/**
 * ALTOQUE · Vercel Function — borde dual Web/Node (F1.8)
 *
 * ¿Por qué existe? Este deployment es invocado con la firma LEGADA de
 * Vercel/Node, (req: IncomingMessage, res: ServerResponse) => void, donde la
 * respuesta se ESCRIBE en `res` y devolver un `Response` dispara el warning
 * "default export returned a 'Response'". Los adaptadores puros fallan cada
 * uno en un lado: @hono/node-server/vercel lee el cuerpo del socket vivo y
 * cuelga (timeout 300 s) si el puente ya lo drenó; hono/vercel devuelve un
 * Response incompatible con la firma legada.
 *
 * Este borde detecta la convención en runtime:
 *  - (IncomingMessage, ServerResponse) → lee el cuerpo UNA vez, construye un
 *    Request Web, ejecuta Hono y vuelca la Response en `res`. Devuelve void.
 *  - (Request) → flujo Web nativo Request -> Response.
 *
 * Hono conserva Web Standards; rutas y lógica de la app sin alterar.
 * bodyParser:false evita que el puente pre-consuma el cuerpo.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { app } from "../server/index.js";

// El puente de Vercel no debe pre-consumer el cuerpo; lo leemos aquí una vez.
export const config = { api: { bodyParser: false } };

type FetchApp = { fetch: (request: Request, env?: unknown) => Response | Promise<Response> };

export interface EdgeOptions {
  bodyTimeoutMs?: number;
  maxBodyBytes?: number;
}

const isServerResponse = (x: unknown): x is ServerResponse =>
  !!x &&
  typeof (x as ServerResponse).writeHead === "function" &&
  typeof (x as ServerResponse).end === "function";

/** Lee el cuerpo completo exactamente una vez. undefined para GET/HEAD o vacío. */
async function readBody(
  req: IncomingMessage,
  maxBodyBytes: number,
  bodyTimeoutMs: number,
): Promise<Uint8Array | undefined> {
  const method = (req.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return undefined;

  const chunks: Buffer[] = [];
  let total = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const readAll = (async () => {
    for await (const chunk of req) {
      total += (chunk as Buffer).length;
      if (total > maxBodyBytes) throw new Error("PAYLOAD_TOO_LARGE");
      chunks.push(chunk as Buffer);
    }
  })();

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("BODY_READ_TIMEOUT")), bodyTimeoutMs);
  });

  try {
    await Promise.race([readAll, timeout]);
  } finally {
    if (timer) clearTimeout(timer); // cleanup correcto del timeout
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

/** Headers Node -> Headers preservando duplicados (rawHeaders, pares planos). */
function toWebHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  const raw = req.rawHeaders;
  for (let i = 0; i + 1 < raw.length; i += 2) headers.append(raw[i], raw[i + 1]);
  return headers;
}

/** IncomingMessage -> Request Web absoluto (proto/host desde x-forwarded-*). */
function buildRequest(req: IncomingMessage, body: Uint8Array | undefined): Request {
  const fwd = (k: string) => (req.headers[k] as string | undefined)?.split(",")[0].trim();
  const proto = fwd("x-forwarded-proto") || "https";
  const host = fwd("x-forwarded-host") || (req.headers.host as string) || "localhost";
  const method = (req.method || "GET").toUpperCase();
  const headers = toWebHeaders(req);
  const hasBody = body !== undefined && method !== "GET" && method !== "HEAD";
  const init: any = {
    method,
    headers,
  };
  if (hasBody) {
    init.body = body;
    init.duplex = "half";
  }
  return new Request(`${proto}://${host}${req.url || "/"}`, init);
}

/**
 * Response Web -> ServerResponse: status, headers (Set-Cookie múltiple sin
 * concatenar) y cuerpo. Siempre termina `res`.
 */
async function writeResponse(web: Response, res: ServerResponse): Promise<void> {
  if (res.writableEnded || res.destroyed) return;

  res.statusCode = web.status;
  if (web.statusText) res.statusMessage = web.statusText;

  // Headers.entries() colapsa set-cookie; se maneja aparte para no concatenarlo.
  const setCookies =
    typeof web.headers.getSetCookie === "function" ? web.headers.getSetCookie() : null;
  for (const [key, value] of web.headers) {
    if (key.toLowerCase() === "set-cookie") continue;
    res.setHeader(key, value);
  }
  if (setCookies && setCookies.length) {
    res.setHeader("set-cookie", setCookies); // array → cada cookie por separado
  } else if (setCookies === null) {
    const single = web.headers.get("set-cookie"); // fallback Node antiguo
    if (single) res.setHeader("set-cookie", single);
  }

  if (!web.body || web.bodyUsed) {
    res.end();
    return;
  }
  const reader = web.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done || res.destroyed) break;
      res.write(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!res.writableEnded) res.end();
}

const errorJson = (status: number, code: string) =>
  new Response(JSON.stringify({ error: { code, message: code } }), {
    status,
    headers: { "content-type": "application/json" },
  });

export function createEdgeHandler(application: FetchApp, opts: EdgeOptions = {}) {
  const maxBodyBytes = opts.maxBodyBytes ?? 10 * 1024 * 1024; // 10 MB
  const bodyTimeoutMs = opts.bodyTimeoutMs ?? 10_000;

  return (async (
    reqOrIncoming: Request | IncomingMessage,
    maybeRes?: ServerResponse,
  ): Promise<Response | void> => {
    // Convención Web nativa: Request -> Response (sin adaptador).
    if (!maybeRes || !isServerResponse(maybeRes)) {
      return application.fetch(reqOrIncoming as Request);
    }

    // Convención legada (IncomingMessage, ServerResponse): escribe en res, void.
    const req = reqOrIncoming as IncomingMessage;
    const res = maybeRes;
    let web: Response;
    try {
      const body = await readBody(req, maxBodyBytes, bodyTimeoutMs);
      web = await application.fetch(buildRequest(req, body), { incoming: req, outgoing: res });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      web =
        msg === "PAYLOAD_TOO_LARGE"
          ? errorJson(413, msg)
          : msg === "BODY_READ_TIMEOUT"
            ? errorJson(408, msg)
            : errorJson(500, "INTERNAL_ERROR");
    }

    try {
      await writeResponse(web, res);
    } catch {
      // Garantizar que res siempre termina, incluso si el vuelco falla.
      if (!res.writableEnded && !res.destroyed) {
        res.statusCode = 500;
        res.end();
      }
    }
  }) as unknown as ((req: IncomingMessage, res: ServerResponse) => void | Promise<void>) &
    ((req: Request) => Response | Promise<Response>);
}

export default createEdgeHandler(app);
