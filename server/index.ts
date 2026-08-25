/**
 * ALTOQUE · Ensamblaje del API (F1)
 *
 * Hono sobre /api/v1 (versionado desde el día uno — v1.1 §17).
 * Orden de middleware: requestId → headers → accessLog → originCheck.
 * Errores centralizados (F1.5): ningún endpoint hace su propio
 * formateo de errores.
 */
import { Hono } from "hono";
import { ZodError } from "zod";
import { auth } from "./auth/auth";
import type { AuthEnv } from "./middleware/auth";
import { accessLog, originCheck, requestId, securityHeaders } from "./middleware/security";
import { AppError } from "./lib/errors";
import { err } from "./lib/envelope";
import { log } from "./lib/logger";
import { healthRoutes } from "./routes/health";
import { categoryRoutes } from "./routes/categories";
import { meRoutes } from "./routes/me";

export const app = new Hono<AuthEnv>();

// ── transversal ──
app.use("*", requestId);
app.use("*", securityHeaders);
app.use("*", accessLog);
app.use("/api/v1/*", originCheck);

// ── Better Auth: registro, verificación, login, logout, sesiones,
//    forgot/reset password. Montado en /api/v1/auth/*.
//    (Better Auth aplica su propio rate limit interno + el edge de Vercel.)
app.on(["GET", "POST"], "/api/v1/auth/*", (c) => auth.handler(c.req.raw));

// ── dominio F1 ──
app.route("/api/v1", healthRoutes);
app.route("/api/v1", categoryRoutes);
app.route("/api/v1", meRoutes);

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
