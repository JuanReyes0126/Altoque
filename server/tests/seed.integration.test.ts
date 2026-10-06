/** Regresión del seed: credenciales válidas de Better Auth e idempotencia. */
import { spawn } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLocalAccountIssuer } from "better-auth/db";
import { auth } from "../auth/auth.js";
import { prisma } from "../database/prisma.js";
import { ulid } from "../lib/ids.js";
import { HAS_DB } from "./setup";
import { managedTestDatabase } from "./test-database.js";
import { testHeaders } from "./session-helpers.js";
import { emailLimitSubject } from "../auth/rate-limit.js";

describe.runIf(HAS_DB)("Seed · integración aislada", () => {
  const email = `seed-regression-${ulid()}@test.altoque.do`.toLowerCase();
  const originalPassword = "SeedRegressionOriginal123!";
  const replacementPassword = "SeedRegressionReplacement123!";
  let baseline: { categories: Set<string>; zones: Set<string>; sequences: Set<number> } | undefined;
  let seedStarted = false;

  async function catalogIds() {
    const [categories, zones, sequences] = await Promise.all([
      prisma.category.findMany({ select: { id: true }, orderBy: { id: "asc" } }),
      prisma.zone.findMany({ select: { id: true }, orderBy: { id: "asc" } }),
      prisma.request_code_seq.findMany({ select: { id: true }, orderBy: { id: "asc" } }),
    ]);
    return {
      categories: categories.map(({ id }) => id),
      zones: zones.map(({ id }) => id),
      sequences: sequences.map(({ id }) => id),
    };
  }

  beforeAll(async () => {
    managedTestDatabase(process.env);
    const existing = await catalogIds();
    baseline = {
      categories: new Set(existing.categories),
      zones: new Set(existing.zones),
      sequences: new Set(existing.sequences),
    };
  });

  async function runSeed(password: string) {
    // Validar otra vez antes de arrancar el proceso que escribe en la DB.
    const databaseUrl = managedTestDatabase(process.env);
    seedStarted = true;
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, ["--import", "tsx", "server/database/seeds/seed.ts"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          DIRECT_DATABASE_URL: databaseUrl,
          SEED_ADMIN_EMAIL: email,
          SEED_ADMIN_PASSWORD: password,
        },
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 20_000,
      });
      // Consumir ambos streams sin imprimir ni incluir su contenido en errores.
      const output: Buffer[] = [];
      child.stdout.on("data", (chunk: Buffer) => output.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => output.push(chunk));
      child.on("error", () => {
        output.length = 0;
        reject(new Error("SEED_PROCESS_START_FAILED"));
      });
      child.on("close", (code) => {
        output.length = 0;
        if (code === 0) resolve();
        else reject(new Error("SEED_PROCESS_FAILED"));
      });
    });
  }

  async function login() {
    let result;
    try {
      result = await auth.api.signInEmail({
        body: { email, password: originalPassword },
        returnHeaders: true,
      });
    } catch {
      throw new Error("SEED_LOGIN_FAILED");
    }
    const { authCookies } = await auth.$context;
    const cookie = result.headers.getSetCookie().find((value) =>
      value.startsWith(`${authCookies.sessionToken.name}=`),
    )?.split(";")[0];
    // Afirmaciones booleanas evitan que Vitest muestre tokens o cookies.
    expect(Boolean(cookie)).toBe(true);
    if (!cookie) throw new Error("SEED_SESSION_COOKIE_MISSING");
    let session;
    try {
      session = await auth.api.getSession({ headers: new Headers(testHeaders(cookie)) });
    } catch {
      throw new Error("SEED_SESSION_AUTHENTICATION_FAILED");
    }
    expect(Boolean(session)).toBe(true);
    if (!session) throw new Error("SEED_SESSION_AUTHENTICATION_FAILED");
    return { userId: result.response.user.id, session };
  }

  afterAll(async () => {
    const snapshot = baseline;
    if (!snapshot || !seedStarted) return;
    managedTestDatabase(process.env);
    // El runner crea un cluster exclusivo y serializa las suites. La diferencia
    // también recupera filas sembradas si el proceso falló parcialmente.
    const current = await catalogIds();
    const categoryIds = current.categories.filter((id) => !snapshot.categories.has(id));
    const zoneIds = current.zones.filter((id) => !snapshot.zones.has(id));
    const sequenceIds = current.sequences.filter((id) => !snapshot.sequences.has(id));
    const users = await prisma.user.findMany({ where: { email }, select: { id: true } });
    const userIds = users.map(({ id }) => id);
    await prisma.admin_audit_log.deleteMany({ where: { actor_id: { in: userIds } } });
    await prisma.notification.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.rate_limit.deleteMany({ where: { subject: emailLimitSubject(email, (await auth.$context).secret) } });
    // account, session y admin_profile usan onDelete: Cascade.
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
    await prisma.zone.deleteMany({ where: { id: { in: zoneIds } } });
    await prisma.request_code_seq.deleteMany({ where: { id: { in: sequenceIds } } });
  });

  it("crea un super_admin que inicia sesión y repetir seed no duplica ni cambia su contraseña", async () => {
    await runSeed(originalPassword);
    const seeded = await prisma.user.findUniqueOrThrow({ where: { email }, include: { admin_profile: true } });
    expect(seeded.role).toBe("admin");
    expect(seeded.emailVerified).toBe(true);
    expect(seeded.admin_profile?.admin_role).toBe("super_admin");
    const accounts = await prisma.account.findMany({
      where: { userId: seeded.id },
      select: { id: true, userId: true, providerId: true, accountId: true, issuer: true },
    });
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      userId: seeded.id,
      providerId: "credential",
      accountId: seeded.id,
      issuer: createLocalAccountIssuer("credential"),
    });
    const firstLogin = await login();
    expect(firstLogin.userId).toBe(seeded.id);
    expect(firstLogin.session.user.id).toBe(seeded.id);
    expect(firstLogin.session.user.role).toBe("admin");
    const firstCatalog = await catalogIds();
    expect(firstCatalog.categories).toContain("plomeria");
    expect(firstCatalog.zones).toContain("gurabo");
    expect(firstCatalog.sequences).toContain(1);

    await runSeed(replacementPassword);
    expect(await catalogIds()).toEqual(firstCatalog);
    expect(await prisma.user.count({ where: { email } })).toBe(1);
    const repeatedAccounts = await prisma.account.findMany({
      where: { userId: seeded.id },
      select: { id: true, userId: true, providerId: true, accountId: true, issuer: true },
    });
    expect(repeatedAccounts).toEqual(accounts);
    const secondLogin = await login();
    expect(secondLogin.userId).toBe(seeded.id);
    expect(secondLogin.session.user.id).toBe(seeded.id);
    expect(secondLogin.session.user.role).toBe("admin");
    expect((await prisma.admin_profile.findUnique({ where: { user_id: seeded.id } }))?.admin_role).toBe("super_admin");
    let rejected = false;
    let code: unknown;
    try {
      await auth.api.signInEmail({ body: { email, password: replacementPassword } });
    } catch (error) {
      rejected = true;
      code = (error as { body?: { code?: unknown } }).body?.code;
    }
    expect(rejected).toBe(true);
    expect(code).toBe("INVALID_EMAIL_OR_PASSWORD");
  });
});
