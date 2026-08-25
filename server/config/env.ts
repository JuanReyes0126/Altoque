/**
 * ALTOQUE · Validación de entorno (F1.5)
 * Fail-fast: si falta una variable SERVER-ONLY, el proceso arranca con
 * un error legible en vez de fallar a mitad de request.
 * Ninguna de estas variables se expone jamás al frontend (no llevan
 * prefijo VITE_).
 */
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /** Neon pooled (?pgbouncer=true) — runtime */
  DATABASE_URL: z.string().min(10, "DATABASE_URL debe ser la URL pooled de Neon"),
  /** Neon direct — solo CLI/migraciones (prisma.config.ts) */
  DIRECT_DATABASE_URL: z.string().optional(),

  /** Secreto de Better Auth (≥32 chars). SERVER ONLY. */
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET debe tener ≥32 caracteres"),
  /** Origen canónico: https://altoque… (sin barra final) */
  APP_URL: z.string().url().default("http://localhost:3000"),

  /** Orígenes extra confiables (p. ej. previews), separados por coma */
  EXTRA_TRUSTED_ORIGINS: z.string().optional(),

  /** Seed del super admin (solo dev/CI) */
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),

  /** Vercel Blob — se exige en F2/F3 cuando se activen uploads */
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  BLOB_PRIVATE_READ_WRITE_TOKEN: z.string().optional(),

  /** Email transaccional — en dev se imprime en consola */
  EMAIL_FROM: z.string().default("Altoque <no-reply@altoque.do>"),
  RESEND_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(`[altoque] Configuración de entorno inválida:\n${issues}`);
    throw new Error("INVALID_ENV");
  }
  cached = parsed.data;
  return cached;
}

export const isProd = () => env().NODE_ENV === "production";

export function trustedOrigins(): string[] {
  const e = env();
  const extra = (e.EXTRA_TRUSTED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return [e.APP_URL, ...extra];
}
