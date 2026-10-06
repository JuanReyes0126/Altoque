/**
 * Offline: conexión dummy local, sin heredar credenciales.
 * Integración: npm run test:integration crea una DB local exclusiva.
 * Preview y Production nunca se usan para tests.
 */
import { managedTestDatabase } from "./test-database.js";

export const HAS_DB = process.env.ALTOQUE_TEST_DB === "1";
// Sustituir siempre DATABASE_URL: nunca conservar una conexión heredada.
process.env.DATABASE_URL = HAS_DB
  ? managedTestDatabase(process.env)
  : "postgresql://offline:offline@127.0.0.1:1/altoque_offline";
process.env.DIRECT_DATABASE_URL = process.env.DATABASE_URL;
process.env.BETTER_AUTH_SECRET = HAS_DB
  ? process.env.ALTOQUE_TEST_AUTH_SECRET ?? "altoque-test-secret-altoque-test-secret-32"
  : "altoque-test-secret-altoque-test-secret-32";
process.env.APP_URL = "http://localhost:3000";
process.env.NODE_ENV = "test";
for (const key of ["ALTOQUE_DIAG", "VERCEL_ENV", "VERCEL_URL", "EXTRA_TRUSTED_ORIGINS", "RESEND_API_KEY", "EMAIL_FROM", "BLOB_READ_WRITE_TOKEN", "BLOB_PRIVATE_READ_WRITE_TOKEN"]) delete process.env[key];
