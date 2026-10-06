/**
 * ALTOQUE · Rate limiting de aplicación (Addendum §14)
 *
 * Dos capas:
 *   1) Vercel Firewall (edge)  — límites gruesos por IP sobre auth/uploads.
 *   2) Este módulo (PostgreSQL) — límites de negocio por (bucket, sujeto),
 *      ventana fija, sin Redis. El upsert condicional es atómico.
 *
 * Los valores iniciales se ajustarán con métricas reales.
 */
import type { PrismaClient } from "@prisma/client";
import { AppError } from "./errors.js";

export interface RateLimitRule {
  bucket: string;
  max: number;
  windowSec: number;
}

/** Límites iniciales aprobados en v1.1 §19. */
export const LIMITS = {
  login: { bucket: "auth:login", max: 10, windowSec: 5 * 60 },
  register: { bucket: "auth:register", max: 5, windowSec: 60 * 60 },
  forgot: { bucket: "auth:forgot", max: 3, windowSec: 15 * 60 },
  resendVerification: { bucket: "auth:resend", max: 3, windowSec: 15 * 60 },
  claim: { bucket: "provider:claim", max: 10, windowSec: 60 },
  requestCreate: { bucket: "customer:request", max: 10, windowSec: 60 * 60 },
  upload: { bucket: "files:upload", max: 20, windowSec: 60 * 60 },
  adminAuth: { bucket: "admin:auth", max: 10, windowSec: 5 * 60 },
} satisfies Record<string, RateLimitRule>;

/**
 * Consume 1 unidad del bucket para el sujeto (ip, userId o combinación).
 * Lanza AppError 429 al exceder el límite. Atómico vía upsert condicional.
 */
export async function consume(db: PrismaClient, rule: RateLimitRule, subject: string): Promise<void> {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (rule.windowSec * 1000)) * rule.windowSec * 1000);

  // Reset e incremento en UNA sentencia: requests concurrentes al cambiar
  // de ventana no pueden reiniciar el mismo contador ni saltarse el límite.
  const [row] = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "rate_limit" ("bucket", "subject", "count", "window_start")
    VALUES (${rule.bucket}, ${subject}, 1, ${windowStart})
    ON CONFLICT ("bucket", "subject") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limit"."window_start" = EXCLUDED."window_start"
        THEN LEAST("rate_limit"."count" + 1, ${rule.max + 1})
        ELSE 1
      END,
      "window_start" = EXCLUDED."window_start"
    RETURNING "count"
  `;
  if (!row || row.count > rule.max) throw AppError.rateLimited();
}
