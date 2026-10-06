/** Bootstrap y permisos reales exclusivamente en el runner PostgreSQL local. */
import { randomBytes } from "node:crypto";
import { createLocalAccountIssuer } from "better-auth/db";
import { afterAll, describe, expect, it } from "vitest";
import { auth } from "../auth/auth.js";
import { app } from "../index.js";
import { prisma } from "../database/prisma.js";
import { bootstrapAdmin } from "../database/seeds/admin.js";
import { ulid } from "../lib/ids.js";
import { HAS_DB } from "./setup";
import { testHeaders } from "./session-helpers.js";
import { managedTestDatabase } from "./test-database.js";
import { emailLimitSubject } from "../auth/rate-limit.js";

describe.runIf(HAS_DB)("Admin bootstrap · integración aislada", () => {
  const createdEmails: string[] = [];
  function credentials() {
    const email = `admin-bootstrap-${ulid()}@test.altoque.do`.toLowerCase();
    createdEmails.push(email);
    return { email, password: randomBytes(24).toString("hex") };
  }

  afterAll(async () => {
    managedTestDatabase(process.env);
    const users = await prisma.user.findMany({ where: { email: { in: createdEmails } }, select: { id: true } });
    const ids = users.map((user) => user.id);
    await prisma.admin_audit_log.deleteMany({ where: { actor_id: { in: ids } } });
    const secret = (await auth.$context).secret;
    await prisma.rate_limit.deleteMany({ where: { subject: { in: createdEmails.map((email) => emailLimitSubject(email, secret)) } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  async function login(credentials: { email: string; password: string }) {
    let result;
    try { result = await auth.api.signInEmail({ body: credentials, returnHeaders: true }); }
    catch { throw new Error("ADMIN_TEST_LOGIN_FAILED"); }
    const { authCookies } = await auth.$context;
    const cookie = result.headers.getSetCookie().find((value) => value.startsWith(`${authCookies.sessionToken.name}=`))?.split(";")[0];
    expect(Boolean(cookie)).toBe(true);
    if (!cookie) throw new Error("ADMIN_TEST_COOKIE_MISSING");
    return { cookie, userId: result.response.user.id };
  }

  it("crea cuenta BA verificada, login real y acceso administrativo efectivo", async () => {
    managedTestDatabase(process.env);
    const input = credentials();
    expect(await bootstrapAdmin(prisma, input)).toBe("created");
    const user = await prisma.user.findUniqueOrThrow({ where: { email: input.email }, include: { admin_profile: true, account: true } });
    expect(user.role).toBe("admin");
    expect(user.status).toBe("active");
    expect(user.emailVerified).toBe(true);
    expect(user.admin_profile?.admin_role).toBe("super_admin");
    expect(user.account.length).toBe(1);
    expect(user.account[0].accountId).toBe(user.id);
    expect(user.account[0].issuer).toBe(createLocalAccountIssuer("credential"));
    const logged = await login(input);
    expect(logged.userId).toBe(user.id);
    for (const path of ["metrics", "users", "audit"]) {
      expect((await app.request(`/api/v1/admin/${path}`, { headers: testHeaders(logged.cookie) })).status).toBe(200);
    }
    const repeatedPassword = randomBytes(24).toString("hex");
    expect(await bootstrapAdmin(prisma, { email: input.email, password: repeatedPassword })).toBe("already-provisioned");
    const repeated = await prisma.account.findMany({ where: { userId: user.id }, select: { password: true } });
    expect(repeated.length).toBe(1);
    expect(repeated[0].password === user.account[0].password).toBe(true);
    expect(await prisma.user.count({ where: { email: input.email } })).toBe(1);
    expect((await login(input)).userId).toBe(user.id);
    let replacementRejected = false;
    try { await auth.api.signInEmail({ body: { email: input.email, password: repeatedPassword } }); }
    catch { replacementRejected = true; }
    expect(replacementRejected).toBe(true);
  });

  it("una cuenta customer existente no se promueve ni se verifica automáticamente", async () => {
    managedTestDatabase(process.env);
    const input = credentials();
    const user = await prisma.user.create({ data: { id: ulid(), name: "Existing fixture", email: input.email, emailVerified: false } });
    await expect(bootstrapAdmin(prisma, input)).rejects.toThrow("ADMIN_EXISTING_ACCOUNT_REQUIRES_REVIEW");
    const preserved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(preserved.role).toBe("customer");
    expect(preserved.emailVerified).toBe(false);
    expect(await prisma.admin_profile.count({ where: { user_id: user.id } })).toBe(0);
    expect(await prisma.account.count({ where: { userId: user.id } })).toBe(0);
  });

  it("admin inconsistente no se repara ni se eleva silenciosamente", async () => {
    managedTestDatabase(process.env);
    const input = credentials();
    const user = await prisma.user.create({
      data: { id: ulid(), name: "Incomplete admin fixture", email: input.email, role: "admin", emailVerified: true, admin_profile: { create: { admin_role: "support" } } },
    });
    await expect(bootstrapAdmin(prisma, input)).rejects.toThrow("ADMIN_EXISTING_ACCOUNT_REQUIRES_REVIEW");
    expect((await prisma.admin_profile.findUniqueOrThrow({ where: { user_id: user.id } })).admin_role).toBe("support");
    expect(await prisma.account.count({ where: { userId: user.id } })).toBe(0);
  });

  it("una cuenta legacy con email en mayúsculas tampoco se duplica ni se promueve", async () => {
    managedTestDatabase(process.env);
    const input = credentials();
    createdEmails.push(input.email.toUpperCase());
    const user = await prisma.user.create({ data: { id: ulid(), name: "Legacy fixture", email: input.email.toUpperCase() } });
    await expect(bootstrapAdmin(prisma, input)).rejects.toThrow("ADMIN_EXISTING_ACCOUNT_REQUIRES_REVIEW");
    expect(await prisma.user.count({ where: { email: { equals: input.email, mode: "insensitive" } } })).toBe(1);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe("customer");
    expect(await prisma.admin_profile.count({ where: { user_id: user.id } })).toBe(0);
  });

  it("dos bootstraps simultáneos no duplican cuenta ni credenciales", async () => {
    managedTestDatabase(process.env);
    const input = credentials();
    const result = await Promise.all([bootstrapAdmin(prisma, input), bootstrapAdmin(prisma, input)]);
    expect(result.sort()).toEqual(["already-provisioned", "created"]);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: input.email } });
    expect(await prisma.user.count({ where: { email: input.email } })).toBe(1);
    expect(await prisma.account.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.admin_profile.count({ where: { user_id: user.id } })).toBe(1);
  });
});
