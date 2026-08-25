/**
 * ALTOQUE · Setup de tests (F1.6)
 *
 * Permite importar el app en tests SIN base de datos viva (valores dummy
 * que nunca se usan para conectar). Los tests de integración reales se
 * activan explícitamente con:
 *
 *   ALTOQUE_TEST_DB=1 \
 *   DATABASE_URL="postgresql://…(rama DEV)…?pgbouncer=true" \
 *   BETTER_AUTH_SECRET="…32+ chars…" \
 *   npx vitest run
 *
 * Producción NUNCA se usa para tests.
 */
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/altoque_test?pgbouncer=true";
process.env.BETTER_AUTH_SECRET ??= "altoque-test-secret-altoque-test-secret-32";
process.env.APP_URL ??= "http://localhost:3000";
process.env.NODE_ENV ??= "test";

export const HAS_DB = process.env.ALTOQUE_TEST_DB === "1";
