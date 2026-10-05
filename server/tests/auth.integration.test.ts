/** Autenticación real de Better Auth sobre una base exclusiva de tests. */
import { afterAll, describe, expect, it, vi } from "vitest";
import { auth } from "../auth/auth.js";
import { prisma } from "../database/prisma.js";
import { ulid } from "../lib/ids.js";
import { HAS_DB } from "./setup";
import { testHeaders } from "./session-helpers.js";

// Capturamos los emails en memoria: no se envían ni se imprimen enlaces/tokens.
const delivered = vi.hoisted(() => ({
  verification: new Map<string, string>(),
  reset: new Map<string, string>(),
}));
vi.mock("../auth/email.js", () => ({
  verificationEmail: async ({ user, token }: { user: { email: string }; token: string }) => {
    delivered.verification.set(user.email, token);
  },
  resetPasswordEmail: async ({ user, token }: { user: { email: string }; token: string }) => {
    delivered.reset.set(user.email, token);
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
        await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
      }
    } finally {
      delivered.verification.clear();
      delivered.reset.clear();
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
    // Altoque no sobreescribe expiresIn; Better Auth usa 3600 segundos.
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
    const requested = await auth.api.requestPasswordReset({
      body: { email, redirectTo: "http://localhost:3000/reset" },
    });
    expect(requested.status).toBe(true);
    const token = deliveredToken("reset", email);
    const reset = await auth.api.resetPassword({ body: { token, newPassword: "NewPassword123!" } });
    expect(reset.status).toBe(true);
    await expectAuthFailure(
      auth.api.resetPassword({ body: { token, newPassword: "OtherPassword123!" } }), "INVALID_TOKEN",
    );
    await login(email, "NewPassword123!");
    await expectAuthFailure(auth.api.signInEmail({ body: { email, password } }), "INVALID_EMAIL_OR_PASSWORD");
  });
});
