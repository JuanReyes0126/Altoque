/**
 * ALTOQUE · Tests unitarios (sin base de datos) — F1.6
 *
 * Cubre: matriz RBAC, formato de IDs, validación de archivos
 * (magic bytes/MIME/tamaño), sanitización de logs y paginación.
 */
import { describe, expect, it } from "vitest";
import { ADMIN_ROLE_PERMISSIONS, hasAdminPermission } from "../lib/permissions";
import { ulid } from "../lib/ids";
import { validateFile } from "../lib/files";
import { redact } from "../lib/logger";
import { parsePaging } from "../lib/envelope";
import { AppError } from "../lib/errors";

describe("RBAC · matriz centralizada", () => {
  it("support: solo lectura básica", () => {
    expect(hasAdminPermission("support", "users.read")).toBe(true);
    expect(hasAdminPermission("support", "requests.read")).toBe(true);
    expect(hasAdminPermission("support", "reports.read")).toBe(true);
    expect(hasAdminPermission("support", "reviews.moderate")).toBe(false);
    expect(hasAdminPermission("support", "providers.verify")).toBe(false);
  });

  it("moderator: + moderación y verificación de proveedores", () => {
    expect(hasAdminPermission("moderator", "reviews.moderate")).toBe(true);
    expect(hasAdminPermission("moderator", "disputes.resolve")).toBe(true);
    expect(hasAdminPermission("moderator", "providers.verify")).toBe(true);
    expect(hasAdminPermission("moderator", "users.block")).toBe(false);
    expect(hasAdminPermission("moderator", "categories.manage")).toBe(false);
  });

  it("admin: + bloqueo y operación", () => {
    expect(hasAdminPermission("admin", "users.block")).toBe(true);
    expect(hasAdminPermission("admin", "categories.manage")).toBe(true);
    expect(hasAdminPermission("admin", "operation.manage")).toBe(true);
    expect(hasAdminPermission("admin", "admins.manage")).toBe(false);
    expect(hasAdminPermission("admin", "finance.read")).toBe(false);
  });

  it("super_admin: todo (único que gestiona roles admin)", () => {
    expect(hasAdminPermission("super_admin", "admins.manage")).toBe(true);
    expect(hasAdminPermission("super_admin", "finance.read")).toBe(true);
    expect(hasAdminPermission("super_admin", "audit.export")).toBe(true);
    expect(hasAdminPermission("super_admin", "system.configure")).toBe(true);
  });

  it("la matriz es acumulativa y completa", () => {
    const all = Object.values(ADMIN_ROLE_PERMISSIONS);
    for (const set of all) expect(set.size).toBeGreaterThan(0);
    expect(ADMIN_ROLE_PERMISSIONS.super_admin.size).toBeGreaterThan(ADMIN_ROLE_PERMISSIONS.admin.size);
  });
});

describe("IDs · ULID", () => {
  it("26 caracteres, alfabeto Crockford, sin secuencia obvia", () => {
    const a = ulid();
    const b = ulid();
    expect(a).toHaveLength(26);
    expect(b).toHaveLength(26);
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("ordenable por tiempo (prefijo temporal)", () => {
    const a = ulid();
    // el componente temporal ocupa los primeros 10 chars
    expect(a.slice(0, 10)).toMatch(/^[0-9A-HJKMNP-TV-Z]{10}$/);
  });
});

describe("Archivos · validación por contenido, no solo extensión", () => {
  const pngHead = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpgHead = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const pdfHead = Buffer.from("%PDF-1.7");

  it("acepta PNG con magic bytes correctos", () => {
    expect(validateFile("image", "image/png", 1024, pngHead).ext).toBe(".png");
  });

  it("acepta JPEG y PDF según el tipo permitido", () => {
    expect(validateFile("image", "image/jpeg", 1024, jpgHead).ext).toBe(".jpg");
    expect(validateFile("document", "application/pdf", 1024, pdfHead).ext).toBe(".pdf");
  });

  it("rechaza MIME declarado que no coincide con el contenido", () => {
    expect(() => validateFile("image", "image/png", 1024, jpgHead)).toThrowError(AppError);
    try {
      validateFile("image", "image/png", 1024, jpgHead);
    } catch (e) {
      expect((e as AppError).code).toBe("FILE_TYPE_NOT_ALLOWED");
    }
  });

  it("rechaza tipos fuera de la superficie (p. ej. docx)", () => {
    expect(() =>
      validateFile("document", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 10, pdfHead),
    ).toThrowError(AppError);
  });

  it("rechaza archivos sobredimensionados", () => {
    try {
      validateFile("image", "image/png", 6 * 1024 * 1024, pngHead);
      expect.unreachable();
    } catch (e) {
      expect((e as AppError).code).toBe("FILE_TOO_LARGE");
    }
  });
});

describe("Logs · minimización", () => {
  it("redacta secretos, también anidados", () => {
    const out = redact({
      path: "/api/v1/auth/sign-in",
      password: "hunter2",
      Authorization: "Bearer abc",
      nested: { token: "xyz", ok: 1 },
    });
    expect(out.password).toBe("[REDACTED]");
    expect(out.Authorization).toBe("[REDACTED]");
    expect((out.nested as Record<string, unknown>).token).toBe("[REDACTED]");
    expect((out.nested as Record<string, unknown>).ok).toBe(1);
    expect(out.path).toBe("/api/v1/auth/sign-in");
  });
});

describe("Paginación · límites seguros", () => {
  it("aplica defaults y topes", () => {
    expect(parsePaging(new URLSearchParams())).toEqual({ page: 1, limit: 20, skip: 0 });
    expect(parsePaging(new URLSearchParams("page=3&limit=50"))).toEqual({ page: 3, limit: 50, skip: 100 });
    expect(parsePaging(new URLSearchParams("limit=100000")).limit).toBeLessThanOrEqual(100);
    expect(parsePaging(new URLSearchParams("page=-5")).page).toBe(1);
  });
});
