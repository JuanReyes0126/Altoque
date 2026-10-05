import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parse } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { REVIEWED_MIGRATIONS, reviewedMigrationHistory, withValidatedPreview, classifyMigrationStatus, requireCliSuccess } from "./preview-validation.mjs";

const args = process.argv.slice(2);
const endpoint = args.find((a) => a.startsWith("--endpoint="))?.slice(11);
const branch = args.find((a) => a.startsWith("--branch="))?.slice(9);
const deploy = args.includes("--deploy");
const vars = parse(readFileSync(".env"));
const direct = vars.DIRECT_DATABASE_URL;
const pooled = vars.DATABASE_URL;
const folder = "server/database/migrations";
const expected = REVIEWED_MIGRATIONS.map((migration) => migration.name);

function requireSafe(condition, message) {
  if (!condition) throw new Error(`STOP: ${message}`);
}

function redact(output) {
  const password = direct ? new URL(direct).password : "";
  for (const secret of [direct, pooled, password, decodeURIComponent(password)].filter(Boolean).sort((a, b) => b.length - a.length)) {
    output = output.split(secret).join("[REDACTED]");
  }
  return output.replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, "[CONNECTION_URL_REDACTED]");
}

function cli(command, options = []) {
  const env = { ...process.env, ...vars, DATABASE_URL: direct, DIRECT_DATABASE_URL: direct, PRISMA_HIDE_UPDATE_MESSAGE: "1", NO_COLOR: "1" };
  delete env.FORCE_COLOR;
  const result = spawnSync("npx", ["--no-install", "prisma", "migrate", command, ...options], {
    env,
    encoding: "utf8", timeout: 120_000,
  });
  console.log(redact((result.stdout ?? "") + (result.stderr ?? "")));
  return result;
}

function readLocalMigrations() {
  return readdirSync(folder, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => ({
    name: entry.name, sql: readFileSync(`${folder}/${entry.name}/migration.sql`),
  }));
}

function readHistory() {
  return reviewedMigrationHistory(readLocalMigrations());
}

async function inspect(client) {
  return client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const [identity] = await tx.$queryRawUnsafe("SELECT current_setting('neon.branch_id',true)::text AS branch, current_setting('neon.endpoint_id',true)::text AS endpoint, current_setting('transaction_read_only')::text AS read_only");
    const tables = await tx.$queryRawUnsafe("SELECT schemaname::text AS schema, tablename::text AS name FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')");
    const migrations = tables.some((t) => t.schema === "public" && t.name === "_prisma_migrations")
      ? await tx.$queryRawUnsafe("SELECT migration_name AS name, checksum, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back FROM public._prisma_migrations ORDER BY started_at") : [];
    const indexes = await tx.$queryRawUnsafe("SELECT c.relname::text AS name, i.indisunique AS is_unique, i.indisvalid AS valid, i.indisready AS ready, pg_get_indexdef(i.indexrelid)::text AS definition FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'");
    const constraints = await tx.$queryRawUnsafe("SELECT c.conname::text AS name, c.convalidated AS valid, pg_get_constraintdef(c.oid)::text AS definition FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public'");
    const columns = await tx.$queryRawUnsafe("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='file' ORDER BY ordinal_position");
    const issuer = await tx.$queryRawUnsafe("SELECT data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='account' AND column_name='issuer'");
    return { identity, tables, migrations, indexes, constraints, columns, issuer };
  }, { maxWait: 20_000, timeout: 30_000 });
}

function verify(report, history, complete) {
  requireSafe(report.identity.branch === branch && report.identity.endpoint === endpoint && report.identity.read_only === "on", "connected database is not the verified Preview destination");
  for (const migration of report.migrations) {
    requireSafe(migration.finished && !migration.rolled_back, "failed or rolled-back migration requires manual review");
    requireSafe(history.some((h) => h.name === migration.name && h.checksum === migration.checksum), "remote migration history differs from reviewed SQL");
  }
  const applied = new Set(report.migrations.map((m) => m.name));
  if (applied.size === 0) requireSafe(report.tables.length === 0, "database has tables without a migration history; do not baseline automatically");
  const relevant = history.filter((h) => applied.has(h.name));
  for (const h of relevant) {
    for (const name of h.tables) requireSafe(report.tables.some((t) => t.schema === "public" && t.name === name), `missing table ${name}`);
    for (const index of h.indexes) requireSafe(report.indexes.some((i) => i.name === index.name && i.valid && i.ready && i.is_unique === index.unique), `missing or invalid index ${index.name}`);
    for (const name of h.constraints) requireSafe(report.constraints.some((c) => c.name === name && c.valid), `missing or unvalidated constraint ${name}`);
  }
  if (applied.has(expected[0])) {
    const active = report.indexes.find((i) => i.name === "service_request_provider_active_unique");
    const activeStatuses = active ? [...active.definition.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort() : [];
    requireSafe(active?.is_unique && /\(\s*"?provider_id"?\s*\)/.test(active.definition) && active.definition.includes("WHERE") && active.definition.includes("provider_id IS NOT NULL") && JSON.stringify(activeStatuses) === JSON.stringify(["accepted", "on_the_way", "arrived", "in_progress"].sort()), "active-provider partial index predicate differs");
    const dispute = report.indexes.find((i) => i.name === "dispute_one_open_per_request");
    requireSafe(dispute?.is_unique && /\(\s*"?request_id"?\s*\)/.test(dispute.definition) && dispute.definition.includes("WHERE") && JSON.stringify([...dispute.definition.matchAll(/'([^']+)'/g)].map((m) => m[1])) === JSON.stringify(["open"]), "open-dispute partial index predicate differs");
    for (const column of ["rating", "punctuality", "quality", "communication"]) {
      const check = report.constraints.find((c) => c.name === `review_${column}_range`);
      requireSafe(check && new RegExp(`\\b${column}\\s*>=\\s*1\\b`).test(check.definition) && new RegExp(`\\b${column}\\s*<=\\s*5\\b`).test(check.definition) && (column === "rating" || check.definition.includes(`${column} IS NULL`)), `rating constraint differs: ${column}`);
    }
  }
  if (applied.has(expected[1])) requireSafe(report.issuer.length === 1 && report.issuer[0].data_type === "text" && report.issuer[0].is_nullable === "YES", "account.issuer differs from schema");
  if (complete) {
    requireSafe(applied.size === history.length, "migrations still pending");
    const fileColumns = ["id", "owner_id", "visibility", "blob_key", "mime", "size_bytes", "purpose", "request_id", "provider_id", "created_at"];
    requireSafe(JSON.stringify(report.columns.map((c) => c.column_name)) === JSON.stringify(fileColumns), "file columns differ from schema");
    requireSafe(report.columns.every((c) => c.is_nullable === (["request_id", "provider_id"].includes(c.column_name) ? "YES" : "NO")), "file column nullability differs");
    requireSafe(report.columns.every((c) => c.data_type === (c.column_name === "size_bytes" ? "integer" : c.column_name === "created_at" ? "timestamp without time zone" : "text")), "file column types differ");
    requireSafe(report.constraints.some((c) => c.name === "file_owner_id_fkey" && c.definition.includes("FOREIGN KEY (owner_id) REFERENCES") && c.definition.includes('"user"(id)') && c.definition.includes("ON UPDATE CASCADE ON DELETE CASCADE")), "file owner foreign key differs");
    console.log(`Verified ${history.length} migrations, ${history.flatMap((h) => h.tables).length} tables, ${history.flatMap((h) => h.indexes).length} indexes, ${history.flatMap((h) => h.constraints).length} constraints.`);
    console.log("Partial indexes, rating checks, account.issuer and file schema verified.");
    console.log("Active provider index:", report.indexes.find((i) => i.name === "service_request_provider_active_unique").definition);
  }
  return history.filter((h) => !applied.has(h.name)).map((h) => h.name);
}

let client;
try {
  await withValidatedPreview({ endpoint, branch, direct, pooled, migrations: readLocalMigrations() }, async ({ history }) => {
    client = new PrismaClient({ datasourceUrl: direct, log: [] });
    const before = await inspect(client);
    const pending = verify(before, history, false);
    console.log("Preview identity verified:", before.identity.branch, before.identity.endpoint);
    console.log("Pending migrations:", pending.length ? pending.join(", ") : "none");
    const status = classifyMigrationStatus(cli("status"), pending);
    console.log("Migration CLI status verified:", status);
    if (deploy && pending.length) {
      requireSafe(JSON.stringify(verify(await inspect(client), history, false)) === JSON.stringify(pending), "remote migration state changed after review");
      requireSafe(JSON.stringify(readHistory()) === JSON.stringify(history), "local SQL changed after review");
      requireCliSuccess(cli("deploy"), "deploy");
    }
    const after = await inspect(client);
    if (deploy || pending.length === 0) {
      verify(after, history, true);
      classifyMigrationStatus(cli("status"), []);
      requireCliSuccess(cli("diff", ["--from-schema-datasource", "server/database/schema.prisma", "--to-schema-datamodel", "server/database/schema.prisma", "--exit-code"]), "diff");
    }
  });
} catch (error) {
  console.error(error.message?.startsWith("STOP:") ? error.message : `Validation stopped; error code: ${error.code ?? error.name}`);
  process.exitCode = 1;
} finally {
  await client?.$disconnect();
}
