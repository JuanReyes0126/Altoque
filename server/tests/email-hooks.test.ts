/** Better Auth real + adapter en memoria; ningún envío o acceso a BD externo. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter, type MemoryDB } from "better-auth/adapters/memory";
import type { PrismaClient } from "@prisma/client";
import { createEmailDeliveryHooks } from "../auth/email-hooks.js";
import { EmailDeliveryError } from "../auth/email.js";

const transport = vi.hoisted(() => ({ configured: true }));
vi.mock("../auth/email.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../auth/email.js")>(),
  assertEmailConfigured: () => {
    if (!transport.configured) throw new Error("not configured");
    return { apiKey: "test-only", from: "test@example.com" };
  },
}));

describe("Hooks de email · errores observables e independencia de requests", () => {
  const password = "TestPassword123!";
  const origin = "http://localhost:3000";
  let database: MemoryDB;
  const delivered = new Map<string, string>();
  const rates = new Map<string, number>();

  beforeEach(() => {
    transport.configured = true;
    database = { user: [], account: [], session: [], verification: [] };
    delivered.clear(); rates.clear();
  });

  function instance(failingEmail?: string, resetFails = false) {
    const limitDB = { $queryRaw: async (_sql: TemplateStringsArray, bucket: string, subject: string) => {
      const key = `${bucket}:${subject}`;
      const count = (rates.get(key) ?? 0) + 1;
      rates.set(key, count);
      return [{ count }];
    } } as unknown as PrismaClient;
    const send = async ({ user, token }: { user: { email: string }; token: string }) => {
      if (user.email === failingEmail) throw new EmailDeliveryError("EMAIL_DELIVERY_FAILED");
      delivered.set(user.email, token);
    };
    const auth = betterAuth({
      baseURL: origin, basePath: "/api/v1/auth",
      secret: "test-only-email-hook-secret-at-least-32-chars",
      database: memoryAdapter(database),
      trustedOrigins: [origin], logger: { disabled: true },
      hooks: createEmailDeliveryHooks(limitDB),
      emailVerification: { autoSignInAfterVerification: true, sendVerificationEmail: send },
      emailAndPassword: { enabled: true, requireEmailVerification: true,
        sendResetPassword: async () => { if (resetFails) throw new EmailDeliveryError("EMAIL_DELIVERY_FAILED"); },
      },
    });
    return { auth, send };
  }

  async function code(action: Promise<unknown>): Promise<string | undefined> {
    try { await action; } catch (error) { return (error as { body?: { code?: string } }).body?.code; }
  }

  it("registro → correo → verificación → sesión conserva Better Auth como fuente", async () => {
    const { auth } = instance();
    const email = "success@example.com";
    const result = await auth.api.signUpEmail({ body: { name: "Cliente", email, password } });
    expect(result.token === null).toBe(true);
    expect(database.user[0].emailVerified).toBe(false);
    expect(database.session.length).toBe(0);
    expect(await code(auth.api.signInEmail({ body: { email, password } }))).toBe("EMAIL_NOT_VERIFIED");
    const token = delivered.get(email);
    if (!token) throw new Error("No se capturó el correo");
    await auth.api.verifyEmail({ query: { token } });
    expect(database.user[0].emailVerified).toBe(true);
    const login = await auth.api.signInEmail({ body: { email, password } });
    expect(login.user.emailVerified).toBe(true);
  });

  it("HTTP devuelve 503 si falla el correo; no crea sesión ni finge éxito", async () => {
    const email = "failure@example.com";
    const { auth } = instance(email);
    const response = await auth.handler(new Request(`${origin}/api/v1/auth/sign-up/email`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ name: "Cliente", email, password }),
    }));
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.code).toBe("VERIFICATION_EMAIL_FAILED");
    expect(database.user.length).toBe(1);
    expect(database.user[0].emailVerified).toBe(false);
    expect(database.session.length).toBe(0);
  });

  it("sin configuración no crea cuenta; cuerpo inválido conserva 400", async () => {
    transport.configured = false;
    const { auth } = instance();
    expect(await code(auth.api.signUpEmail({ body: { name: "Cliente", email: "missing@example.com", password } })))
      .toBe("EMAIL_NOT_CONFIGURED");
    expect(database.user.length).toBe(0);
    const response = await auth.handler(new Request(`${origin}/api/v1/auth/sign-up/email`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: "{}",
    }));
    expect(response.status).toBe(400);
  });

  it("fallos de correo no contaminan un registro concurrente ni auth.options", async () => {
    const failedEmail = "concurrent-failure@example.com";
    const goodEmail = "concurrent-success@example.com";
    const { auth, send } = instance(failedEmail);
    const results = await Promise.all([
      code(auth.api.signUpEmail({ body: { name: "Fallo", email: failedEmail, password } })),
      code(auth.api.signUpEmail({ body: { name: "Éxito", email: goodEmail, password } })),
    ]);
    expect(results).toEqual(["VERIFICATION_EMAIL_FAILED", undefined]);
    expect(delivered.has(failedEmail)).toBe(false);
    expect(delivered.has(goodEmail)).toBe(true);
    expect(auth.options.emailVerification?.sendVerificationEmail === send).toBe(true);
    expect(database.session.length).toBe(0);
  });

  it("reenvío conserva fallos y limita a tres requests por 15 minutos", async () => {
    const email = "resend@example.com";
    const { auth } = instance(email);
    await code(auth.api.signUpEmail({ body: { name: "Cliente", email, password } }));
    for (let attempt = 0; attempt < 3; attempt++) {
      expect(await code(auth.api.sendVerificationEmail({ body: { email } }))).toBe("EMAIL_DELIVERY_FAILED");
    }
    expect(await code(auth.api.sendVerificationEmail({ body: { email } }))).toBe("RATE_LIMITED");
  });

  it("reset no devuelve éxito ficticio si falla el transporte", async () => {
    const { auth } = instance(undefined, true);
    const email = "reset@example.com";
    await auth.api.signUpEmail({ body: { name: "Cliente", email, password } });
    expect(await code(auth.api.requestPasswordReset({ body: { email } }))).toBe("EMAIL_DELIVERY_FAILED");
  });

  it("la IP enviada por Vercel limita registros aunque cambien email y x-forwarded-for", async () => {
    const { auth } = instance();
    const outcomes = await Promise.all(Array.from({ length: 6 }, (_, index) => auth.handler(new Request(
      `${origin}/api/v1/auth/sign-up/email`, {
        method: "POST", headers: { "Content-Type": "application/json", Origin: origin,
          "x-vercel-forwarded-for": "192.0.2.25", "x-forwarded-for": `192.0.2.${index + 1}` },
        body: JSON.stringify({ name: "Cliente", email: `ip-${index}@example.com`, password }),
      },
    ))));
    expect(outcomes.filter((outcome) => outcome.status === 200).length).toBe(5);
    expect(outcomes.filter((outcome) => outcome.status === 429).length).toBe(1);
    const rejected = outcomes.find((outcome) => outcome.status === 429);
    expect((await rejected?.json()).code).toBe("RATE_LIMITED");
    expect(database.user.length).toBe(5);
  });

  it("login funciona sin configuración de correo y bloquea el undécimo intento", async () => {
    const { auth } = instance();
    const email = "login-limit@example.com";
    await auth.api.signUpEmail({ body: { name: "Cliente", email, password } });
    const token = delivered.get(email);
    if (!token) throw new Error("No se capturó el correo");
    await auth.api.verifyEmail({ query: { token } });
    transport.configured = false;
    expect((await auth.api.signInEmail({ body: { email, password } })).user.emailVerified).toBe(true);
    for (let attempt = 1; attempt < 10; attempt++) {
      expect(await code(auth.api.signInEmail({ body: { email, password: "WrongFixture123!" } }))).toBe("INVALID_EMAIL_OR_PASSWORD");
    }
    expect(await code(auth.api.signInEmail({ body: { email: email.toUpperCase(), password } }))).toBe("RATE_LIMITED");
  });
});
