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
  return new PrismaClient({
    // `omit` no existe en el client estándar de v6: los campos sensibles
    // (p. ej. account.password) se excluyen mediante select/explícitos
    // en cada serializer del API (server/lib/envelope.ts).
    log:
      process.env.NODE_ENV === "development"
        ? [{ emit: "event", level: "warn" }, { emit: "event", level: "error" }]
        : [{ emit: "event", level: "error" }],
  });
}

export const prisma: PrismaClient = globalForPrisma.__altoquePrisma ?? buildClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__altoquePrisma = prisma;
}

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
