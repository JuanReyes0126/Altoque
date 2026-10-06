/** A18: solo fixtures propias en PostgreSQL temporal del runner. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../index.js";
import { prisma } from "../database/prisma.js";
import { ulid } from "../lib/ids.js";
import { HAS_DB } from "./setup";
import { createTestCookie, testHeaders } from "./session-helpers.js";

describe.runIf(HAS_DB)("A18 · paginación administrativa en PostgreSQL aislado", () => {
  const userIds: string[] = [];
  const providerIds: string[] = [];
  const requestIds: string[] = [];
  const disputeIds: string[] = [];
  const auditIds: string[] = [];
  const categoryId = ulid(); const zoneId = ulid();
  const createdAt = new Date("2025-01-01T12:00:00Z");
  let adminCookie: string; let customerCookie: string;
  let adminId: string; let customerId: string;

  async function user(role: "customer" | "provider" | "admin") {
    const id = ulid(); userIds.push(id);
    await prisma.user.create({ data: {
      id, role, name: "Pagination fixture", email: `pagination-${id.toLowerCase()}@test.altoque.do`,
      emailVerified: true, createdAt,
      ...(role === "admin" ? { admin_profile: { create: { admin_role: "super_admin" } } } : {}),
    } });
    return id;
  }

  beforeAll(async () => {
    adminId = await user("admin"); customerId = await user("customer");
    adminCookie = await createTestCookie(adminId); customerCookie = await createTestCookie(customerId);
    await prisma.category.create({ data: { id: categoryId, name: "Pagination category", icon: "wrench", group_name: "Test" } });
    await prisma.zone.create({ data: { id: zoneId, name: "Pagination zone" } });
    for (let index = 0; index < 3; index++) {
      const providerUserId = await user("provider");
      const providerId = ulid(); providerIds.push(providerId);
      await prisma.provider_profile.create({ data: {
        id: providerId, user_id: providerUserId, referral_code: `PAGE-${providerId}`,
        verification_status: "verified", created_at: createdAt,
      } });
      const requestId = ulid(); requestIds.push(requestId);
      await prisma.service_request.create({ data: {
        id: requestId, code: `PAGE-${requestId}`, customer_id: customerId, provider_id: providerId,
        category_id: categoryId, zone_id: zoneId, description: "Pagination fixture",
        when_type: "now", status: "completed", created_at: createdAt,
      } });
      const disputeId = ulid(); disputeIds.push(disputeId);
      await prisma.dispute.create({ data: {
        id: disputeId, request_id: requestId, opened_by: customerId,
        reason: "Pagination fixture dispute", created_at: createdAt,
      } });
      const auditId = ulid(); auditIds.push(auditId);
      await prisma.admin_audit_log.create({ data: {
        id: auditId, actor_id: adminId, actor_name: "Pagination admin", actor_admin_role: "super_admin",
        action: "TEST_PAGINATION", entity_type: "request", entity_id: requestId, at: createdAt,
      } });
    }
  });

  afterAll(async () => {
    await prisma.admin_audit_log.deleteMany({ where: { OR: [{ id: { in: auditIds } }, { actor_id: { in: userIds } }] } });
    await prisma.notification.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.service_request.deleteMany({ where: { id: { in: requestIds } } });
    await prisma.provider_profile.deleteMany({ where: { id: { in: providerIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.zone.deleteMany({ where: { id: zoneId } });
  });

  async function list(path: string, query: string, cookie = adminCookie) {
    const response = await app.request(`${path}?${query}`, { headers: testHeaders(cookie) });
    expect(response.status).toBe(200);
    return response.json();
  }

  const endpoints = [
    { name: "usuarios", path: "/api/v1/admin/users", ids: userIds },
    { name: "proveedores", path: "/api/v1/admin/providers", ids: providerIds },
    { name: "solicitudes", path: "/api/v1/admin/requests", ids: requestIds },
    { name: "disputas", path: "/api/v1/disputes/admin/all", ids: disputeIds },
    { name: "auditoría", path: "/api/v1/admin/audit", ids: auditIds },
  ];

  it.each(endpoints)("$name: páginas limitadas, metadata exacta y desempate estable por id", async ({ path, ids }) => {
    const expected = [...ids].sort().reverse();
    const pages = Math.ceil(ids.length / 2);
    const seen: string[] = [];
    for (let page = 1; page <= pages; page++) {
      const result = await list(path, `page=${page}&limit=2`);
      expect(result.meta).toEqual({ page, limit: 2, total: ids.length, pages });
      expect(result.data.map((item: { id: string }) => item.id)).toEqual(expected.slice((page - 1) * 2, page * 2));
      seen.push(...result.data.map((item: { id: string }) => item.id));
    }
    expect(seen).toEqual(expected);
    expect(new Set(seen).size).toBe(ids.length);
  });

  it.each(endpoints)("$name: página fuera de rango conserva total y permite recuperar la última válida", async ({ path, ids }) => {
    const result = await list(path, "page=999&limit=2");
    expect(result).toEqual({ data: [], meta: { page: 999, limit: 2, total: ids.length, pages: Math.ceil(ids.length / 2) } });
  });

  it.each(endpoints)("$name: backend limita a 100 y conserva RBAC en páginas posteriores", async ({ path, ids }) => {
    const result = await list(path, "page=1&limit=1000");
    expect(result.meta).toEqual({ page: 1, limit: 100, total: ids.length, pages: 1 });
    expect(result.data).toHaveLength(ids.length);
    const response = await app.request(`${path}?page=2&limit=2`, { headers: testHeaders(customerCookie) });
    expect(response.status).toBe(403);
  });

  it("filtro sin resultados devuelve éxito vacío con metadata de página 1", async () => {
    const result = await list("/api/v1/admin/users", "page=1&limit=20&q=NO_PAGINATION_FIXTURE_MATCH");
    expect(result).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 1 } });
  });

  it("un total que disminuye tras resolver admite consultar la nueva última página", async () => {
    const before = await list("/api/v1/disputes/admin/all", "status=open&page=2&limit=2");
    expect(before.meta).toMatchObject({ page: 2, pages: 2, total: 3 });
    const response = await app.request(`/api/v1/disputes/${before.data[0].id}/resolve`, {
      method: "POST", headers: { ...testHeaders(adminCookie), "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved_customer", resolution: "Pagination fixture resolved" }),
    });
    expect(response.status).toBe(200);
    const after = await list("/api/v1/disputes/admin/all", "status=open&page=2&limit=2");
    expect(after).toMatchObject({ data: [], meta: { page: 2, pages: 1, total: 2 } });
    const last = await list("/api/v1/disputes/admin/all", `status=open&page=${after.meta.pages}&limit=2`);
    expect(last.data).toHaveLength(2);
  });
});
