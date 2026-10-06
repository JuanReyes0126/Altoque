import { describe, expect, it } from "vitest";
import { parsePaging } from "../lib/envelope.js";
import { redact, redactLogPath } from "../lib/logger.js";
import { sanitizeAuditMetadata } from "../lib/audit.js";

describe("Inputs de paginación", () => {
  it.each(["NaN", "Infinity", "-Infinity", "wat"])("%s no llega a Prisma como número inválido", (value) => {
    expect(parsePaging({ page: value, limit: value })).toEqual({ page: 1, limit: 20, skip: 0 });
  });
  it("normaliza decimales, negativos y offsets fuera del rango PostgreSQL", () => {
    expect(parsePaging({ page: "2.9", limit: "4.7" })).toEqual({ page: 2, limit: 4, skip: 4 });
    expect(parsePaging({ page: "-1", limit: "-10" })).toEqual({ page: 1, limit: 1, skip: 0 });
    const huge = parsePaging({ page: "1e100", limit: "100" });
    expect(Number.isInteger(huge.skip)).toBe(true);
    expect(huge.skip).toBeLessThanOrEqual(2_147_483_647);
  });
});

describe("Minimización de logs y auditoría", () => {
  it("redacta secretos dentro de arrays y variantes de nombres de entorno", () => {
    expect(redact({ rows: [{ access_token: "fixture-token", items: [{ password: "fixture-password" }] }], BETTER_AUTH_SECRET: "fixture-secret" })).toEqual({
      rows: [{ access_token: "[REDACTED]", items: [{ password: "[REDACTED]" }] }], BETTER_AUTH_SECRET: "[REDACTED]",
    });
  });
  it("no conserva mensajes ni stacks de objetos Error", () => {
    expect(redact({ error: new Error("private fixture payload") })).toEqual({ error: { name: "Error" } });
  });
  it("redacta conexión PG y tokens embebidos en URL", () => {
    const result = redact({ message: "postgresql://fixture:fixture@127.0.0.1:1/test", url: "https://example.invalid/verify?token=fixture&callbackURL=/" });
    expect(result.message).toBe("[CONNECTION_URL_REDACTED]");
    expect(result.url).toBe("https://example.invalid/verify?token=[REDACTED]&callbackURL=/");
  });
  it("redacta tokens de reset como segmento de ruta", () => {
    expect(redactLogPath("/api/v1/auth/reset-password/fixture-token")).toBe("/api/v1/auth/reset-password/[REDACTED]");
    expect(redactLogPath("/api/v1/healthz")).toBe("/api/v1/healthz");
  });
  it("auditmetadata elimina secretos anidados y mantiene los datos operativos", () => {
    expect(sanitizeAuditMetadata({ nested: { password: "fixture", action: "approved" }, rows: [{ accessToken: "fixture", id: "opaque-id" }], blob_key: "fixture" })).toEqual({
      nested: { action: "approved" }, rows: [{ id: "opaque-id" }],
    });
  });
});
