import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  REVIEWED_MIGRATIONS, reviewedMigrationHistory, withValidatedPreview,
  validatePreviewConnections, classifyMigrationStatus, requireCliSuccess,
} from "../../scripts/preview-validation.mjs";

const migrations = REVIEWED_MIGRATIONS.map(({ name }) => ({
  name, sql: readFileSync(new URL(`../database/migrations/${name}/migration.sql`, import.meta.url)),
}));
const endpoint = "ep-fixture-preview";
const direct = `postgresql://fixture:dummy@${endpoint}.us-east-1.aws.neon.tech/fixture`;
const pooled = direct.replace(`${endpoint}.`, `${endpoint}-pooler.`);
const input = { endpoint, branch: "br-fixture-preview", direct, pooled, migrations };
const count = `${migrations.length} migrations found in prisma/migrations`;
const metadata = [
  "Prisma schema loaded from server/database/schema.prisma",
  'Datasource "db": PostgreSQL database "fixture", schema "public" at "fixture.neon.tech"',
];
const diagnostics = "Loaded Prisma config from prisma.config.ts.\nPrisma config detected, skipping environment variable loading.\n";
function pendingStatus(pending: string[]) {
  return {
    status: 1, stderr: diagnostics,
    stdout: [...metadata, "", count,
      `Following migration${pending.length > 1 ? "s" : ""} have not yet been applied:`, ...pending, "",
      "To apply migrations in development run prisma migrate dev.",
      "To apply migrations in production run prisma migrate deploy.", "",
    ].join("\n"),
  };
}
const upToDate = { status: 0, stdout: [...metadata, "", count, "", "Database schema is up to date!", ""].join("\n"), stderr: diagnostics };

describe("SQL previamente inspeccionado de Preview", () => {
  it("acepta únicamente los bytes de las tres migraciones aprobadas", () => {
    const history = reviewedMigrationHistory(migrations);
    expect(history.map(({ name, checksum }) => ({ name, checksum }))).toEqual(REVIEWED_MIGRATIONS);
    expect(history.flatMap((migration) => migration.tables)).toHaveLength(27);
    expect(Object.isFrozen(REVIEWED_MIGRATIONS)).toBe(true);
    expect(REVIEWED_MIGRATIONS.every(Object.isFrozen)).toBe(true);
  });

  it("rechaza ADD seguido de DROP antes de crear Prisma o ejecutar el CLI", () => {
    const createClient = vi.fn(), cli = vi.fn();
    const changed = migrations.map((migration, index) => index === 1
      ? { ...migration, sql: 'ALTER TABLE "account" ADD COLUMN "issuer" TEXT, DROP COLUMN "password";' }
      : migration);
    expect(() => withValidatedPreview({ ...input, migrations: changed }, () => { createClient(); cli(); })).toThrow("SQL checksum is not approved");
    expect(createClient).not.toHaveBeenCalled();
    expect(cli).not.toHaveBeenCalled();
  });

  it.each(["added", "removed", "renamed", "duplicated"])("rechaza inventario %s", (change) => {
    const changed = [...migrations];
    if (change === "added") changed.push({ name: "20261005000000_unreviewed", sql: Buffer.from('CREATE TABLE "unreviewed" (id TEXT);') });
    if (change === "removed") changed.pop();
    if (change === "renamed") changed[0] = { ...changed[0], name: "00000000000001_init" };
    if (change === "duplicated") changed.push(changed[0]);
    expect(() => reviewedMigrationHistory(changed)).toThrow("unexpected local migration inventory");
  });

  it("rechaza cualquier edición posterior aunque conserve la estructura SQL", () => {
    const edited = migrations.map((migration, index) => index === 2
      ? { ...migration, sql: Buffer.concat([migration.sql, Buffer.from("\n-- edited after inspection\n")]) }
      : migration);
    expect(() => reviewedMigrationHistory(edited)).toThrow("SQL checksum is not approved");
  });
});

describe("Schema de Preview antes de Prisma", () => {
  it.each(["", "?schema=public"])("acepta schema público o ausente (%s)", (query) => {
    const work = vi.fn();
    withValidatedPreview({ ...input, direct: direct + query, pooled: pooled + query }, work);
    expect(work).toHaveBeenCalledOnce();
    expect(() => validatePreviewConnections(direct + query, pooled, endpoint)).not.toThrow();
  });

  it.each([
    ["direct", "?schema=other"], ["pooled", "?schema=other"],
    ["direct", "?schema="], ["pooled", "?schema=public&schema=other"],
    ["direct", "?schema=public&schema=public"], ["pooled", "?Schema=other"],
    ["direct", "?schema=PUBLIC"], ["pooled", "?%73chema=other"],
  ])("rechaza %s %s antes de crear cliente y ejecutar CLI", (target, query) => {
    const createClient = vi.fn(), cli = vi.fn();
    const changed = { ...input, [target]: input[target as "direct" | "pooled"] + query };
    expect(() => withValidatedPreview(changed, () => { createClient(); cli(); })).toThrow("connection schema must be absent or public");
    expect(createClient).not.toHaveBeenCalled();
    expect(cli).not.toHaveBeenCalled();
  });
});

describe("Exit code de prisma migrate status", () => {
  it("clasifica exit 0 solo cuando la inspección SQL también está al día", () => {
    expect(classifyMigrationStatus(upToDate, [])).toBe("up-to-date");
    expect(() => classifyMigrationStatus(upToDate, [migrations[2].name])).toThrow("disagrees");
  });

  it.each([1, 2, 3])("acepta exit 1 únicamente con %i pendientes inspeccionadas idénticas", (length) => {
    const pending = migrations.slice(-length).map((migration) => migration.name);
    expect(classifyMigrationStatus(pendingStatus(pending), pending)).toBe("pending");
  });

  it("rechaza un listado de pendientes que difiera de la inspección SQL", () => {
    expect(() => classifyMigrationStatus(pendingStatus([migrations[1].name]), [migrations[2].name])).toThrow("not the expected pending");
    expect(() => classifyMigrationStatus(pendingStatus([migrations[2].name]), [])).toThrow("not the expected pending");
  });

  it.each([
    "Error: P1001: database is unreachable", "Following migrations have failed:",
    "Your local migration history and the migrations table from your database are different:",
    "The current database is not managed by Prisma Migrate.",
  ])("rechaza exit 1 del CLI por un error real: %s", (stdout) => {
    expect(() => classifyMigrationStatus({ status: 1, stdout, stderr: "" }, [migrations[2].name])).toThrow("STOP:");
  });

  it("rechaza diagnósticos de error aunque stdout enumere las pendientes correctas", () => {
    const pending = [migrations[2].name];
    expect(() => classifyMigrationStatus({ ...pendingStatus(pending), stderr: `${diagnostics}Error: P1001\n` }, pending)).toThrow("unexpected diagnostics");
    expect(() => classifyMigrationStatus({ ...pendingStatus(pending), stdout: `${pendingStatus(pending).stdout}\nError: P1001` }, pending)).toThrow("not the expected pending");
  });

  it.each([
    { status: null }, { status: null, signal: "SIGTERM" },
    { status: 0, signal: "SIGTERM" }, { status: 1, error: new Error("spawn failed") },
    { status: 2 },
  ])("rechaza spawn fallido, señal o exit code inesperado ($status, $signal)", (result) => {
    expect(() => classifyMigrationStatus({ ...upToDate, ...result }, [])).toThrow("failed or did not complete");
    expect(() => requireCliSuccess({ ...upToDate, ...result }, "deploy")).toThrow("failed or did not complete");
  });
});
