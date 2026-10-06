/** Guardias offline: no abre conexiones ni imprime entradas sensibles. */
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { adminCredentials } from "../database/seeds/admin.js";
import { ADMIN_PREVIEW_TARGET, assertSeedIdentity, seedTarget } from "../database/seeds/safety.js";

// Literales independientes: las fixtures no deben aceptar otro destino solo
// porque la constante del guard haya cambiado.
const VERIFIED_PREVIEW_TARGET = {
  endpoint: "ep-flat-violet-au1e8xde",
  branch: "br-wandering-pine-auzjlfe8",
};
const PRODUCTION_TARGET = {
  endpoint: "ep-steep-hall-au81p0co",
  branch: "br-spring-paper-auff9g85",
};

function localEnvironment(managed = false): NodeJS.ProcessEnv {
  const runId = randomBytes(16).toString("hex");
  const url = new URL("postgresql://127.0.0.1:54320/altoque_dev");
  url.username = "fixture";
  url.password = randomBytes(24).toString("hex");
  if (managed) url.pathname = `/altoque_test_${runId}`;
  return {
    DATABASE_URL: url.toString(), NODE_ENV: "test",
    ...(managed ? { ALTOQUE_TEST_DB: "1", ALTOQUE_TEST_DB_MANAGED: "1", ALTOQUE_TEST_RUN_ID: runId, TEST_DATABASE_URL: url.toString() } : {}),
  };
}

function previewEnvironment(endpoint = VERIFIED_PREVIEW_TARGET.endpoint): NodeJS.ProcessEnv {
  const environment = localEnvironment();
  const direct = new URL(environment.DATABASE_URL!);
  direct.hostname = `${endpoint}.c-2.us-east-1.aws.neon.tech`;
  direct.port = "";
  const pooled = new URL(direct);
  pooled.hostname = pooled.hostname.replace(".c-2.", "-pooler.c-2.");
  return { NODE_ENV: "development", DATABASE_URL: pooled.toString(), DIRECT_DATABASE_URL: direct.toString() };
}

describe("Admin bootstrap · guardias offline", () => {
  it("fija únicamente el Preview actual y nunca la referencia histórica de Production", () => {
    expect(ADMIN_PREVIEW_TARGET).toEqual(VERIFIED_PREVIEW_TARGET);
    expect(ADMIN_PREVIEW_TARGET).not.toEqual(PRODUCTION_TARGET);
  });

  it("el seed de catálogo rechaza cualquier destino remoto incluso con apply", () => {
    expect(() => seedTarget(previewEnvironment(), { apply: true })).toThrow("SEED_REMOTE_FORBIDDEN");
  });

  it("el CLI local requiere apply y el nombre de DB explícito", () => {
    const environment = localEnvironment();
    expect(() => seedTarget(environment, { apply: false })).toThrow("SEED_LOCAL_APPLY_REQUIRED");
    expect(seedTarget(environment, { apply: true }).mode).toBe("local");
    const url = new URL(environment.DATABASE_URL!);
    url.pathname = "/shared";
    expect(() => seedTarget({ ...environment, DATABASE_URL: url.toString() }, { apply: true })).toThrow("SEED_LOCAL_APPLY_REQUIRED");
  });

  it("acepta únicamente la DB local del runner con marcas y runId coincidentes", () => {
    const environment = localEnvironment(true);
    expect(seedTarget(environment, { apply: false }).mode).toBe("local");
    expect(() => seedTarget({ ...environment, ALTOQUE_TEST_DB_MANAGED: "0" }, { apply: false })).toThrow("SEED_LOCAL_APPLY_REQUIRED");
    expect(() => seedTarget({ ...environment, TEST_DATABASE_URL: undefined }, { apply: false })).toThrow("SEED_LOCAL_APPLY_REQUIRED");
  });

  it("no permite parámetros de conexión locales que puedan cambiar el destino", () => {
    const environment = localEnvironment();
    environment.DATABASE_URL += "?host=other";
    expect(() => seedTarget(environment, { apply: true })).toThrow("SEED_LOCAL_PARAMETERS_INVALID");
  });

  it.each(["NODE_ENV", "VERCEL_ENV"])("%s=production se rechaza antes de conectar", (key) => {
    expect(() => seedTarget({ ...localEnvironment(true), [key]: "production" }, { apply: true })).toThrow("SEED_PRODUCTION_FORBIDDEN");
  });

  it.each(["private", "PUBLIC", "public&schema=public"])("rechaza schema %s", (schema) => {
    const environment = localEnvironment();
    environment.DATABASE_URL += `?schema=${schema}`;
    expect(() => seedTarget(environment, { apply: true })).toThrow("SEED_SCHEMA_MUST_BE_PUBLIC");
  });

  it("Preview exige flags, endpoint/branch fijados y par pooled/direct consistente", () => {
    const environment = previewEnvironment();
    const options = { apply: true, allowPreview: true, ...VERIFIED_PREVIEW_TARGET };
    expect(seedTarget(environment, options).mode).toBe("preview");
    expect(() => seedTarget(environment, { ...options, apply: false })).toThrow("SEED_REMOTE_FORBIDDEN");
    expect(() => seedTarget(environment, { ...options, endpoint: "ep-other" })).toThrow("SEED_REMOTE_FORBIDDEN");
    expect(() => seedTarget(environment, { ...options, branch: "br-other" })).toThrow("SEED_REMOTE_FORBIDDEN");
    const direct = new URL(environment.DIRECT_DATABASE_URL!);
    direct.password = randomBytes(24).toString("hex");
    expect(() => seedTarget({ ...environment, DIRECT_DATABASE_URL: direct.toString() }, options)).toThrow("SEED_PREVIEW_CONNECTIONS_MISMATCH");
  });

  it.each([
    PRODUCTION_TARGET,
    { ...VERIFIED_PREVIEW_TARGET, endpoint: PRODUCTION_TARGET.endpoint },
    { ...VERIFIED_PREVIEW_TARGET, branch: PRODUCTION_TARGET.branch },
  ])("rechaza flags Production antes de conectar, incluso con URLs Preview ($endpoint / $branch)", (target) => {
    expect(() => seedTarget(previewEnvironment(), { apply: true, allowPreview: true, ...target })).toThrow("SEED_REMOTE_FORBIDDEN");
  });

  it("rechaza URLs Production aunque los flags correspondan al Preview actual", () => {
    expect(() => seedTarget(previewEnvironment(PRODUCTION_TARGET.endpoint), {
      apply: true, allowPreview: true, ...VERIFIED_PREVIEW_TARGET,
    })).toThrow("SEED_PREVIEW_CONNECTIONS_MISMATCH");
  });

  it("rechaza la combinación completa histórica de URLs y flags Production", () => {
    expect(() => seedTarget(previewEnvironment(PRODUCTION_TARGET.endpoint), {
      apply: true, allowPreview: true, ...PRODUCTION_TARGET,
    })).toThrow("SEED_REMOTE_FORBIDDEN");
  });

  it.each([
    PRODUCTION_TARGET,
    { ...VERIFIED_PREVIEW_TARGET, endpoint: PRODUCTION_TARGET.endpoint },
    { ...VERIFIED_PREVIEW_TARGET, branch: PRODUCTION_TARGET.branch },
  ])("la identidad real Production impide el bootstrap ($endpoint / $branch)", async (identity) => {
    const target = seedTarget(previewEnvironment(), { apply: true, allowPreview: true, ...VERIFIED_PREVIEW_TARGET });
    const execute = vi.fn();
    const query = vi.fn().mockResolvedValue([{ database: target.database, schema: "public", address: null, ...identity, read_only: "on" }]);
    const client = { $transaction: (work: (tx: unknown) => Promise<unknown>) => work({ $executeRawUnsafe: execute, $queryRaw: query }) } as unknown as PrismaClient;
    await expect(assertSeedIdentity(client, target)).rejects.toThrow("SEED_PREVIEW_IDENTITY_MISMATCH");
    expect(execute).toHaveBeenCalledExactlyOnceWith("SET TRANSACTION READ ONLY");
    expect(query).toHaveBeenCalledOnce();
  });

  it("acepta la identidad Preview actual únicamente en transacción read-only", async () => {
    const target = seedTarget(previewEnvironment(), { apply: true, allowPreview: true, ...VERIFIED_PREVIEW_TARGET });
    const execute = vi.fn();
    const query = vi.fn().mockResolvedValue([{ database: target.database, schema: "public", address: null, ...VERIFIED_PREVIEW_TARGET, read_only: "on" }]);
    const client = { $transaction: (work: (tx: unknown) => Promise<unknown>) => work({ $executeRawUnsafe: execute, $queryRaw: query }) } as unknown as PrismaClient;
    await assertSeedIdentity(client, target);
    expect(execute).toHaveBeenCalledExactlyOnceWith("SET TRANSACTION READ ONLY");
    query.mockResolvedValueOnce([{ database: target.database, schema: "public", address: null, ...VERIFIED_PREVIEW_TARGET, read_only: "off" }]);
    await expect(assertSeedIdentity(client, target)).rejects.toThrow("SEED_IDENTITY_MISMATCH");
  });

  it("una identidad real distinta o no read-only detiene cualquier escritura", async () => {
    const target = seedTarget(localEnvironment(), { apply: true });
    const execute = vi.fn();
    const query = vi.fn().mockResolvedValue([{ database: target.database, schema: "public", address: "127.0.0.1", branch: null, endpoint: null, read_only: "on" }]);
    const client = { $transaction: (work: (tx: unknown) => Promise<unknown>) => work({ $executeRawUnsafe: execute, $queryRaw: query }) } as unknown as PrismaClient;
    await assertSeedIdentity(client, target);
    expect(execute).toHaveBeenCalledWith("SET TRANSACTION READ ONLY");
    query.mockResolvedValueOnce([{ database: target.database, schema: "public", address: "127.0.0.1", branch: null, endpoint: null, read_only: "off" }]);
    await expect(assertSeedIdentity(client, target)).rejects.toThrow("SEED_IDENTITY_MISMATCH");
    query.mockResolvedValueOnce([{ database: target.database, schema: "public", address: "127.0.0.1", branch: "br-other", endpoint: "ep-other", read_only: "on" }]);
    await expect(assertSeedIdentity(client, target)).rejects.toThrow("SEED_LOCAL_IDENTITY_MISMATCH");
  });

  it("normaliza email y valida password sin incluirlos en mensajes", () => {
    const email = `Admin-${randomBytes(8).toString("hex")}@test.altoque.do`;
    const password = randomBytes(24).toString("hex");
    const credentials = adminCredentials({ SEED_ADMIN_EMAIL: ` ${email} `, SEED_ADMIN_PASSWORD: password });
    expect(credentials?.email === email.toLowerCase()).toBe(true);
    expect(credentials?.password === password).toBe(true);
    expect(adminCredentials({}, true)).toBeNull();
    expect(() => adminCredentials({ SEED_ADMIN_EMAIL: email })).toThrow("ADMIN_SEED_CREDENTIALS_INVALID");
    expect(() => adminCredentials({ SEED_ADMIN_EMAIL: email, SEED_ADMIN_PASSWORD: randomBytes(4).toString("hex") })).toThrow("ADMIN_SEED_CREDENTIALS_INVALID");
  });
});
