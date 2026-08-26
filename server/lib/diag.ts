/**
 * ALTOQUE · Diagnóstico temporal (debug F1.8 — signup pendiente).
 *
 * ⚠️ TEMPORAL: eliminar este módulo tras confirmar la causa raíz.
 * Se activa SOLO con ALTOQUE_DIAG=1 (Preview/dev). En production es inerte.
 *
 * Garantías de seguridad — NUNCA imprime:
 *   emails completos · contraseñas · hashes · tokens · connection strings ·
 *   parámetros de queries (e.params) · secretos de ningún tipo.
 * Solo registra: etiquetas de etapa, duraciones, SQL con placeholders ($1,$2)
 * y un email redactado (m…@dominio) para correlacionar.
 */
import { log } from "./logger.js";

const enabled = () => process.env.ALTOQUE_DIAG === "1";

/** "maria@ejemplo.com" → "m…@ejemplo.com" (correlación sin exponer). */
export function redactEmail(email: string | undefined | null): string {
  if (!email || !email.includes("@")) return "[redacted]";
  const [local, domain] = email.split("@");
  return `${local.charAt(0) || "?"}…@${domain}`;
}

/** Mide una etapa y la registra de forma segura (inicio / fin / duración). */
export async function withDiag<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!enabled()) return fn();
  const t0 = Date.now();
  log.info(`[diag] ${label} → start`);
  try {
    const out = await fn();
    log.info(`[diag] ${label} → done`, { durationMs: Date.now() - t0 });
    return out;
  } catch (e) {
    log.error(`[diag] ${label} → threw`, {
      durationMs: Date.now() - t0,
      message: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

export const diagEnabled = enabled;
