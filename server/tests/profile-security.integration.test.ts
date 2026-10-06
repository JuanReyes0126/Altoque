/** Operaciones de seguridad de Better Auth, sin signup ni correo externo. */
import { createLocalAccountIssuer } from "better-auth/db";
import { hashPassword } from "better-auth/crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth } from "../auth/auth.js";
import { app } from "../index.js";
import { prisma } from "../database/prisma.js";
import { ulid } from "../lib/ids.js";
import { HAS_DB } from "./setup";
import { createTestCookie, testHeaders } from "./session-helpers.js";
import { emailLimitSubject } from "../auth/rate-limit.js";

describe.runIf(HAS_DB)("Seguridad del perfil · integración aislada", () => {
  const userIds: string[] = [];
  const originalPassword = "ProfileOriginal123!";
  const newPassword = "ProfileUpdated123!";
  let originalHash: string;

  beforeAll(async () => { originalHash = await hashPassword(originalPassword); });

  afterAll(async () => {
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { email: true } });
    const secret = (await auth.$context).secret;
    await prisma.rate_limit.deleteMany({ where: { subject: { in: users.map((user) => emailLimitSubject(user.email, secret)) } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  async function createAccount() {
    const userId = ulid();
    const user = await prisma.user.create({
      data: {
        // Better Auth normaliza el email a minúsculas antes de persistirlo.
        id: userId, name: "Security fixture", email: `security-profile-${ulid()}@test.altoque.do`.toLowerCase(), emailVerified: true,
        account: { create: { accountId: userId, providerId: "credential", issuer: createLocalAccountIssuer("credential"), password: originalHash } },
      },
    });
    userIds.push(userId);
    const currentCookie = await createTestCookie(userId);
    const otherCookie = await createTestCookie(userId);
    return { user, currentCookie, otherCookie };
  }

  async function post(path: string, cookie: string, body: unknown) {
    return app.request(`/api/v1/auth/${path}`, {
      method: "POST", headers: { ...testHeaders(cookie), "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
  }

  async function sessionExists(cookie: string) {
    const session = await auth.api.getSession({ headers: new Headers(testHeaders(cookie)) });
    return Boolean(session);
  }

  async function emittedCookie(response: Response) {
    const { authCookies } = await auth.$context;
    const cookie = response.headers.getSetCookie().find((value) => value.startsWith(`${authCookies.sessionToken.name}=`))?.split(";")[0];
    expect(Boolean(cookie)).toBe(true);
    if (!cookie) throw new Error("SECURITY_SESSION_COOKIE_MISSING");
    return cookie;
  }

  async function loginSucceeds(email: string, password: string) {
    try {
      await auth.api.signInEmail({ body: { email, password } });
      return true;
    } catch {
      return false;
    }
  }

  it("contraseña actual incorrecta no cambia credenciales ni revoca sesiones", async () => {
    const { user, currentCookie, otherCookie } = await createAccount();
    const response = await post("change-password", currentCookie, { currentPassword: "WrongFixture123!", newPassword, revokeOtherSessions: true });
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("INVALID_PASSWORD");
    const account = await prisma.account.findFirstOrThrow({ where: { userId: user.id, providerId: "credential" } });
    // Comparaciones booleanas impiden que un fallo imprima el hash o cookies.
    expect(account.password === originalHash).toBe(true);
    expect(await sessionExists(currentCookie)).toBe(true);
    expect(await sessionExists(otherCookie)).toBe(true);
    expect(await loginSucceeds(user.email.toUpperCase(), originalPassword)).toBe(true);
  });

  it("la contraseña nueva persiste y cambiarla cierra otras sesiones", async () => {
    const { user, currentCookie, otherCookie } = await createAccount();
    const response = await post("change-password", currentCookie, { currentPassword: originalPassword, newPassword, revokeOtherSessions: true });
    expect(response.status).toBe(200);
    const replacementCookie = await emittedCookie(response);
    const account = await prisma.account.findFirstOrThrow({ where: { userId: user.id, providerId: "credential" } });
    expect(account.password === originalHash).toBe(false);
    expect(await sessionExists(replacementCookie)).toBe(true);
    expect(await sessionExists(otherCookie)).toBe(false);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
    expect(await loginSucceeds(user.email, originalPassword)).toBe(false);
    expect(await loginSucceeds(user.email, newPassword)).toBe(true);
  });

  it("cerrar otras sesiones conserva la propia y no modifica otras cuentas", async () => {
    const first = await createAccount();
    const second = await createAccount();
    const response = await post("revoke-other-sessions", first.currentCookie, {});
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe(true);
    expect(await sessionExists(first.currentCookie)).toBe(true);
    expect(await sessionExists(first.otherCookie)).toBe(false);
    expect(await sessionExists(second.currentCookie)).toBe(true);
    expect(await sessionExists(second.otherCookie)).toBe(true);
    expect(await prisma.session.count({ where: { userId: first.user.id } })).toBe(1);
  });

  it("las operaciones sensibles sin sesión no cambian la cuenta", async () => {
    const { user } = await createAccount();
    const headers = { Origin: "http://localhost:3000", "Content-Type": "application/json" };
    for (const path of ["change-password", "revoke-other-sessions"]) {
      const response = await app.request(`/api/v1/auth/${path}`, {
        method: "POST", headers,
        body: JSON.stringify(path === "change-password" ? { currentPassword: originalPassword, newPassword } : {}),
      });
      expect(response.status).toBe(401);
    }
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(2);
    const account = await prisma.account.findFirstOrThrow({ where: { userId: user.id } });
    expect(account.password === originalHash).toBe(true);
  });
});
