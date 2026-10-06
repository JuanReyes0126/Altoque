/** A20: fixtures propias; solo PostgreSQL temporal creado por el runner. */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../index.js";
import { prisma } from "../database/prisma.js";
import { ulid } from "../lib/ids.js";
import { log } from "../lib/logger.js";
import { HAS_DB } from "./setup";
import { createTestCookie, testHeaders } from "./session-helpers.js";

describe.runIf(HAS_DB)("A20 · JSON inválido en las rutas protegidas", () => {
  const userIds: string[] = [];
  const categoryId = ulid(); const zoneId = ulid(); const resourceId = ulid();
  const cookies: Record<string, string> = {};
  const marker = "a20-private-body-fixture";
  const malformedBody = `{"note":"${marker}",`;

  const routes = [
    { path: "/api/v1/requests", method: "POST", actor: "customer" },
    { path: `/api/v1/requests/${resourceId}/review`, method: "POST", actor: "customer" },
    { path: "/api/v1/provider/me", method: "POST", actor: "provider" },
    { path: "/api/v1/provider/me", method: "PATCH", actor: "provider" },
    { path: "/api/v1/provider/availability", method: "PATCH", actor: "provider" },
    { path: `/api/v1/provider/requests/${resourceId}/claim`, method: "POST", actor: "provider" },
    { path: `/api/v1/provider/requests/${resourceId}/status`, method: "POST", actor: "provider" },
    { path: "/api/v1/disputes", method: "POST", actor: "customer" },
    { path: `/api/v1/disputes/${resourceId}/resolve`, method: "POST", actor: "admin" },
    { path: "/api/v1/me/addresses", method: "POST", actor: "customer" },
    { path: `/api/v1/me/addresses/${resourceId}`, method: "PATCH", actor: "customer" },
    { path: `/api/v1/admin/users/${resourceId}/suspend`, method: "POST", actor: "admin" },
    { path: `/api/v1/admin/users/${resourceId}/block`, method: "POST", actor: "admin" },
    { path: `/api/v1/admin/providers/${resourceId}/reject`, method: "POST", actor: "admin" },
  ];

  function send(route: typeof routes[number], body = malformedBody, cookie = cookies[route.actor]) {
    return app.request(route.path, {
      method: route.method,
      headers: { ...testHeaders(cookie), "Content-Type": "application/json" }, body,
    });
  }

  beforeAll(async () => {
    for (const role of ["customer", "provider", "admin"] as const) {
      const id = ulid(); userIds.push(id);
      await prisma.user.create({ data: {
        id, role, name: "JSON fixture", email: `json-${id.toLowerCase()}@test.altoque.do`,
        emailVerified: true,
        ...(role === "admin" ? { admin_profile: { create: { admin_role: "super_admin" } } } : {}),
      } });
      cookies[role] = await createTestCookie(id);
    }
    const id = ulid(); userIds.push(id);
    await prisma.user.create({ data: {
      id, role: "customer", name: "Unverified JSON fixture", email: `json-${id.toLowerCase()}@test.altoque.do`,
      emailVerified: false,
    } });
    cookies.unverified = await createTestCookie(id);
    await prisma.category.create({ data: { id: categoryId, name: "JSON category", icon: "wrench", group_name: "Test" } });
    await prisma.zone.create({ data: { id: zoneId, name: "JSON zone" } });
  });

  beforeEach(() => {
    vi.spyOn(log, "info").mockImplementation(() => {});
    vi.spyOn(log, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await prisma.rate_limit.deleteMany({ where: { subject: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.zone.deleteMany({ where: { id: zoneId } });
  });

  it.each(routes)("$method $path: JSON inválido devuelve 400 común y no revela el body", async (route) => {
    const response = await send(route);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: {
      code: "VALIDATION_ERROR", message: "Datos inválidos",
      details: [{ path: "body", message: "El cuerpo debe contener JSON válido" }],
    } });
    expect(JSON.stringify(vi.mocked(log.info).mock.calls)).not.toContain(marker);
    expect(log.error).not.toHaveBeenCalled();
  });

  it.each(routes)("$method $path: JSON válido con shape inválido sigue siendo 400 semántico", async (route) => {
    const response = await send(route, "null");
    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(result.error.details).not.toEqual([{ path: "body", message: "El cuerpo debe contener JSON válido" }]);
    expect(log.error).not.toHaveBeenCalled();
  });

  it.each(routes)("$method $path: sesión obligatoria antes de analizar JSON", async (route) => {
    const response = await send(route, malformedBody, "");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: "UNAUTHENTICATED", message: "Sesión requerida" } });
  });

  it.each(routes.filter((route) => route.actor === "admin"))
    ("$method $path: RBAC rechaza antes de analizar JSON", async (route) => {
      const response = await send(route, malformedBody, cookies.customer);
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe("FORBIDDEN");
    });

  it("la verificación de email precede a la validación JSON", async () => {
    const response = await send(routes[0], malformedBody, cookies.unverified);
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("EMAIL_NOT_VERIFIED");
  });

  const databaseCases = [
    { name: "requests", route: routes[0], body: {
      category_id: categoryId, zone_id: zoneId, description: "JSON fixture request", when_type: "now",
    }, fail: () => vi.spyOn(prisma.category, "findFirst") },
    { name: "providers", route: routes[4], body: { is_available: true },
      fail: () => vi.spyOn(prisma.provider_profile, "findUnique") },
    { name: "disputes", route: routes[7], body: { request_id: resourceId, reason: "JSON fixture dispute reason" },
      fail: () => vi.spyOn(prisma.service_request, "findUnique") },
  ];
  it.each(databaseCases)("$name: un fallo real de DB tras JSON válido conserva 500", async ({ route, body, fail }) => {
    // Incluso un SyntaxError originado después de parsear no es un body inválido.
    const databaseError = new SyntaxError("A20_INTERNAL_DB_FAILURE");
    fail().mockRejectedValueOnce(databaseError);
    const response = await send(route, JSON.stringify(body));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: { code: "INTERNAL_ERROR", message: "Error interno del servidor" } });
    expect(log.error).toHaveBeenCalledWith("unhandled_error", expect.objectContaining({ errorType: "SyntaxError" }));
    expect(JSON.stringify(vi.mocked(log.error).mock.calls)).not.toContain(databaseError.message);
  });

  it.each([TypeError, SyntaxError])("un fallo de lectura %s conserva 500 y no filtra su detalle", async (ErrorType) => {
    const request = new Request("http://localhost/api/v1/requests", {
      method: "POST", headers: { ...testHeaders(cookies.customer), "Content-Type": "application/json" }, body: "{}",
    });
    Object.defineProperty(request, "text", { value: async () => { throw new ErrorType("A20_BODY_READ_FAILURE"); } });
    const response = await app.request(request);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: { code: "INTERNAL_ERROR", message: "Error interno del servidor" } });
    expect(JSON.stringify(vi.mocked(log.error).mock.calls)).not.toContain("A20_BODY_READ_FAILURE");
  });

  it("rechazar estos cuerpos no crea solicitudes, perfiles, direcciones, disputas ni auditorías", async () => {
    expect(await prisma.service_request.count({ where: { customer_id: { in: userIds } } })).toBe(0);
    expect(await prisma.provider_profile.count({ where: { user_id: { in: userIds } } })).toBe(0);
    expect(await prisma.address.count({ where: { user_id: { in: userIds } } })).toBe(0);
    expect(await prisma.dispute.count({ where: { opened_by: { in: userIds } } })).toBe(0);
    expect(await prisma.admin_audit_log.count({ where: { actor_id: { in: userIds } } })).toBe(0);
  });
});
