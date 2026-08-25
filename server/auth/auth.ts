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
import { prisma } from "../database/prisma";
import { canonicalOrigin, env, isProd, trustedOrigins } from "../config/env";
import { resetPasswordEmail, verificationEmail } from "./email";

const e = env();

export const auth = betterAuth({
  // Dinámico: APP_URL (prod) → VERCEL_URL (cada Preview) → localhost (dev).
  baseURL: canonicalOrigin(),
  basePath: "/api/v1/auth",
  secret: e.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  trustedOrigins: trustedOrigins(),

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

/** Tipos inferidos de la instancia para el resto del servidor. */
export type AuthSession = typeof auth.$Infer.Session;
