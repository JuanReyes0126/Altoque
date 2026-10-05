import { createHash } from "node:crypto";

// These exact bytes were inspected in full. New SQL requires a separate review
// and an explicit update of this manifest; SQL prefixes are never approval.
export const REVIEWED_MIGRATIONS = Object.freeze([
  Object.freeze({ name: "00000000000000_init", checksum: "431243b782da5954046bccead86c9ff8d06be0566f15dcfe5bd7c1fce44cb2dd" }),
  Object.freeze({ name: "20260907192000_add_account_issuer", checksum: "6eb4a293e4bdd2087c03cd35f5ebfdde6ec9c2c98ec96fb12530b495c2dbdc08" }),
  Object.freeze({ name: "20260908120000_add_file_table", checksum: "498730f6a753bf79a4f284474e426caf155607cffab63b0dbd969b6f80a4efb5" }),
]);

function requireSafe(condition, message) {
  if (!condition) throw new Error(`STOP: ${message}`);
}

export function reviewedMigrationHistory(entries) {
  const ordered = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  requireSafe(JSON.stringify(ordered.map((entry) => entry.name)) === JSON.stringify(REVIEWED_MIGRATIONS.map((entry) => entry.name)), "unexpected local migration inventory");
  return ordered.map((entry, index) => {
    const checksum = createHash("sha256").update(entry.sql).digest("hex");
    requireSafe(checksum === REVIEWED_MIGRATIONS[index].checksum, `SQL checksum is not approved: ${entry.name}`);
    const sql = typeof entry.sql === "string" ? entry.sql : Buffer.from(entry.sql).toString("utf8");
    // Extraction describes already approved SQL, rather than approving it.
    return {
      name: entry.name, checksum,
      tables: [...sql.matchAll(/CREATE TABLE "([^"]+)"/g)].map((match) => match[1]),
      indexes: [...sql.matchAll(/CREATE (UNIQUE )?INDEX "([^"]+)"/g)].map((match) => ({ name: match[2], unique: Boolean(match[1]) })),
      constraints: [...sql.matchAll(/(?:ADD )?CONSTRAINT "([^"]+)"/g)].map((match) => match[1]),
    };
  });
}

export function validatePreviewConnections(direct, pooled, endpoint) {
  requireSafe(typeof direct === "string" && direct.length > 0 && typeof pooled === "string" && pooled.length > 0, "both database variables are required locally");
  let d, p;
  try { d = new URL(direct); p = new URL(pooled); } catch { throw new Error("STOP: invalid Neon connections"); }
  requireSafe([d, p].every((url) => ["postgres:", "postgresql:"].includes(url.protocol) && url.hostname.endsWith(".neon.tech") && !url.hash), "invalid Neon connections");
  for (const url of [d, p]) {
    const schemas = url.searchParams.getAll("schema");
    requireSafe(schemas.length <= 1 && (schemas.length === 0 || schemas[0] === "public") && [...url.searchParams.keys()].every((key) => key.toLowerCase() !== "schema" || key === "schema"), "connection schema must be absent or public, without duplicate parameters");
  }
  requireSafe(d.hostname.split(".")[0] === endpoint && !d.hostname.includes("-pooler") && p.hostname.includes("-pooler.") && p.hostname.replace("-pooler.", ".") === d.hostname && d.pathname === p.pathname && d.username === p.username && d.password === p.password, "pooled/direct connections do not match the verified Preview endpoint");
}

// The entrypoint creates the Prisma client and invokes the CLI only inside work.
// Invalid connections or unreviewed SQL therefore cannot reach either operation.
export function withValidatedPreview(input, work) {
  requireSafe(input.endpoint?.startsWith("ep-") && input.branch?.startsWith("br-"), "supply the Preview endpoint and branch IDs confirmed in Neon");
  validatePreviewConnections(input.direct, input.pooled, input.endpoint);
  const history = reviewedMigrationHistory(input.migrations);
  return work({ history });
}

function outputLines(output) {
  return String(output ?? "").replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function requireCliSuccess(result, command) {
  requireSafe(!result.error && !result.signal && result.status === 0, `Prisma ${command} failed or did not complete`);
}

export function classifyMigrationStatus(result, pending) {
  requireSafe(!result.error && !result.signal && (result.status === 0 || result.status === 1), "Prisma status failed or did not complete");
  const names = REVIEWED_MIGRATIONS.map((entry) => entry.name);
  requireSafe(JSON.stringify(pending) === JSON.stringify(names.slice(names.length - pending.length)), "pending migrations are not a reviewed history suffix");
  const stdout = outputLines(result.stdout);
  const stderr = outputLines(result.stderr);
  requireSafe(stderr.every((line) => /^Loaded Prisma config from [^\r\n]+\.$/.test(line) || line === "Prisma config detected, skipping environment variable loading."), "Prisma status reported unexpected diagnostics");
  const count = `${names.length} migrations found in prisma/migrations`;
  const position = stdout.indexOf(count);
  requireSafe(position >= 0 && stdout.slice(0, position).every((line) => /^Prisma schema loaded from [^\r\n]+$/.test(line) || /^Datasource "[^"\r\n]+": PostgreSQL database "[^"\r\n]+", schema "public" at "[^"\r\n]+"$/.test(line)), "Prisma status output is not recognized");
  const statusLines = stdout.slice(position);
  if (result.status === 0) {
    requireSafe(pending.length === 0 && JSON.stringify(statusLines) === JSON.stringify([count, "Database schema is up to date!"]), "Prisma status disagrees with inspected migration history");
    return "up-to-date";
  }
  const expectedLines = [
    count,
    `Following migration${pending.length > 1 ? "s" : ""} have not yet been applied:`,
    ...pending,
    "To apply migrations in development run prisma migrate dev.",
    "To apply migrations in production run prisma migrate deploy.",
  ];
  requireSafe(pending.length > 0 && JSON.stringify(statusLines) === JSON.stringify(expectedLines), "Prisma status exit 1 is not the expected pending migrations");
  return "pending";
}
