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
import { AppError } from "./errors";

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

  const row = await db.rate_limit.upsert({
    where: { bucket_subject: { bucket: rule.bucket, subject } },
    update: {
      count: { increment: 1 },
      // si cambió la ventana, Prisma no resetea en el mismo upsert:
      // se corrige abajo con un update condicional.
    },
    create: { bucket: rule.bucket, subject, count: 1, window_start: windowStart },
  });

  if (row.window_start.getTime() !== windowStart.getTime()) {
    // Nueva ventana: reinicia el contador de forma condicional.
    await db.rate_limit.updateMany({
      where: { bucket: rule.bucket, subject, window_start: row.window_start },
      data: { count: 1, window_start: windowStart },
    });
    return;
  }

  if (row.count > rule.max) throw AppError.rateLimited();
}
