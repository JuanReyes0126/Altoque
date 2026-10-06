/**
 * ALTOQUE · Seguridad transversal (F1.5)
 *
 *  - requestId por request (correlación en logs)
 *  - headers de seguridad
 *  - validación de Origen en mutables (CSRF — Addendum §7):
 *    cookies SameSite=Lax + este chequeo. Los enlaces de verificación
 *    y reset son GET, así no se rompen.
 *  - logging estructurado de access (sanitizado)
 */
import { randomUUID } from "node:crypto";
import { createMiddleware } from "hono/factory";
import { isProd, trustedOrigins } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import { log, redactLogPath } from "../lib/logger.js";
import type { AuthEnv } from "./auth.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const requestId = createMiddleware<AuthEnv>(async (c, next) => {
  c.set("requestId", randomUUID());
  await next();
});

export const originCheck = createMiddleware<AuthEnv>(async (c, next) => {
  if (!SAFE_METHODS.has(c.req.method)) {
    const origin = c.req.header("origin");
    if (origin) {
      let host = "";
      try {
        host = new URL(origin).origin;
      } catch {
        throw new AppError("FORBIDDEN", "Origen inválido", 403);
      }
      if (!trustedOrigins().includes(host)) {
        log.warn("origin_rejected", { requestId: c.get("requestId"), origin: host, path: redactLogPath(c.req.path) });
        throw new AppError("FORBIDDEN", "Origen no confiable", 403);
      }
    }
  }
  await next();
});

export const securityHeaders = createMiddleware<AuthEnv>(async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (isProd()) {
    c.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  // Las respuestas GET también pueden incluir perfil, sesión o direcciones.
  // Política conservadora para todo el API, incluidos errores y endpoints BA.
  if (c.req.path.startsWith("/api/v1")) {
    c.header("Cache-Control", "no-store");
  }
});

export const accessLog = createMiddleware<AuthEnv>(async (c, next) => {
  const start = Date.now();
  await next();
  log.info("request", {
    requestId: c.get("requestId"),
    method: c.req.method,
    path: redactLogPath(c.req.path),
    status: c.res.status,
    durationMs: Date.now() - start,
  });
});
