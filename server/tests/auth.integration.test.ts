/** Autenticación real de Better Auth sobre una base exclusiva de tests. */
import { afterAll, describe, expect, it, vi } from "vitest";
import { auth } from "../auth/auth.js";
import { app } from "../index.js";
import { prisma } from "../database/prisma.js";
import { ulid } from "../lib/ids.js";
import { HAS_DB } from "./setup";
import { testHeaders } from "./session-helpers.js";
import { emailLimitSubject } from "../auth/rate-limit.js";

// Capturamos los emails en memoria: no se envían ni se imprimen enlaces/tokens.
const delivered = vi.hoisted(() => ({
  verification: new Map<string, string>(),
  reset: new Map<string, string>(),
  failedVerification: new Set<string>(),
  failedReset: new Set<string>(),
  configured: true,
}));
vi.mock("../auth/email.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../auth/email.js")>(),
  assertEmailConfigured: () => {
    if (!delivered.configured) throw new Error("not configured");
    return { apiKey: "test-only", from: "test@example.com" };
  },
  verificationEmail: async ({ user, token }: { user: { email: string }; token: string }) => {
    if (delivered.failedVerification.has(user.email)) throw new Error("transport failed");
    delivered.verification.set(user.email, token);
  },
  resetPasswordEmail: async ({ user, token }: { user: { email: string }; token: string }) => {
    delivered.reset.set(user.email, token);
    if (delivered.failedReset.has(user.email)) throw new Error("transport failed");
  },
}));

describe.runIf(HAS_DB)("Auth · integración aislada", () => {
  const createdEmails: string[] = [];
  const password = "Password123!";

  afterAll(async () => {
    try {
      // verification no tiene FK: limpiar resets pendientes si un test falla.
      const context = await auth.$context;
      for (const token of delivered.reset.values()) {
        await context.internalAdapter.deleteVerificationByIdentifier(`reset-password:${token}`);
      }
      if (createdEmails.length > 0) {
        await prisma.rate_limit.deleteMany({ where: {
          subject: { in: createdEmails.map((email) => emailLimitSubject(email, context.secret)) },
        } });
        await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
      }
    } finally {
      delivered.verification.clear();
      delivered.reset.clear();
      delivered.failedVerification.clear();
      delivered.failedReset.clear();
      await prisma.$disconnect();
    }
  });

  function uniqueEmail(tag: string) {
    const email = `${tag}-${ulid()}@test.altoque.do`.toLowerCase();
    createdEmails.push(email);
    return email;
  }

  function deliveredToken(kind: "verification" | "reset", email: string) {
    const token = delivered[kind].get(email);
    if (!token) throw new Error(`No se recibió el email de ${kind}`);
    return token;
  }

  async function expectAuthFailure(action: Promise<unknown>, expectedCode: string) {
    let rejected = false;
    let code: unknown;
    try {
      await action;
    } catch (error) {
      rejected = true;
      code = (error as { body?: { code?: unknown } }).body?.code;
    }
    // Afirmar solo booleanos/códigos evita mostrar sesiones o tokens si falla.
    expect(rejected).toBe(true);
    expect(code).toBe(expectedCode);
  }

  async function emittedCookie(headers: Headers) {
    const { authCookies } = await auth.$context;
    const cookie = headers.getSetCookie().find((value) =>
      value.startsWith(`${authCookies.sessionToken.name}=`),
    );
    if (!cookie) throw new Error("Better Auth no emitió una cookie de sesión");
    return cookie.split(";")[0];
  }

  async function signupAndVerify(tag: string) {
    const email = uniqueEmail(tag);
    const signup = await auth.api.signUpEmail({ body: { name: tag, email, password } });
    expect(signup.token === null).toBe(true);
    const verified = await auth.api.verifyEmail({
      query: { token: deliveredToken("verification", email) },
    });
    if (!verified) throw new Error("La verificación no devolvió un resultado");
    expect(verified.status).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.emailVerified).toBe(true);
    return { email, user };
  }

  async function login(email: string, loginPassword = password) {
    const result = await auth.api.signInEmail({
      body: { email, password: loginPassword },
      returnHeaders: true,
    });
    const cookie = await emittedCookie(result.headers);
    const session = await auth.api.getSession({ headers: new Headers(testHeaders(cookie)) });
    if (!session) throw new Error("La cookie emitida no autentica una sesión válida");
    return { cookie, session };
  }

  it("signup con role:'admin' en el body NO crea admin", async () => {
    const email = uniqueEmail("admin-esc");
    const result = await auth.api.signUpEmail({
      body: { name: "Escalada", email, password, role: "admin" } as never,
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.role).toBe("customer");
    expect(result.user.role).toBe("customer");
  });

  it("signup con role:'super_admin' tampoco", async () => {
    const email = uniqueEmail("super-esc");
    await auth.api.signUpEmail({
      body: { name: "Super Escalada", email, password, role: "super_admin" } as never,
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.role).toBe("customer");
  });

  it("cuenta no verificada no obtiene sesión al registrarse ni al iniciar sesión", async () => {
    const email = uniqueEmail("unver");
    const result = await auth.api.signUpEmail({
      body: { name: "No Verificado", email, password },
      returnHeaders: true,
    });
    expect(result.response.token === null).toBe(true);
    expect(await prisma.session.count({ where: { userId: result.response.user.id } })).toBe(0);
    const { authCookies } = await auth.$context;
    expect(result.headers.getSetCookie().some((cookie) =>
      cookie.startsWith(`${authCookies.sessionToken.name}=`),
    )).toBe(false);
    await expectAuthFailure(auth.api.signInEmail({ body: { email, password } }), "EMAIL_NOT_VERIFIED");
    expect(await prisma.session.count({ where: { userId: result.response.user.id } })).toBe(0);
  });

  it("GET del perfil autenticado no permite cachear datos privados", async () => {
    const { email } = await signupAndVerify("private-cache");
    const { cookie } = await login(email);
    const response = await app.request("/api/v1/me", { headers: testHeaders(cookie) });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it.each(["suspended", "blocked"] as const)("login de cuenta %s no emite sesión ni modifica la credencial", async (status) => {
    const { email, user } = await signupAndVerify(`inactive-${status}`);
    await prisma.session.deleteMany({ where: { userId: user.id } });
    const before = await prisma.account.findFirstOrThrow({ where: { userId: user.id, providerId: "credential" }, select: { password: true } });
    await prisma.user.update({ where: { id: user.id }, data: { status } });
    await expectAuthFailure(auth.api.signInEmail({ body: { email, password } }), "ACCOUNT_INACTIVE");
    const response = await app.request("/api/v1/auth/sign-in/email", {
      method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("ACCOUNT_INACTIVE");
    const { authCookies } = await auth.$context;
    expect(response.headers.getSetCookie().some((cookie) => cookie.startsWith(`${authCookies.sessionToken.name}=`))).toBe(false);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    const after = await prisma.account.findFirstOrThrow({ where: { userId: user.id, providerId: "credential" }, select: { password: true } });
    expect(after.password === before.password).toBe(true);
  });

  it.each(["suspended", "blocked"] as const)("verificar una cuenta %s conserva la verificación de Better Auth sin autorizar auto-login", async (status) => {
    const email = uniqueEmail(`verify-inactive-${status}`);
    await auth.api.signUpEmail({ body: { name: "Inactive fixture", email, password } });
    const user = await prisma.user.update({ where: { email }, data: { status } });
    await expectAuthFailure(auth.api.verifyEmail({ query: { token: deliveredToken("verification", email) } }), "ACCOUNT_INACTIVE");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified).toBe(true);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    await expectAuthFailure(auth.api.signInEmail({ body: { email, password } }), "ACCOUNT_INACTIVE");
  });

  it("una sesión inicialmente válida es rechazada después de expirar", async () => {
    const { email, user } = await signupAndVerify("expire");
    const { cookie, session } = await login(email);
    expect(session.user.id).toBe(user.id);
    await prisma.session.update({
      where: { id: session.session.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const expired = await auth.api.getSession({ headers: new Headers(testHeaders(cookie)) });
    expect(expired === null).toBe(true);
  });

  it("logout elimina una sesión inicialmente válida y la cookie deja de autenticar", async () => {
    const { email, user } = await signupAndVerify("revoke");
    const { cookie, session } = await login(email);
    expect(session.user.id).toBe(user.id);
    const result = await auth.api.signOut({ headers: new Headers(testHeaders(cookie)) });
    expect(result.success).toBe(true);
    expect(await prisma.session.count({ where: { id: session.session.id } })).toBe(0);
    const revoked = await auth.api.getSession({ headers: new Headers(testHeaders(cookie)) });
    expect(revoked === null).toBe(true);
  });

  it("el JWT enviado por email se rechaza después de su vencimiento", async () => {
    const email = uniqueEmail("vexp");
    await auth.api.signUpEmail({ body: { name: "V Exp", email, password } });
    const token = deliveredToken("verification", email);
    // Altoque configura explícitamente 3600 segundos, igual que el texto enviado.
    const future = Date.now() + (3600 + 60) * 1000;
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(future);
      await expectAuthFailure(auth.api.verifyEmail({ query: { token } }), "TOKEN_EXPIRED");
    } finally {
      vi.useRealTimers();
    }
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.emailVerified).toBe(false);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("reset token de un solo uso: segundo intento falla y la contraseña nueva funciona", async () => {
    const { email } = await signupAndVerify("reset");
    const { cookie: priorCookie } = await login(email);
    const requested = await auth.api.requestPasswordReset({
      body: { email, redirectTo: "http://localhost:3000/reset" },
    });
    expect(requested.status).toBe(true);
    const token = deliveredToken("reset", email);
    const reset = await auth.api.resetPassword({ body: { token, newPassword: "NewPassword123!" } });
    expect(reset.status).toBe(true);
    const staleSession = await auth.api.getSession({ headers: new Headers(testHeaders(priorCookie)) });
    expect(staleSession === null).toBe(true);
    const resetUser = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(await prisma.session.count({ where: { userId: resetUser.id } })).toBe(0);
    await expectAuthFailure(
      auth.api.resetPassword({ body: { token, newPassword: "OtherPassword123!" } }), "INVALID_TOKEN",
    );
    await login(email, "NewPassword123!");
    await expectAuthFailure(auth.api.signInEmail({ body: { email, password } }), "INVALID_EMAIL_OR_PASSWORD");
  });

  it("fallo de verificación conserva cuenta no verificada y reenvío permite recuperarla", async () => {
    const email = uniqueEmail("delivery-recovery");
    delivered.failedVerification.add(email);
    await expectAuthFailure(auth.api.signUpEmail({ body: { name: "Cliente", email, password } }), "VERIFICATION_EMAIL_FAILED");
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.emailVerified).toBe(false);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    delivered.failedVerification.delete(email);
    expect((await auth.api.sendVerificationEmail({ body: { email } })).status).toBe(true);
    await auth.api.verifyEmail({ query: { token: deliveredToken("verification", email) } });
    expect((await prisma.user.findUniqueOrThrow({ where: { email } })).emailVerified).toBe(true);
    await login(email);
  });

  it("límite durable de reenvío resiste requests concurrentes y casing del email", async () => {
    const email = uniqueEmail("resend-limit");
    await auth.api.signUpEmail({ body: { name: "Cliente", email, password } });
    const outcomes = await Promise.allSettled(Array.from({ length: 5 }, (_, index) =>
      auth.api.sendVerificationEmail({ body: { email: index % 2 ? email.toUpperCase() : email } }),
    ));
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled").length).toBe(3);
    const codes = outcomes.flatMap((outcome) => outcome.status === "rejected"
      ? [(outcome.reason as { body?: { code?: string } }).body?.code] : []);
    expect(codes).toEqual(["RATE_LIMITED", "RATE_LIMITED"]);
    const context = await auth.$context;
    const row = await prisma.rate_limit.findUniqueOrThrow({ where: { bucket_subject: {
      bucket: "auth:resend", subject: emailLimitSubject(email, context.secret),
    } } });
    expect(row.count).toBe(4);
  });

  it("dos registros concurrentes no comparten estado de entrega", async () => {
    const failed = uniqueEmail("concurrent-failed");
    const success = uniqueEmail("concurrent-ok");
    delivered.failedVerification.add(failed);
    const outcomes = await Promise.allSettled([
      auth.api.signUpEmail({ body: { name: "Fallo", email: failed, password } }),
      auth.api.signUpEmail({ body: { name: "Éxito", email: success, password } }),
    ]);
    expect(outcomes.map((outcome) => outcome.status)).toEqual(["rejected", "fulfilled"]);
    expect(delivered.verification.has(success)).toBe(true);
    expect(delivered.verification.has(failed)).toBe(false);
    delivered.failedVerification.delete(failed);
  });

  it("sin configuración signup falla antes de crear el usuario", async () => {
    const email = uniqueEmail("missing-config");
    delivered.configured = false;
    try {
      await expectAuthFailure(auth.api.signUpEmail({ body: { name: "Cliente", email, password } }), "EMAIL_NOT_CONFIGURED");
      expect(await prisma.user.count({ where: { email } })).toBe(0);
    } finally { delivered.configured = true; }
  });

  it("fallo de reset se devuelve como error sin autorizar sesión", async () => {
    const { email, user } = await signupAndVerify("reset-delivery");
    delivered.failedReset.add(email);
    await expectAuthFailure(auth.api.requestPasswordReset({ body: { email } }), "EMAIL_DELIVERY_FAILED");
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1); // auto-login al verificar, sin nueva sesión por reset
    delivered.failedReset.delete(email);
  });

  it("login limita fallos a diez por cinco minutos sin depender del correo", async () => {
    const { email } = await signupAndVerify("login-limit");
    delivered.configured = false;
    try {
      await login(email);
      for (let attempt = 1; attempt < 10; attempt++) {
        await expectAuthFailure(auth.api.signInEmail({ body: { email, password: "WrongFixture123!" } }), "INVALID_EMAIL_OR_PASSWORD");
      }
      await expectAuthFailure(auth.api.signInEmail({ body: { email: email.toUpperCase(), password } }), "RATE_LIMITED");
    } finally { delivered.configured = true; }
  });
});
