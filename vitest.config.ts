/**
 * ALTOQUE · Configuración de tests (F1.6)
 * Separada de vite.config.ts (que no se toca).
 *
 *   npx vitest run
 *
 * npm run test:integration crea PostgreSQL local aislado por ejecución.
 * Sin ese runner se ejecutan solo los tests offline.
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
    fileParallelism: false, // suites seriales para comprobar cleanup y fixtures
  },
});
