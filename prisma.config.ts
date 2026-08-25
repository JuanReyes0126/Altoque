/**
 * Configuración del CLI de Prisma (Prisma ≥ 6.6).
 *
 * IMPORTANTE (Addendum §2): el CLI (migrate / db push / studio) usa la
 * conexión DIRECTA de Neon. El runtime usa la URL pooled (?pgbouncer=true)
 * definida en el datasource del schema. Production NUNCA se usa para
 * desarrollo: cada entorno apunta a su propia rama/base de Neon.
 *
 * El CLI de Prisma carga .env automáticamente antes de evaluar esta
 * configuración; en CI/producción las variables provienen del entorno.
 */
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "server/database/schema.prisma",
  datasource: {
    url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  },
});
