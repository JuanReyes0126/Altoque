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
import { randomUUID } from "node:crypto";
import { errorMonitor } from "node:events";
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

type DatabaseIdentity = "preview" | "production" | "other" | "invalid";

/** Identidad configurada, sin conexión: referencias verificadas en Neon. */
function databaseIdentity(value: string | undefined): DatabaseIdentity {
  if (!value || /[\s\u0000-\u001f\u007f\\#]/u.test(value)) return "invalid";
  try {
    const url = new URL(value);
    if ((url.protocol !== "postgres:" && url.protocol !== "postgresql:")
      || !url.hostname || url.hash) return "invalid";
    // No inferir el destino por autoridad si hay overrides de conexión/routing.
    for (const key of url.searchParams.keys()) {
      if (/^(?:host|hostaddr|port|service|servicefile|options|endpoint)$/i.test(key)) return "invalid";
    }

    const host = url.hostname.toLowerCase();
    // El parser de protocolos no especiales puede aceptar hosts codificados.
    // Validar autoridad sin decodificarla ni reflejarla en el diagnóstico.
    const dnsHost = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
    if (!dnsHost.test(host) && !/^\[[0-9a-f:.]+\]$/.test(host)) return "invalid";

    const suffix = ".c-10.us-east-1.aws.neon.tech";
    const endpoints = {
      preview: "ep-flat-violet-au1e8xde",
      production: "ep-steep-hall-au81p0co",
    } as const;
    for (const identity of ["preview", "production"] as const) {
      const endpoint = endpoints[identity];
      if (host === `${endpoint}${suffix}` || host === `${endpoint}-pooler${suffix}`) return identity;
    }
    return "other";
  } catch { return "invalid"; }
}

function recordDatabaseIdentity(): void {
  // Ni siquiera leer DATABASE_URL fuera del gate exacto autorizado.
  if (process.env.VERCEL_ENV !== "preview" || process.env.ALTOQUE_DIAG !== "1") return;
  try {
    // Payload único y cerrado: no objeto, hostname, URL ni error del parser.
    console.log(databaseIdentity(process.env.DATABASE_URL));
  } catch { /* Un fallo del logger no cambia el comportamiento del adaptador. */ }
}

// TEMPORAL: diagnóstico del borde, exclusivamente Preview + ALTOQUE_DIAG=1.
// Payload cerrado: nunca imprimir mensajes, stacks completos, URLs ni headers.
type DiagnosticStage =
  | "dispatch_node" | "dispatch_web" | "read_body" | "build_request"
  | "app_fetch" | "app_fetch_start" | "app_fetch_done" | "web_response_returned"
  | "headers" | "reader_acquire" | "stream_read" | "stream_write" | "reader_release"
  | "response_end" | "response_end_called" | "response_written" | "response_skipped"
  | "recovery_end" | "response_error" | "response_finish" | "response_close";

const DIAGNOSTIC_ERROR_TYPES = new Set([
  "Error", "TypeError", "RangeError", "SyntaxError", "DOMException",
  "PrismaClientInitializationError", "PrismaClientKnownRequestError", "PrismaClientUnknownRequestError",
]);
const DIAGNOSTIC_ERROR_CODES = new Set([
  "ERR_HTTP_HEADERS_SENT", "ERR_INVALID_CHAR", "ERR_INVALID_HTTP_TOKEN", "ERR_HTTP_CONTENT_LENGTH_MISMATCH",
  "ERR_STREAM_WRITE_AFTER_END", "ERR_STREAM_DESTROYED", "ERR_STREAM_PREMATURE_CLOSE", "ERR_INVALID_STATE",
  "ECONNRESET", "EPIPE", "P1000", "P1001", "P1002", "P1017", "P2024",
]);
const DIAGNOSTIC_FILES: Record<string, string> = {
  "api/index": "api/index.ts",
  "server/index": "server/index.ts",
  "server/middleware/security": "server/middleware/security.ts",
};

function diagnosticError(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  // No invocar getters arbitrarios de code ni registrar valores no permitidos.
  const code: unknown = error && typeof error === "object"
    ? Object.getOwnPropertyDescriptor(error, "code")?.value : undefined;
  const locations: string[] = [];
  if (error instanceof Error && typeof error.stack === "string") {
    // Omitir el mensaje inicial y extraer sólo etiquetas fijas + números.
    for (const line of error.stack.slice(0, 8_000).split("\n").slice(1)) {
      if (!/^\s+at /.test(line)) continue;
      const match = line.match(/\/(api\/index|server\/index|server\/middleware\/security)\.(?:js|ts):([1-9]\d{0,6}):([1-9]\d{0,6})\)?$/);
      if (!match) continue;
      const location = `${DIAGNOSTIC_FILES[match[1]]}:${match[2]}:${match[3]}`;
      if (!locations.includes(location)) locations.push(location);
      if (locations.length === 3) break;
    }
  }
  return {
    errorType: DIAGNOSTIC_ERROR_TYPES.has(name) ? name : "OtherError",
    errorCode: typeof code === "string" && DIAGNOSTIC_ERROR_CODES.has(code) ? code : "UNKNOWN",
    locations,
  };
}

interface EdgeDiagnostic {
  phase: DiagnosticStage;
  record(stage: DiagnosticStage): void;
  failure(error: unknown): void;
}

function edgeDiagnostic(request: Request | IncomingMessage, response?: ServerResponse): EdgeDiagnostic | undefined {
  if (process.env.VERCEL_ENV !== "preview" || process.env.ALTOQUE_DIAG !== "1") return undefined;
  try {
    const correlationId = randomUUID();
    const candidate = typeof (request as Request).headers?.get === "function"
      ? (request as Request).headers.get("x-vercel-id")
      : (request as IncomingMessage).headers?.["x-vercel-id"];
    const vercelRequestId = typeof candidate === "string" && candidate.length <= 160
      && /^(?:[a-z]{3}[0-9]{1,2}::){1,3}[a-z0-9]{5}-[0-9]{13}-[a-f0-9]{12}$/.test(candidate)
      ? candidate : undefined;
    const emit = (stage: DiagnosticStage, failure?: { error: unknown }) => {
      // El diagnóstico nunca debe alterar el resultado si el logger falla.
      try {
        const entry = {
          event: "edge_diag", correlationId, ...(vercelRequestId ? { vercelRequestId } : {}), stage,
          ...(response ? {
            headersSent: response.headersSent, writableEnded: response.writableEnded,
            writableFinished: response.writableFinished, destroyed: response.destroyed,
          } : {}),
          ...(failure ? diagnosticError(failure.error) : {}),
        };
        if (failure) console.error(JSON.stringify(entry));
        else console.log(JSON.stringify(entry));
      } catch { /* Observación best-effort: nunca sustituir la excepción original. */ }
    };
    let reported = false;
    let lastError: unknown;
    let lastStage: DiagnosticStage | undefined;
    const diagnostic: EdgeDiagnostic = {
      phase: response ? "dispatch_node" : "dispatch_web",
      record: emit,
      failure(error) {
        // El catch de transmisión puede recibir un error ya observado en el loop.
        if (reported && lastError === error && lastStage === diagnostic.phase) return;
        reported = true;
        lastError = error;
        lastStage = diagnostic.phase;
        emit(diagnostic.phase, { error });
      },
    };
    if (response && typeof response.once === "function" && typeof response.off === "function") {
      const onFinish = () => emit("response_finish");
      const onError = (error: unknown) => emit("response_error", { error });
      const onClose = () => {
        emit("response_close");
        response.off("finish", onFinish);
        response.off("close", onClose);
        response.off(errorMonitor, onError);
      };
      // errorMonitor observa sin consumir error ni impedir que Node lo lance.
      response.once("finish", onFinish);
      response.once("close", onClose);
      response.on(errorMonitor, onError);
    }
    return diagnostic;
  } catch { return undefined; }
}

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
async function writeResponse(web: Response, res: ServerResponse, diagnostic?: EdgeDiagnostic): Promise<void> {
  if (res.writableEnded || res.destroyed) {
    diagnostic?.record("response_skipped");
    return;
  }

  if (diagnostic) diagnostic.phase = "headers";
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
    if (diagnostic) diagnostic.phase = "response_end";
    res.end();
    diagnostic?.record("response_end_called");
    return;
  }
  if (diagnostic) diagnostic.phase = "reader_acquire";
  const reader = web.body.getReader();
  try {
    for (;;) {
      if (diagnostic) diagnostic.phase = "stream_read";
      const { done, value } = await reader.read();
      if (done || res.destroyed) break;
      if (diagnostic) diagnostic.phase = "stream_write";
      res.write(value);
    }
  } catch (error) {
    diagnostic?.failure(error);
    throw error;
  } finally {
    const interruptedStage = diagnostic?.phase;
    if (diagnostic) diagnostic.phase = "reader_release";
    reader.releaseLock();
    // Si releaseLock tiene éxito, conservar la etapa del error original.
    if (diagnostic && interruptedStage) diagnostic.phase = interruptedStage;
  }
  if (!res.writableEnded) {
    if (diagnostic) diagnostic.phase = "response_end";
    res.end();
    diagnostic?.record("response_end_called");
  }
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
    recordDatabaseIdentity();
    // Convención Web nativa: Request -> Response (sin adaptador).
    if (!maybeRes || !isServerResponse(maybeRes)) {
      const diagnostic = edgeDiagnostic(reqOrIncoming);
      if (diagnostic) {
        diagnostic.record("dispatch_web");
        diagnostic.phase = "app_fetch";
        diagnostic.record("app_fetch_start");
        try {
          const web = await application.fetch(reqOrIncoming as Request);
          diagnostic.record("app_fetch_done");
          diagnostic.record("web_response_returned");
          return web;
        } catch (error) {
          diagnostic.failure(error);
          throw error;
        }
      }
      return application.fetch(reqOrIncoming as Request);
    }

    // Convención legada (IncomingMessage, ServerResponse): escribe en res, void.
    const req = reqOrIncoming as IncomingMessage;
    const res = maybeRes;
    const diagnostic = edgeDiagnostic(req, res);
    diagnostic?.record("dispatch_node");
    let web: Response;
    try {
      if (diagnostic) diagnostic.phase = "read_body";
      const body = await readBody(req, maxBodyBytes, bodyTimeoutMs);
      if (diagnostic) diagnostic.phase = "build_request";
      const request = buildRequest(req, body);
      if (diagnostic) diagnostic.phase = "app_fetch";
      diagnostic?.record("app_fetch_start");
      web = await application.fetch(request, { incoming: req, outgoing: res });
      diagnostic?.record("app_fetch_done");
    } catch (err) {
      diagnostic?.failure(err);
      const msg = err instanceof Error ? err.message : "";
      web =
        msg === "PAYLOAD_TOO_LARGE"
          ? errorJson(413, msg)
          : msg === "BODY_READ_TIMEOUT"
            ? errorJson(408, msg)
            : errorJson(500, "INTERNAL_ERROR");
    }

    try {
      await writeResponse(web, res, diagnostic);
      diagnostic?.record("response_written");
    } catch (error) {
      diagnostic?.failure(error);
      // Garantizar que res siempre termina, incluso si el vuelco falla.
      if (!res.writableEnded && !res.destroyed) {
        if (diagnostic) diagnostic.phase = "recovery_end";
        try {
          res.statusCode = 500;
          res.end();
          diagnostic?.record("response_end_called");
        } catch (recoveryError) {
          diagnostic?.failure(recoveryError);
          throw recoveryError;
        }
      }
    }
  }) as unknown as ((req: IncomingMessage, res: ServerResponse) => void | Promise<void>) &
    ((req: Request) => Response | Promise<Response>);
}

export default createEdgeHandler(app);
