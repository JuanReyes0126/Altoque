import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { spawn } from "node:child_process";

const integration = process.argv[2] === "integration";
const testArgs = process.argv.slice(3);
const environment = { ...process.env };
for (const key of Object.keys(environment)) {
  if (/DATABASE|NEON|BETTER_AUTH|RESEND|BLOB|VERCEL|ALTOQUE|SEED_|APP_URL|EXTRA_TRUSTED_ORIGINS/.test(key)) delete environment[key];
}
Object.assign(environment, { NODE_ENV: "test", APP_URL: "http://localhost:3000", ALTOQUE_TEST_DB: "0" });
const secrets = [];
function redact(text) {
  for (const secret of secrets) text = text.split(secret).join("[REDACTED]");
  return text.replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, "[CONNECTION_URL_REDACTED]");
}
function command(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["--no-install", ...args], { env: environment, stdio: ["ignore", "pipe", "pipe"] });
    // Procesar líneas completas evita revelar un secreto partido entre chunks.
    for (const stream of [child.stdout, child.stderr]) {
      let pending = "";
      stream.on("data", (chunk) => {
        pending += chunk.toString();
        const lines = pending.split("\n");
        pending = lines.pop();
        for (const line of lines) console.log(redact(line));
      });
      stream.on("end", () => { if (pending) console.log(redact(pending)); });
    }
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}
async function unusedPort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}
async function bounded(operation, milliseconds) {
  let timer;
  try {
    return await Promise.race([operation, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("LOCAL_POSTGRES_STOP_TIMEOUT")), milliseconds); })]);
  } finally { clearTimeout(timer); }
}

let postgres, databaseDir, inspector;
let success = false;
try {
  if (!integration) {
    process.exitCode = await command(["vitest", "run", ...testArgs]);
    success = process.exitCode === 0;
  } else {
    process.umask(0o077);
    const [{ default: EmbeddedPostgres }, { PrismaClient }] = await Promise.all([import("embedded-postgres"), import("@prisma/client")]);
    databaseDir = await mkdtemp(join(tmpdir(), "altoque-tests-"));
    const runId = randomBytes(16).toString("hex");
    const database = `altoque_test_${runId}`;
    const password = randomBytes(32).toString("hex");
    const authSecret = randomBytes(48).toString("hex");
    const port = await unusedPort();
    const url = `postgresql://altoque_test:${password}@127.0.0.1:${port}/${database}?connection_limit=10&pool_timeout=20`;
    secrets.push(url, password, authSecret);
    postgres = new EmbeddedPostgres({
      databaseDir, port, user: "altoque_test", password, authMethod: "scram-sha-256", persistent: true,
      initdbFlags: ["--encoding=UTF8", "--locale=C"],
      postgresFlags: ["-h", "127.0.0.1", "-k", databaseDir, "-c", "log_statement=none", "-c", "log_min_error_statement=panic"],
      onLog: () => {}, onError: () => {},
    });
    await postgres.initialise();
    await postgres.start();
    await postgres.createDatabase(database);
    Object.assign(environment, {
      DATABASE_URL: url, DIRECT_DATABASE_URL: url, TEST_DATABASE_URL: url,
      ALTOQUE_TEST_DB: "1", ALTOQUE_TEST_DB_MANAGED: "1", ALTOQUE_TEST_RUN_ID: runId,
      ALTOQUE_TEST_AUTH_SECRET: authSecret, BETTER_AUTH_SECRET: authSecret,
    });
    inspector = new PrismaClient({ datasourceUrl: url, log: [] });
    const [{ name, address }] = await inspector.$queryRawUnsafe("SELECT current_database()::text AS name, host(inet_server_addr())::text AS address");
    if (name !== database || address !== "127.0.0.1") throw new Error("UNSAFE_TEST_DATABASE");
    console.log("Integration database verified: exclusive PostgreSQL on 127.0.0.1; no Neon credentials inherited.");
    if (await command(["prisma", "migrate", "deploy"]) !== 0) throw new Error("TEST_MIGRATIONS_FAILED");
    if (await command(["prisma", "migrate", "status"]) !== 0) throw new Error("TEST_MIGRATION_STATUS_FAILED");
    const testCode = await command(["vitest", "run", ...testArgs]);
    const tables = await inspector.$queryRawUnsafe("SELECT tablename::text AS name FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename");
    const leftovers = [];
    for (const { name: table } of tables) {
      if (!/^[a-z_][a-z0-9_]*$/.test(table)) throw new Error("UNEXPECTED_TEST_TABLE");
      const [{ count }] = await inspector.$queryRawUnsafe(`SELECT count(*)::int AS count FROM public."${table}"`);
      if (count) leftovers.push({ table, rows: count });
    }
    if (leftovers.length) console.error("Fixture cleanup incomplete:", JSON.stringify(leftovers));
    else console.log("Fixture cleanup verified: all 27 application tables are empty.");
    success = testCode === 0 && leftovers.length === 0;
    process.exitCode = success ? 0 : 1;
  }
} catch (error) {
  console.error("Test run stopped; code:", /^[A-Z_]+$/.test(error?.message ?? "") ? error.message : error?.code ?? error?.name ?? "UNKNOWN");
  process.exitCode = 1;
} finally {
  try { await inspector?.$disconnect(); } catch { console.error("Test inspector could not disconnect cleanly."); process.exitCode = 1; success = false; }
  if (postgres) {
    try { await bounded(postgres.stop(), 10_000); } catch { console.error("Local test PostgreSQL could not stop cleanly."); process.exitCode = 1; success = false; }
  }
  if (databaseDir && success) {
    try { await rm(databaseDir, { recursive: true, force: false }); } catch { console.error("Could not remove the new local test directory."); process.exitCode = 1; success = false; }
  }
  if (databaseDir && !success) console.log("New local test database preserved for diagnosis:", databaseDir);
}
// embedded-postgres instala un beforeExit que fuerza código 0.
// Tras cerrar nuestro cluster y vaciar stdout, conservar el resultado real.
await new Promise((resolve) => process.stdout.write("", resolve));
await new Promise((resolve) => process.stderr.write("", resolve));
process.exit(process.exitCode ?? 0);
