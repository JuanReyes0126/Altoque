import { describe, expect, it } from "vitest";
import { prisma } from "../database/prisma";
import { HAS_DB } from "./setup";

describe.runIf(HAS_DB)("Migraciones locales · integridad inspeccionada", () => {
  it("mantiene los índices únicos parciales y las claves importantes", async () => {
    const rows = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`SELECT indexname::text, indexdef::text FROM pg_indexes WHERE schemaname='public'`;
    const indexes = new Map(rows.map((row) => [row.indexname, row.indexdef]));
    const active = indexes.get("service_request_provider_active_unique") ?? "";
    expect(active).toContain("UNIQUE");
    expect(active).toContain("WHERE");
    for (const status of ["accepted", "on_the_way", "arrived", "in_progress"]) expect(active).toContain(status);
    expect(active).not.toContain("completed");
    expect(indexes.get("dispute_one_open_per_request")).toContain("WHERE");
    for (const name of ["user_email_key", "session_token_key", "provider_profile_user_id_key", "provider_profile_referral_code_key", "service_request_code_key", "review_request_id_key"]) expect(indexes.get(name)).toContain("UNIQUE");
  });

  it("mantiene los CHECKs de ratings y las relaciones de direcciones/archivos", async () => {
    const rows = await prisma.$queryRaw<Array<{ conname: string; definition: string }>>`SELECT conname::text, pg_get_constraintdef(oid)::text AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace`;
    const constraints = new Map(rows.map((row) => [row.conname, row.definition]));
    for (const name of ["review_rating_range", "review_punctuality_range", "review_quality_range", "review_communication_range"]) {
      expect(constraints.get(name)).toContain("CHECK");
    }
    expect(constraints.get("address_user_id_fkey")).toContain("ON DELETE CASCADE");
    expect(constraints.get("customer_profile_default_address_id_fkey")).toContain("ON DELETE SET NULL");
    expect(constraints.get("file_owner_id_fkey")).toContain("ON DELETE CASCADE");
  });

  it("las tres migraciones están aplicadas y existen issuer y file", async () => {
    const migrations = await prisma.$queryRaw<Array<{ migration_name: string; finished: boolean }>>`SELECT migration_name::text, finished_at IS NOT NULL AND rolled_back_at IS NULL AS finished FROM _prisma_migrations ORDER BY migration_name`;
    expect(migrations.map((migration) => migration.migration_name)).toEqual(["00000000000000_init", "20260907192000_add_account_issuer", "20260908120000_add_file_table"]);
    expect(migrations.every((migration) => migration.finished)).toBe(true);
    const columns = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`SELECT table_name::text, column_name::text FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('account','file')`;
    expect(columns.some((column) => column.table_name === "account" && column.column_name === "issuer")).toBe(true);
    expect(columns.some((column) => column.table_name === "file" && column.column_name === "owner_id")).toBe(true);
  });
});
