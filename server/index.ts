/**
 * ALTOQUE · Ensamblaje del API (F1)
 *
 * Hono sobre /api/v1 (versionado desde el día uno — v1.1 §17).
 * Orden de middleware: requestId → headers → accessLog → originCheck.
 * Errores centralizados (F1.5): ningún endpoint hace su propio
 * formateo de errores.
 */
import type { IncomingMessage } from "node:http";
import { Hono } from "hono";
import { ZodError } from "zod";
// Node ESM exige extensión explícita en imports relativos:
// "./x.js" resuelve al .ts en compilación y al .js emitido en runtime.
import { auth } from "./auth/auth.js";
import type { AuthEnv } from "./middleware/auth.js";
import { accessLog, originCheck, requestId, securityHeaders } from "./middleware/security.js";
import { AppError } from "./lib/errors.js";
import { err } from "./lib/envelope.js";
import { log } from "./lib/logger.js";
import { diagEnabled } from "./lib/diag.js";
import { healthRoutes } from "./routes/health.js";
import { categoryRoutes } from "./routes/categories.js";
import { meRoutes } from "./routes/me.js";
import { requestRoutes } from "./routes/requests.js";

export const app = new Hono<AuthEnv>();

// ── transversal ──
app.use("*", requestId);
app.use("*", securityHeaders);
app.use("*", accessLog);
app.use("/api/v1/*", originCheck);

// ── Better Auth: registro, verificación, login, logout, sesiones,
//    forgot/reset password. Montado en /api/v1/auth/*.
//    (Better Auth aplica su propio rate limit interno + el edge de Vercel.)
//
// ⚠️ TEMPORAL (debug F1.8): con ALTOQUE_DIAG=1 se registra el momento en que
// la petición ENTRA a Better Auth. Si este log aparece pero el accessLog
// ("request") de security.ts NO aparece, el hang está DENTRO de auth.handler.
app.on(["GET", "POST"], "/api/v1/auth/*", async (c) => {
  const rid = c.get("requestId");
  if (diagEnabled()) {
    log.info("[diag] auth.handler → start", {
      requestId: rid,
      method: c.req.method,
      path: c.req.path,
    });
  }
  // ⚠️ TEMPORAL (debug F1.8): diagnóstico PASIVO del Request que llega a
  // Better Auth. Solo lee metadatos (headers, flags) — JAMÁS el cuerpo.
  // Con el adaptador oficial `hono/vercel` el Request ya viene buferado por
  // el runtime de Vercel y c.env NO incluye `incoming` (es undefined); los
  // campos incoming* salen `null`, lo que confirma el patrón Web-standard.
  // `?.` sobre c.env evita un TypeError cuando env es undefined.
  if (diagEnabled()) {
    const raw = c.req.raw;
    const inc = (c.env as unknown as { incoming?: IncomingMessage } | undefined)?.incoming;
    log.info("[diag] pre-handler request shape", {
      requestId: rid,
      method: raw.method,
      hasContentType: raw.headers.has("content-type"),
      contentTypeIsJson: (raw.headers.get("content-type") ?? "").includes("application/json"),
      hasContentLength: raw.headers.has("content-length"),
      contentLength: raw.headers.get("content-length"),
      bodyUsed: raw.bodyUsed,
      bodyIsNull: raw.body === null,
      incomingComplete: inc?.complete ?? null,
      incomingReadableEnded: inc?.readableEnded ?? null,
      incomingReadableLength: inc?.readableLength ?? null,
    });
  }
  // ⚠️ TEMPORAL (debug F1.8): registramos también cuándo el handler
  // DEVUELVE la Response o si RECHAZA — si "start" aparece sin "done",
  // la promesa de Better Auth no se asentó (hang confirmado).
  // Montaje oficial directo: c.req.raw pasa a Better Auth sin envolver
  // (los wrappers de body/hooks que lo interceptaban fueron retirados).
  try {
    const res = await auth.handler(c.req.raw);
    if (diagEnabled()) {
      log.info("[diag] auth.handler → done", { requestId: rid, status: res.status });
    }
    return res;
  } catch (err) {
    if (diagEnabled()) {
      log.error("[diag] auth.handler → threw", {
        requestId: rid,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    throw err;
  }
});

// ── dominio F1 ──
app.route("/api/v1", healthRoutes);
app.route("/api/v1", categoryRoutes);
app.route("/api/v1", meRoutes);

// ── dominio F2 ──
app.route("/api/v1/requests", requestRoutes);

// ── errores centralizados ──
app.onError((error, c) => {
  if (error instanceof AppError) {
    return c.json(err(error.code, error.message, error.details), error.status as 400);
  }
  if (error instanceof ZodError) {
    const details = error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    return c.json(err("VALIDATION_ERROR", "Datos inválidos", details), 400);
  }
  log.error("unhandled_error", {
    requestId: c.get("requestId"),
    path: c.req.path,
    message: error.message,
  });
  return c.json(err("INTERNAL_ERROR", "Error interno del servidor"), 500);
});

app.notFound((c) => c.json(err("NOT_FOUND", "Ruta no encontrada"), 404));
