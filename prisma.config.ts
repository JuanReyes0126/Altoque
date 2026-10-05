/**
 * Configuración del CLI de Prisma (Prisma ≥ 6.6).
 *
 * IMPORTANTE (Addendum §2): el CLI (migrate / db push / studio) usa la
 * conexión DIRECTA de Neon. El runtime usa la URL pooled (?pgbouncer=true)
 * definida en el datasource del schema. Production NUNCA se usa para
 * desarrollo: cada entorno apunta a su propia rama/base de Neon.
 *
 * Con prisma.config.ts, Prisma 6 omite la carga automática de .env.
 * dotenv lo carga explícitamente sin reemplazar variables ya exportadas.
 */
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "server/database/schema.prisma",
  migrations: {
    path: "server/database/migrations",
  },
  datasource: {
    url: process.env.DIRECT_DATABASE_URL ?? "",
  },
});
