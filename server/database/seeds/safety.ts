/** Guardias de destino; nunca incluyen conexiones ni credenciales en errores. */
import type { PrismaClient } from "@prisma/client";
import { validatePreviewConnections } from "../../../scripts/preview-validation.mjs";

export const ADMIN_PREVIEW_TARGET = Object.freeze({
  endpoint: "ep-steep-hall-au81p0co",
  branch: "br-spring-paper-auff9g85",
});

export interface SeedTarget {
  url: string;
  database: string;
  mode: "local" | "preview";
  endpoint?: string;
  branch?: string;
}

function stop(code: string): never { throw new Error(code); }

function databaseUrl(value: string | undefined): URL {
  if (!value) return stop("SEED_DATABASE_URL_REQUIRED");
  let url: URL;
  try { url = new URL(value); } catch { return stop("SEED_DATABASE_URL_INVALID"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hash || !url.username || !url.password || !/^\/[A-Za-z0-9_-]+$/.test(url.pathname)) return stop("SEED_DATABASE_URL_INVALID");
  const schema = url.searchParams.getAll("schema");
  if (schema.length > 1 || (schema.length === 1 && schema[0] !== "public") || [...url.searchParams.keys()].some((key) => key.toLowerCase() === "schema" && key !== "schema")) return stop("SEED_SCHEMA_MUST_BE_PUBLIC");
  return url;
}

/** Catálogo: exclusivamente localhost; admin: Preview requiere IDs fijados. */
export function seedTarget(environment: NodeJS.ProcessEnv, options: {
  apply: boolean;
  allowPreview?: boolean;
  endpoint?: string;
  branch?: string;
}): SeedTarget {
  if (environment.NODE_ENV === "production" || environment.VERCEL_ENV === "production") return stop("SEED_PRODUCTION_FORBIDDEN");
  const url = databaseUrl(environment.DATABASE_URL);
  if (url.hostname === "127.0.0.1") {
    if (!url.port || Number(url.port) < 1024 || Number(url.port) > 65535) return stop("SEED_LOCAL_PORT_REQUIRED");
    for (const [key, value] of url.searchParams) {
      if (key === "schema") continue;
      if (!["connection_limit", "pool_timeout", "connect_timeout"].includes(key) || !/^\d+$/.test(value)) return stop("SEED_LOCAL_PARAMETERS_INVALID");
    }
    const runId = environment.ALTOQUE_TEST_RUN_ID;
    const managed = environment.ALTOQUE_TEST_DB === "1"
      && environment.ALTOQUE_TEST_DB_MANAGED === "1"
      && typeof runId === "string" && /^[a-f0-9]{32}$/.test(runId)
      && url.pathname === `/altoque_test_${runId}`
      && environment.TEST_DATABASE_URL === environment.DATABASE_URL;
    const explicitLocal = options.apply && url.pathname === "/altoque_dev";
    if (!managed && !explicitLocal) return stop("SEED_LOCAL_APPLY_REQUIRED");
    if (options.endpoint || options.branch) return stop("SEED_LOCAL_PREVIEW_FLAGS_FORBIDDEN");
    return { url: environment.DATABASE_URL!, database: url.pathname.slice(1), mode: "local" };
  }
  if (!options.allowPreview || !options.apply
    || options.endpoint !== ADMIN_PREVIEW_TARGET.endpoint
    || options.branch !== ADMIN_PREVIEW_TARGET.branch) return stop("SEED_REMOTE_FORBIDDEN");
  try {
    validatePreviewConnections(environment.DIRECT_DATABASE_URL, environment.DATABASE_URL, ADMIN_PREVIEW_TARGET.endpoint);
  } catch {
    return stop("SEED_PREVIEW_CONNECTIONS_MISMATCH");
  }
  const direct = databaseUrl(environment.DIRECT_DATABASE_URL);
  return { url: environment.DIRECT_DATABASE_URL!, database: direct.pathname.slice(1), mode: "preview", ...ADMIN_PREVIEW_TARGET };
}

/** Identidad real en transacción READ ONLY antes de cualquier escritura. */
export async function assertSeedIdentity(prisma: PrismaClient, target: SeedTarget): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const [identity] = await tx.$queryRaw<Array<{
      database: string; address: string | null; schema: string;
      branch: string | null; endpoint: string | null; read_only: string;
    }>>`SELECT current_database()::text AS database,
      host(inet_server_addr())::text AS address, current_schema()::text AS schema,
      current_setting('neon.branch_id',true)::text AS branch,
      current_setting('neon.endpoint_id',true)::text AS endpoint,
      current_setting('transaction_read_only')::text AS read_only`;
    if (!identity || identity.database !== target.database || identity.schema !== "public" || identity.read_only !== "on") return stop("SEED_IDENTITY_MISMATCH");
    if (target.mode === "local") {
      if (identity.address !== "127.0.0.1" || identity.branch || identity.endpoint) return stop("SEED_LOCAL_IDENTITY_MISMATCH");
    } else if (identity.branch !== target.branch || identity.endpoint !== target.endpoint) {
      return stop("SEED_PREVIEW_IDENTITY_MISMATCH");
    }
  }, { maxWait: 10_000, timeout: 20_000 });
}
