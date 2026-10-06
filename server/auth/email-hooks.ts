/** Hooks oficiales: errores de entrega visibles aunque Better Auth capture callbacks. */
import { APIError, createAuthMiddleware, getIP, requestPasswordReset, sendVerificationEmail, signInEmail, signUpEmail } from "better-auth/api";
import type { PrismaClient } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { assertEmailConfigured, EmailDeliveryError } from "./email.js";
import { authEmailRule, consumeEmailLimit } from "./rate-limit.js";

type FailureCode = "EMAIL_NOT_CONFIGURED" | "EMAIL_DELIVERY_FAILED";
type DeliveryContext = { emailDeliveryFailure?: () => FailureCode | undefined };

// La misma validación del endpoint instalado, sin duplicar sus reglas en Zod3.
const bodySchemas = {
  "/sign-in/email": signInEmail().options.body,
  "/sign-up/email": signUpEmail().options.body,
  "/send-verification-email": sendVerificationEmail.options.body,
  "/request-password-reset": requestPasswordReset.options.body,
  "/forget-password": requestPasswordReset.options.body,
};

function deliveryAPIError(code: FailureCode, signup: boolean): APIError {
  return new APIError("SERVICE_UNAVAILABLE", {
    code: signup && code !== "EMAIL_NOT_CONFIGURED" ? "VERIFICATION_EMAIL_FAILED" : code,
    message: code === "EMAIL_NOT_CONFIGURED"
      ? "El servicio de correo todavía no está configurado. Inténtalo más tarde."
      : signup
        ? "Tu cuenta fue creada, pero no pudimos enviar la verificación. Puedes reenviar el correo."
        : "No pudimos enviar el correo. Inténtalo de nuevo.",
  });
}

export function createEmailDeliveryHooks(db: PrismaClient) {
  return {
    before: createAuthMiddleware(async (ctx) => {
      const path = ctx.path ?? "";
      if (!authEmailRule(path)) return;
      const schema = bodySchemas[path as keyof typeof bodySchemas];
      // Permitir que Better Auth rechace cuerpos inválidos antes de usar BD o correo.
      if (!schema?.safeParse(ctx.body).success) return;
      if (path === "/sign-up/email" && (typeof ctx.body?.name !== "string"
        || typeof ctx.body?.password !== "string"
        || ctx.body.password.length < ctx.context.password.config.minPasswordLength
        || ctx.body.password.length > ctx.context.password.config.maxPasswordLength)) return;

      if (path !== "/sign-in/email") {
        try {
          assertEmailConfigured();
        } catch {
          throw deliveryAPIError("EMAIL_NOT_CONFIGURED", false);
        }
      }

      // Vercel sobrescribe este header. No confiar en x-forwarded-for del cliente.
      const ip = ctx.headers?.has("x-vercel-forwarded-for")
        ? getIP(ctx.headers, { advanced: { ipAddress: { ipAddressHeaders: ["x-vercel-forwarded-for"] } } })
        : undefined;
      try {
        await consumeEmailLimit(db, path, ctx.body.email, ctx.context.secret, ip);
      } catch (error) {
        if (error instanceof AppError && error.code === "RATE_LIMITED") {
          throw new APIError("TOO_MANY_REQUESTS", {
            code: "RATE_LIMITED", message: "Demasiados intentos. Espera unos minutos antes de reenviar.",
          });
        }
        throw error;
      }
      if (path === "/sign-in/email") return;

      // Options y estado NUEVOS por request, nunca mutar auth.options global.
      // BA1.7.1 atrapa fallos del callback de signup/reset; after los convierte
      // en error API. Capturarlos aquí también evita que BA imprima el error.
      let failure: FailureCode | undefined;
      const wrap = <Args extends unknown[]>(callback: ((...args: Args) => unknown) | undefined) =>
        callback ? async (...args: Args) => {
          try { await callback(...args); }
          catch (error) {
            failure = error instanceof EmailDeliveryError ? error.code : "EMAIL_DELIVERY_FAILED";
          }
        } : undefined;
      const options = ctx.context.options;
      return { context: { context: {
        emailDeliveryFailure: () => failure,
        options: {
          ...options,
          emailVerification: {
            ...options.emailVerification,
            sendVerificationEmail: wrap(options.emailVerification?.sendVerificationEmail),
          },
          emailAndPassword: options.emailAndPassword ? {
            ...options.emailAndPassword,
            sendResetPassword: wrap(options.emailAndPassword.sendResetPassword),
          } : undefined,
        },
      } } };
    }),
    after: createAuthMiddleware(async (ctx) => {
      const failure = (ctx.context as typeof ctx.context & DeliveryContext).emailDeliveryFailure?.();
      if (failure) throw deliveryAPIError(failure, ctx.path === "/sign-up/email");
    }),
  };
}
