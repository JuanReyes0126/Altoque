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

/** Registra una etapa puntual (sin medir) cuando el diagnóstico está activo. */
export function stage(label: string, ctx?: Record<string, unknown>) {
  if (enabled()) log.info(label, ctx);
}

/**
 * ⚠️ TEMPORAL (debug F1.8) — wrapper del adapter de BD de Better Auth.
 * Registra op + model + duración de cada operación que Better Auth le
 * pide al adapter (create/findOne/update/…). NUNCA registra data/where
 * (contienen emails y hashes de contraseña).
 * Solo se instala cuando ALTOQUE_DIAG=1 (ver server/auth/auth.ts).
 */
export function withDiagAdapter<TFactory extends (options: never) => Record<string, unknown>>(
  factory: TFactory,
): TFactory {
  const OPS = [
    "create", "findOne", "findMany", "count",
    "update", "updateMany", "delete", "deleteMany",
    "consumeOne", "incrementOne", "transaction",
  ];
  return ((options: never) => {
    // Mejor Auth llama al factory una vez (inicialización). Si el hang
    // ocurre DENTRO de la init de BA, este log aparece sin "wrapper ready".
    stage("[diag][ba:adapter-factory] invoked (Better Auth init)");
    const adapter = factory(options);
    for (const op of OPS) {
      const fn = adapter[op];
      if (typeof fn !== "function") continue;
      adapter[op] = async (arg: unknown) => {
        const a = arg as { model?: unknown } | undefined;
        const model =
          a && typeof a === "object" && typeof a.model === "string"
            ? a.model
            : op === "transaction" ? "(tx)" : "?";
        const t0 = Date.now();
        stage(`[diag][ba:adapter] ${op} → start`, { model });
        try {
          const res = await (fn as (x: unknown) => Promise<unknown>)(arg);
          stage(`[diag][ba:adapter] ${op} → done`, { model, durationMs: Date.now() - t0 });
          return res;
        } catch (e) {
          stage(`[diag][ba:adapter] ${op} → error`, {
            model,
            durationMs: Date.now() - t0,
            message: e instanceof Error ? e.message : String(e),
          });
          throw e;
        }
      };
    }
    stage("[diag][ba:adapter-factory] wrapper ready", {
      ops: OPS.filter((op) => typeof adapter[op] === "function").join(","),
    });
    return adapter;
  }) as TFactory;
}

/**
 * ⚠️ TEMPORAL (debug F1.8) — observa las lecturas del cuerpo del Request
 * (json/text/arrayBuffer/…). Better Auth lee el body del signup con
 * `req.json()`; si esa promesa no se resuelve (stream que nunca termina),
 * el handler cuelga ANTES de tocar hooks, hashing o BD — exactamente el
 * síntoma observado. Registra solo etapa y duración; JAMÁS el contenido.
 */
export function withBodyDiag(raw: Request): Request {
  if (!enabled()) return raw;
  for (const m of ["json", "text", "arrayBuffer", "formData", "blob"] as const) {
    const orig = raw[m].bind(raw) as unknown as (...a: unknown[]) => Promise<unknown>;
    Object.defineProperty(raw, m, {
      value: async (...a: unknown[]) => {
        stage(`[diag][req:${m}] → start`);
        const t0 = Date.now();
        try {
          const out = await orig(...a);
          stage(`[diag][req:${m}] → done`, { durationMs: Date.now() - t0 });
          return out;
        } catch (e) {
          stage(`[diag][req:${m}] → threw`, {
            message: e instanceof Error ? e.message : String(e),
          });
          throw e;
        }
      },
    });
  }
  return raw;
}
