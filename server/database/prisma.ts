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

const globalForPrisma = globalThis as unknown as {
  __altoquePrisma?: PrismaClient;
};

function buildClient(): PrismaClient {
  // ⚠️ TEMPORAL (debug F1.8): con ALTOQUE_DIAG=1 se registra cada operación
  // Prisma (SQL con placeholders + duración) para localizar la query de
  // signup que no termina. NUNCA se registra `e.params` (contiene email,
  // hash de contraseña y demás valores sensibles).
  const diag = process.env.ALTOQUE_DIAG === "1";

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
        // SQL con placeholders ($1,$2…) — seguro. Truncado por precaución.
        sql: e.query.slice(0, 280),
      });
    });
    client.$on("warn", (e) => log.warn("[diag][prisma:warn]", { message: e.message }));
    client.$on("error", (e) => log.error("[diag][prisma:error]", { message: e.message }));
  }

  return client;
}

export const prisma: PrismaClient = globalForPrisma.__altoquePrisma ?? buildClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__altoquePrisma = prisma;
}

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
