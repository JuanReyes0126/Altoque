/**
 * ALTOQUE · Tests de disputas (F5)
 *
 * Integración con fixtures propias. Cada escenario crea su solicitud;
 * ejecutar únicamente en una base de test separada y desechable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { DisputeStatus, RequestStatus, UserRole } from "@prisma/client";
import { app } from "../index.js";
import { prisma } from "../database/prisma.js";
import { ulid } from "../lib/ids.js";
import { HAS_DB } from "./setup";
import { createTestCookie, testHeaders } from "./session-helpers.js";

describe.runIf(HAS_DB)("Disputes API", () => {
  const fixturePrefix = `disputes-${ulid()}`;
  const userIds: string[] = [];
  const providerProfileIds: string[] = [];
  const requestIds: string[] = [];
  const disputeIds: string[] = [];
  const categoryIds: string[] = [];
  const zoneIds: string[] = [];
  let customerCookie: string;
  let providerCookie: string;
  let adminCookie: string;
  let customerId: string;
  let providerUserId: string;
  let providerProfileId: string;
  let adminId: string;
  let categoryId: string;
  let zoneId: string;

  async function createUser(name: string, role: UserRole = "customer") {
    const user = await prisma.user.create({
      data: {
        id: ulid(),
        name,
        email: `${fixturePrefix}-${ulid()}@test.invalid`,
        role,
        status: "active",
        emailVerified: true,
      },
    });
    userIds.push(user.id);
    return user;
  }

  async function createProviderProfile(userId: string) {
    const provider = await prisma.provider_profile.create({
      data: {
        id: ulid(),
        user_id: userId,
        verification_status: "verified",
        is_available: true,
        referral_code: `${fixturePrefix}-${ulid()}`,
      },
    });
    providerProfileIds.push(provider.id);
    return provider;
  }

  async function createRequest(
    status: RequestStatus = "completed",
    customerUserId = customerId,
    assignedProviderId: string | null = providerProfileId,
  ) {
    const request = await prisma.service_request.create({
      data: {
        id: ulid(),
        code: `ALT-TEST-${ulid()}`,
        customer_id: customerUserId,
        category_id: categoryId,
        zone_id: zoneId,
        description: "Solicitud propia de la suite de disputas",
        when_type: "now",
        status,
        provider_id: assignedProviderId,
      },
    });
    requestIds.push(request.id);
    return request;
  }

  async function createDispute(requestId: string, status: DisputeStatus = "open") {
    const dispute = await prisma.dispute.create({
      data: {
        id: ulid(),
        request_id: requestId,
        opened_by: customerId,
        reason: "Disputa propia del escenario de integración",
        status,
        ...(status === "open" ? {} : {
          resolved_by: adminId,
          resolution: "Resolución previa de este escenario",
        }),
      },
    });
    disputeIds.push(dispute.id);
    return dispute;
  }

  function postDispute(requestId: string, cookie: string, reason = "El servicio no fue completado correctamente") {
    return app.request("/api/v1/disputes", {
      method: "POST",
      headers: { ...testHeaders(cookie), "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: requestId, reason }),
    });
  }

  function resolveDispute(disputeId: string, cookie: string, status: "resolved_customer" | "resolved_provider" = "resolved_customer") {
    return app.request(`/api/v1/disputes/${disputeId}/resolve`, {
      method: "POST",
      headers: { ...testHeaders(cookie), "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolution: "Resolución válida de este escenario de integración" }),
    });
  }

  beforeAll(async () => {
    customerId = (await createUser("Disputes Customer")).id;
    providerUserId = (await createUser("Disputes Provider")).id;
    adminId = (await createUser("Disputes Admin", "admin")).id;
    providerProfileId = (await createProviderProfile(providerUserId)).id;
    await prisma.admin_profile.create({ data: { user_id: adminId, admin_role: "admin" } });

    const category = await prisma.category.create({
      data: { id: `${fixturePrefix}-category`, name: "Disputes Test", icon: "test", group_name: "Test" },
    });
    categoryIds.push(category.id);
    categoryId = category.id;
    const zone = await prisma.zone.create({ data: { id: `${fixturePrefix}-zone`, name: "Disputes Test" } });
    zoneIds.push(zone.id);
    zoneId = zone.id;

    customerCookie = await createTestCookie(customerId);
    providerCookie = await createTestCookie(providerUserId);
    adminCookie = await createTestCookie(adminId);
  });

  afterAll(async () => {
    // Un handler puede crear la disputa antes de devolver un error. Recuperar
    // únicamente las de nuestras solicitudes cubre ese caso y setup parcial.
    const createdDisputes = requestIds.length > 0
      ? await prisma.dispute.findMany({ where: { request_id: { in: requestIds } }, select: { id: true } })
      : [];
    const ownDisputeIds = [...new Set([...disputeIds, ...createdDisputes.map(({ id }) => id)])];

    await prisma.$transaction(async (tx) => {
      const notificationFilters = [
        ...(userIds.length > 0 ? [{ user_id: { in: userIds } }] : []),
        ...requestIds.map((id) => ({ meta: { path: ["requestId"], equals: id } })),
        ...ownDisputeIds.map((id) => ({ meta: { path: ["disputeId"], equals: id } })),
      ];
      if (notificationFilters.length > 0) {
        await tx.notification.deleteMany({ where: { OR: notificationFilters } });
      }
      const auditFilters = [
        ...(userIds.length > 0 ? [{ actor_id: { in: userIds } }] : []),
        ...(ownDisputeIds.length > 0 ? [{ entity_type: "dispute", entity_id: { in: ownDisputeIds } }] : []),
      ];
      if (auditFilters.length > 0) {
        await tx.admin_audit_log.deleteMany({ where: { OR: auditFilters } });
      }
      if (ownDisputeIds.length > 0) await tx.dispute.deleteMany({ where: { id: { in: ownDisputeIds } } });
      if (requestIds.length > 0) await tx.service_request.deleteMany({ where: { id: { in: requestIds } } });
      if (providerProfileIds.length > 0) await tx.provider_profile.deleteMany({ where: { id: { in: providerProfileIds } } });
      if (userIds.length > 0) {
        await tx.admin_profile.deleteMany({ where: { user_id: { in: userIds } } });
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
      }
      if (categoryIds.length > 0) await tx.category.deleteMany({ where: { id: { in: categoryIds } } });
      if (zoneIds.length > 0) await tx.zone.deleteMany({ where: { id: { in: zoneIds } } });
    });
  });

  it("A. customer puede crear disputa sobre request completado propio", async () => {
    const request = await createRequest();
    const res = await postDispute(request.id, customerCookie);
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.id).toEqual(expect.any(String));
    disputeIds.push(data.id);
    expect(data.request_id).toBe(request.id);
    expect(data.opened_by).toBe(customerId);
    expect(data.status).toBe("open");
    expect(await prisma.notification.count({
      where: { user_id: adminId, kind: "dispute_opened", meta: { path: ["disputeId"], equals: data.id } },
    })).toBe(1);
  });

  it("B. customer NO puede crear disputa sobre request ajeno", async () => {
    const otherCustomer = await createUser("Disputes Other Customer");
    const request = await createRequest("completed", otherCustomer.id);
    const res = await postDispute(request.id, customerCookie);
    expect(res.status).toBe(403);
    expect(await prisma.dispute.count({ where: { request_id: request.id } })).toBe(0);
  });

  it("C. provider asignado puede crear disputa sobre request completado", async () => {
    const request = await createRequest();
    const res = await postDispute(request.id, providerCookie, "El cliente no pagó el servicio completado");
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.id).toEqual(expect.any(String));
    disputeIds.push(data.id);
    expect(data.opened_by).toBe(providerUserId);
    expect(data.request.provider_id).toBe(providerProfileId);
    expect(data.request_id).toBe(request.id);
  });

  it("D. provider ajeno NO puede crear disputa", async () => {
    const request = await createRequest();
    const otherProvider = await createUser("Disputes Other Provider");
    await createProviderProfile(otherProvider.id);
    const cookie = await createTestCookie(otherProvider.id);
    const res = await postDispute(request.id, cookie);
    expect(res.status).toBe(403);
    expect(await prisma.dispute.count({ where: { request_id: request.id } })).toBe(0);
  });

  it("E. usuario no relacionado NO puede leer disputa", async () => {
    const request = await createRequest();
    const dispute = await createDispute(request.id);
    const unrelatedUser = await createUser("Disputes Unrelated User");
    const cookie = await createTestCookie(unrelatedUser.id);
    const res = await app.request(`/api/v1/disputes/${dispute.id}`, { headers: testHeaders(cookie) });
    expect(res.status).toBe(403);
    const { error } = await res.json();
    expect(error.code).toBe("FORBIDDEN");
  });

  it("F. duplicate open dispute falla", async () => {
    const request = await createRequest();
    await createDispute(request.id);
    const res = await postDispute(request.id, customerCookie);
    expect(res.status).toBe(409);
    const { error } = await res.json();
    expect(error.code).toBe("CONFLICT");
    expect(await prisma.dispute.count({ where: { request_id: request.id, status: "open" } })).toBe(1);
  });

  it("G. request en estado searching NO es elegible para disputa", async () => {
    const request = await createRequest("searching", customerId, null);
    const res = await postDispute(request.id, customerCookie);
    expect(res.status).toBe(409);
    expect(await prisma.dispute.count({ where: { request_id: request.id } })).toBe(0);
  });

  it("H. admin puede listar todas las disputas", async () => {
    const request = await createRequest();
    const dispute = await createDispute(request.id);
    const res = await app.request("/api/v1/disputes/admin/all?status=open&limit=100", { headers: testHeaders(adminCookie) });
    expect(res.status).toBe(200);
    const { data, meta } = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toEqual(expect.arrayContaining([expect.objectContaining({ id: dispute.id, request_id: request.id })]));
    expect(meta.total).toBeGreaterThanOrEqual(1);
  });

  it("I. non-admin NO puede listar todas las disputas", async () => {
    const res = await app.request("/api/v1/disputes/admin/all", { headers: testHeaders(customerCookie) });
    expect(res.status).toBe(403);
    const { error } = await res.json();
    expect(error.code).toBe("FORBIDDEN");
  });

  it("J. admin puede resolver disputa", async () => {
    const request = await createRequest();
    const dispute = await createDispute(request.id);
    const res = await resolveDispute(dispute.id, adminCookie);
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.status).toBe("resolved_customer");
    expect(data.resolved_by).toBe(adminId);
    expect(data.request.status).toBe("completed");
    expect(await prisma.admin_audit_log.count({
      where: { actor_id: adminId, action: "DISPUTE_RESOLVED", entity_type: "dispute", entity_id: dispute.id },
    })).toBe(1);
    const notifications = await prisma.notification.findMany({
      where: { user_id: { in: [customerId, providerUserId] }, kind: "dispute_resolved", meta: { path: ["disputeId"], equals: dispute.id } },
      select: { user_id: true },
    });
    expect(notifications.map(({ user_id }) => user_id).sort()).toEqual([customerId, providerUserId].sort());
  });

  it("K. non-admin NO puede resolver disputa", async () => {
    const request = await createRequest();
    const dispute = await createDispute(request.id);
    const res = await resolveDispute(dispute.id, customerCookie);
    expect(res.status).toBe(403);
    expect(await prisma.dispute.findUnique({ where: { id: dispute.id }, select: { status: true } })).toEqual({ status: "open" });
    expect(await prisma.admin_audit_log.count({ where: { entity_type: "dispute", entity_id: dispute.id } })).toBe(0);
  });

  it("L. disputa ya resuelta NO puede resolverse otra vez", async () => {
    const request = await createRequest();
    const dispute = await createDispute(request.id, "resolved_customer");
    const res = await resolveDispute(dispute.id, adminCookie, "resolved_provider");
    expect(res.status).toBe(409);
    expect(await prisma.dispute.findUnique({
      where: { id: dispute.id }, select: { status: true, resolution: true },
    })).toEqual({ status: "resolved_customer", resolution: dispute.resolution });
  });

  it("M. request sin provider no rompe resolución admin", async () => {
    const request = await createRequest("completed", customerId, null);
    const dispute = await createDispute(request.id);
    const res = await resolveDispute(dispute.id, adminCookie);
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.status).toBe("resolved_customer");
    expect(data.request.provider_id).toBeNull();
    const notifications = await prisma.notification.findMany({
      where: { kind: "dispute_resolved", meta: { path: ["disputeId"], equals: dispute.id } },
      select: { user_id: true },
    });
    expect(notifications).toEqual([{ user_id: customerId }]);
  });

  it("N. reason demasiado corto falla validación", async () => {
    const request = await createRequest();
    const res = await postDispute(request.id, customerCookie, "Corto");
    expect(res.status).toBe(400);
    expect(await prisma.dispute.count({ where: { request_id: request.id } })).toBe(0);
  });
});
