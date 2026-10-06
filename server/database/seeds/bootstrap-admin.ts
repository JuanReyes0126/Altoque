/** CLI manual exclusivo para crear/revisar el primer super_admin. Sin migraciones. */
import { PrismaClient } from "@prisma/client";
import { adminCredentials, bootstrapAdmin } from "./admin.js";
import { assertSeedIdentity, seedTarget } from "./safety.js";

let prisma: PrismaClient | undefined;
try {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--apply" && !arg.startsWith("--preview-endpoint=") && !arg.startsWith("--preview-branch="))
    || new Set(args).size !== args.length
    || args.filter((arg) => arg.startsWith("--preview-endpoint=")).length > 1
    || args.filter((arg) => arg.startsWith("--preview-branch=")).length > 1) throw new Error("ADMIN_SEED_ARGUMENTS_INVALID");
  if (!args.includes("--apply")) throw new Error("ADMIN_SEED_APPLY_REQUIRED");
  const credentials = adminCredentials(process.env);
  if (!credentials) throw new Error("ADMIN_SEED_CREDENTIALS_INVALID");
  const target = seedTarget(process.env, {
    apply: true, allowPreview: true,
    endpoint: args.find((arg) => arg.startsWith("--preview-endpoint="))?.slice("--preview-endpoint=".length),
    branch: args.find((arg) => arg.startsWith("--preview-branch="))?.slice("--preview-branch=".length),
  });
  prisma = new PrismaClient({ datasourceUrl: target.url, log: [] });
  await assertSeedIdentity(prisma, target);
  const result = await bootstrapAdmin(prisma, credentials);
  console.log(result === "created" ? "ADMIN_CREATED" : "ADMIN_ALREADY_PROVISIONED_PASSWORD_UNCHANGED");
} catch (error) {
  // No imprimir Error/Prisma completo: puede contener valores de conexión o input.
  const message = error instanceof Error ? error.message : "";
  console.error(/^(?:ADMIN|SEED)_[A-Z_]+$/.test(message) ? message : "ADMIN_SEED_FAILED");
  process.exitCode = 1;
} finally {
  try { await prisma?.$disconnect(); } catch { console.error("ADMIN_SEED_DISCONNECT_FAILED"); process.exitCode = 1; }
}
