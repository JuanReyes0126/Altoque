/**
 * ALTOQUE · Healthcheck (F1.4)
 * GET /api/v1/healthz — sin revelar URL de BD, versiones, secretos ni
 * configuración interna.
 */
import { Hono } from "hono";
import { prisma } from "../database/prisma";
import { isProd } from "../config/env";

export const healthRoutes = new Hono();

healthRoutes.get("/healthz", async (c) => {
  let db: "up" | "down" = "down";
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "up";
  } catch {
    db = "down";
  }
  return c.json(
    {
      status: db === "up" ? "ok" : "degraded",
      service: "altoque-api",
      env: isProd() ? "production" : "development",
      db,
      time: new Date().toISOString(),
    },
    db === "up" ? 200 : 503,
  );
});
