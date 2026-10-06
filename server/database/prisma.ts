/**
 * ALTOQUE · Singleton de PrismaClient (F1.1)
 *
 * Decisión (Addendum §2):
 *  - PrismaClient ESTÁNDAR (sin driver adapter) contra la URL pooled de
 *    Neon (`?pgbouncer=true`, modo transacción). Cada transacción
 *    interactiva se fija a una conexión backend del pooler, así
 *    `prisma.$transaction(async tx => …)` es 100% soportado — requisito
 *    obligatorio del claim atómico.
 *  - Una única instancia reutilizable por runtime (patrón globalThis).
 *    NUNCA se llama a $disconnect() por request: en serverless la
 *    instancia se reutiliza entre invocaciones del mismo contenedor y
 *    el pooler de Neon gestiona la vida de las conexiones.
 */
import { PrismaClient } from "@prisma/client";
import { log } from "../lib/logger.js";
import { diagEnabled } from "../lib/diag.js";

const globalForPrisma = globalThis as unknown as {
  __altoquePrisma?: PrismaClient;
};

function buildClient(): PrismaClient {
  // ⚠️ TEMPORAL (debug F1.8): con ALTOQUE_DIAG=1 se registra cada operación
  // Prisma (duración, sin SQL ni parámetros) para localizar la query de
  // signup que no termina. El diagnóstico también está bloqueado en Production.
  const diag = diagEnabled();

  const client = new PrismaClient({
    // `omit` no existe en el client estándar de v6: los campos sensibles
    // (p. ej. account.password) se excluyen mediante select/explícitos
    // en cada serializer del API (server/lib/envelope.ts).
    log: diag
      ? [
          { emit: "event", level: "query" },
          { emit: "event", level: "warn" },
          { emit: "event", level: "error" },
        ]
      : process.env.NODE_ENV === "development"
        ? [{ emit: "event", level: "warn" }, { emit: "event", level: "error" }]
        : [{ emit: "event", level: "error" }],
  });

  if (diag) {
    client.$on("query", (e) => {
      log.info("[diag][prisma:query]", {
        durationMs: e.duration,
      });
    });
    client.$on("warn", () => log.warn("[diag][prisma:warn]", { errorType: "PrismaWarning" }));
    client.$on("error", () => log.error("[diag][prisma:error]", { errorType: "PrismaEngineError" }));

    // ⚠️ TEMPORAL (debug F1.8): SELF-TEST — ejecuta SELECT 1 al arrancar el
    // módulo y registra el resultado. Responde directamente la pregunta
    // "¿los eventos [prisma:query] disparan en este runtime/versión?":
    //  - si aparece "[diag][prisma:selftest] SELECT 1 ok" Y su
    //    "[diag][prisma:query] SELECT 1", el pipeline de eventos funciona y
    //    el silencio posterior en signup = la query del signup no completó
    //    (o el adapter nunca la pidió).
    //  - si el self-test falla, el problema es de conexión/engine en frío.
    // No bloquea el cold start (fire-and-forget) y un fallo se registra sin
    // romper el módulo.
    const t0 = Date.now();
    client
      .$queryRaw`SELECT 1`
      .then(() => log.info("[diag][prisma:selftest] SELECT 1 ok", { durationMs: Date.now() - t0 }))
      .catch((e: unknown) =>
        log.error("[diag][prisma:selftest] failed", {
          durationMs: Date.now() - t0,
          errorType: e instanceof Error ? e.name : "UnknownError",
        }),
      );
  }

  return client;
}

export const prisma: PrismaClient = globalForPrisma.__altoquePrisma ?? buildClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__altoquePrisma = prisma;
}

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
