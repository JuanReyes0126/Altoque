/**
 * ALTOQUE · Instancia de Better Auth (F1.2)
 *
 * Better Auth 1.7.1 es la fuente de verdad de user/session/account/
 * verification. NO hay hashing casero de session.token ni estructuras
 * paralelas (Addendum §1).
 *
 * Verificado contra los tipos instalados (1.7.1 / @better-auth/core):
 *   ✓ emailAndPassword.requireEmailVerification
 *   ✓ emailVerification.autoSignInAfterVerification  (la sesión se emite
 *     al verificar el correo — el no-verificado no tiene sesión válida)
 *   ✓ verification.storeIdentifier: "hashed"
 *   ✓ user.additionalFields.* con input:false (el cliente NO puede
 *     enviar role/status en el registro)
 *   ✓ prismaAdapter desde "better-auth/adapters/prisma"
 *
 * Contraseñas: scrypt, gestionado internamente por Better Auth
 * (decisión Addendum §17 — no se reemplaza su criptografía).
 */
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
// Funciones de hashing POR DEFECTO de la propia librería (mismo algoritmo
// y parámetros que usaría sin nuestra configuración — solo las envolvemos
// para medir su duración durante el debug F1.8).
import { hashPassword as baHashPassword, verifyPassword as baVerifyPassword } from "better-auth/crypto";
import { prisma } from "../database/prisma.js";
import { canonicalOrigin, env, isProd, trustedOrigins } from "../config/env.js";
import { diagEnabled, stage, withDiagAdapter } from "../lib/diag.js";
import { resetPasswordEmail, verificationEmail } from "./email.js";

const e = env();

// ⚠️ TEMPORAL (debug F1.8): confirma que ESTE módulo instrumentado fue el
// que cargó (si no aparece en el cold start, el snapshot desplegado NO
// incluye la instrumentación — descartamos "probaron código viejo").
stage("[diag] auth module loading", { diag: diagEnabled() });

// ⚠️ TEMPORAL (debug F1.8): con ALTOQUE_DIAG=1 se envuelve el adapter para
// ver cada operación de BD que Better Auth realiza (op + model + duración).
const baseAdapterFactory = prismaAdapter(prisma, { provider: "postgresql" });
const database = diagEnabled() ? withDiagAdapter(baseAdapterFactory) : baseAdapterFactory;
stage("[diag] database adapter prepared", { wrapped: diagEnabled() });

export const auth = betterAuth({
  // Dinámico: APP_URL (prod) → VERCEL_URL (cada Preview) → localhost (dev).
  baseURL: canonicalOrigin(),
  basePath: "/api/v1/auth",
  secret: e.BETTER_AUTH_SECRET,
  database,
  trustedOrigins: trustedOrigins(),

  // ⚠️ TEMPORAL (debug F1.8): hooks GLOBALES de request de Better Auth —
  // el PRIMER checkpoint dentro de la librería para cada petición, antes
  // de leer el body, antes de rate-limit, antes de cualquier BD.
  // Solo registran path/method (sin PII); no alteran el flujo.
  hooks: {
    before: async (ctx) => {
      stage("[diag][ba:hook] request.before", {
        path: typeof ctx.path === "string" ? ctx.path : undefined,
        method: typeof ctx.method === "string" ? ctx.method : undefined,
      });
    },
    after: async (ctx) => {
      stage("[diag][ba:hook] request.after", {
        path: typeof ctx.path === "string" ? ctx.path : undefined,
      });
    },
  },

  // ⚠️ TEMPORAL (debug F1.8): hooks de BD de Better Auth — puntos de
  // instrumentación oficiales de la librería. Solo registran etapas;
  // `before` devuelve undefined (= "continuar sin cambios") y `after`
  // no devuelve nada, así que NO alteran el comportamiento.
  databaseHooks: {
    user: {
      create: {
        before: async () => { stage("[diag][ba:hook] user.create.before"); },
        after: async () => { stage("[diag][ba:hook] user.create.after"); },
      },
    },
    account: {
      create: {
        before: async () => { stage("[diag][ba:hook] account.create.before"); },
        after: async () => { stage("[diag][ba:hook] account.create.after"); },
      },
    },
    verification: {
      create: {
        before: async () => { stage("[diag][ba:hook] verification.create.before"); },
        after: async () => { stage("[diag][ba:hook] verification.create.after"); },
      },
    },
    session: {
      create: {
        before: async () => { stage("[diag][ba:hook] session.create.before"); },
        after: async () => { stage("[diag][ba:hook] session.create.after"); },
      },
    },
  },

  // ⚠️ TEMPORAL (debug F1.8): envolvemos las funciones de hashing POR
  // DEFECTO de Better Auth con logs start/done. Mismo algoritmo y
  // parámetros — solo medimos duración. NUNCA se registra la contraseña
  // ni el hash.
  password: {
    hash: async (password: string) => {
      stage("[diag][ba:password] hash → start");
      const t0 = Date.now();
      const hash = await baHashPassword(password);
      stage("[diag][ba:password] hash → done", { durationMs: Date.now() - t0 });
      return hash;
    },
    verify: async (data: { hash: string; password: string }) => {
      stage("[diag][ba:password] verify → start");
      const t0 = Date.now();
      const ok = await baVerifyPassword(data);
      stage("[diag][ba:password] verify → done", { durationMs: Date.now() - t0 });
      return ok;
    },
  },

  advanced: {
    // Cookies: HttpOnly + SameSite=Lax (default de Better Auth) +
    // Secure cuando el origen es https (producción/preview).
    // La protección CSRF la completa la validación de Origen en
    // server/middleware/security.ts (Addendum §7).
    useSecureCookies: isProd(),
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 días
    updateAge: 60 * 60 * 24,     // renovación diaria si hay actividad
  },

  user: {
    additionalFields: {
      // input:false ⇒ signUpEmail IGNORA estos campos si el cliente los envía.
      role: { type: "string", required: true, defaultValue: "customer", input: false },
      status: { type: "string", required: true, defaultValue: "active", input: false },
      phone: { type: "string", required: false },
    },
  },

  emailVerification: {
    // Flujo aprobado: registro → cuenta no verificada (sin sesión) →
    // email → verificación → auto-login emite la primera sesión válida.
    autoSignInAfterVerification: true,
    sendVerificationEmail: verificationEmail,
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    sendResetPassword: resetPasswordEmail,
  },

  verification: {
    // Identificadores de verificación/reset almacenados hasheados
    // (soportado en 1.7.1 — verificado en init-options.d.mts).
    storeIdentifier: "hashed",
  },
});

// ⚠️ TEMPORAL (debug F1.8): betterAuth() completó su configuración.
stage("[diag][ba] instance created (hooks · adapter · password wrappers wired)");

// ⚠️ TEMPORAL (debug F1.8): confirma que la construcción de la instancia
// Better Auth terminó en el cold start (corre una vez por función).
stage("[diag] betterAuth() configured");

/** Tipos inferidos de la instancia para el resto del servidor. */
export type AuthSession = typeof auth.$Infer.Session;
