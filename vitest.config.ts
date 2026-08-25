/**
 * ALTOQUE · Configuración de tests (F1.6)
 * Separada de vite.config.ts (que no se toca).
 *
 *   npx vitest run
 *
 * Los tests de integración requieren DATABASE_URL (rama DEV de Neon);
 * sin ella se omiten automáticamente (describe.runIf).
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["server/tests/**/*.test.ts"],
    setupFiles: ["server/tests/setup.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: "forks",
    fileParallelism: false, // la BD de dev es compartida: serializa suites
  },
});
