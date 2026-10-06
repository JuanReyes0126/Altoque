import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { RequestStatus } from "@prisma/client";
import { app } from "../index.js";
import { prisma, type Tx } from "../database/prisma.js";
import { ulid } from "../lib/ids.js";
import { HAS_DB } from "./setup";
import { createTestCookie, testHeaders } from "./session-helpers.js";

describe.runIf(HAS_DB)("Backend · ownership y concurrencia de transiciones", () => {
  const users: Record<string, string> = {};
  const cookies: Record<string, string> = {};
  const requestIds: string[] = [];
  const zones: string[] = [];
  const categoryId = ulid();
  const keys: Record<string, string> = {};
  let providerId: string;
  let categoryCreated = false;
  let sequenceCreated = false;

  const send = (path: string, name = "customer", body?: unknown, method = "POST") => app.request(path, {
    method, headers: { ...testHeaders(cookies[name]), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  async function makeRequest(status: RequestStatus = "searching", customerId = users.customer, zoneId = zones[0]) {
    const created = await prisma.service_request.create({ data: {
      id: ulid(), code: `REG-${ulid()}`, customer_id: customerId, category_id: categoryId, zone_id: zoneId,
      description: "Backend regression fixture", when_type: "now", status, provider_id: status === "searching" ? null : providerId,
    } });
    requestIds.push(created.id);
    return created;
  }

  beforeAll(async () => {
    await prisma.category.create({ data: { id: categoryId, name: "Backend regression", icon: "wrench", group_name: "Test" } });
    categoryCreated = true;
    for (let index = 0; index < 2; index++) {
      const zone = await prisma.zone.create({ data: { id: ulid(), name: `Backend zone ${index}` } });
      zones.push(zone.id);
    }
    for (const name of ["customer", "provider", "other", "admin", "fake-admin", "support"]) {
      const user = await prisma.user.create({ data: {
        id: ulid(), name, email: `backend-${ulid()}@test.altoque.do`, emailVerified: true,
        role: name.includes("admin") || name === "support" ? "admin" : "customer", status: "active",
      } });
      users[name] = user.id;
      cookies[name] = await createTestCookie(user.id);
    }
    await prisma.admin_profile.createMany({ data: [
      { user_id: users.admin, admin_role: "moderator" }, { user_id: users.support, admin_role: "support" },
    ] });
    const provider = await prisma.provider_profile.create({ data: {
      id: ulid(), user_id: users.provider, verification_status: "verified", referral_code: `REG-${ulid()}`,
      provider_service: { create: { category_id: categoryId, price_from: 0 } },
      provider_zone: { create: { zone_id: zones[0] } },
    } });
    providerId = provider.id;
    for (const name of ["own", "other", "document", "public"]) {
      keys[name] = `request-photos/regression/${ulid()}.jpg`;
      await prisma.file.create({ data: {
        id: ulid(), owner_id: name === "other" ? users.other : users.customer,
        blob_key: keys[name], purpose: name === "document" ? "provider_document" : "request_photo",
        visibility: name === "public" ? "public" : "private", mime: "image/jpeg", size_bytes: 8,
      } });
    }
    if (!await prisma.request_code_seq.findUnique({ where: { id: 1 } })) {
      await prisma.request_code_seq.create({ data: { id: 1, last_value: 0 } });
      sequenceCreated = true;
    }
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    // Toda fila eliminada pertenece a los IDs de esta suite exclusiva.
    await prisma.service_request.deleteMany({ where: { id: { in: requestIds } } });
    requestIds.length = 0;
    await prisma.notification.deleteMany({ where: { user_id: { in: Object.values(users) } } });
    await prisma.admin_audit_log.deleteMany({ where: { actor_id: { in: Object.values(users) } } });
  });

  afterAll(async () => {
    try {
      await prisma.service_request.deleteMany({ where: { customer_id: { in: Object.values(users) } } });
      await prisma.notification.deleteMany({ where: { user_id: { in: Object.values(users) } } });
      await prisma.admin_audit_log.deleteMany({ where: { actor_id: { in: Object.values(users) } } });
      await prisma.rate_limit.deleteMany({ where: { subject: { in: Object.values(users) } } });
      await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
      if (categoryCreated) await prisma.category.deleteMany({ where: { id: categoryId } });
      await prisma.zone.deleteMany({ where: { id: { in: zones } } });
      if (sequenceCreated) await prisma.request_code_seq.deleteMany({ where: { id: 1 } });
    } finally { await prisma.$disconnect(); }
  });

  const requestBody = (photos: Array<{ blob_key: string; sort: number }>) => ({
    category_id: categoryId, zone_id: zones[0], description: "Ownership foto", when_type: "now", photos,
  });

  it("rechaza referencias a fotos ajenas, públicas, documentos y claves inexistentes", async () => {
    for (const key of [keys.other, keys.document, keys.public, `missing/${ulid()}`]) {
      const response = await send("/api/v1/requests", "customer", requestBody([{ blob_key: key, sort: 0 }]));
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    }
    expect(await prisma.service_request.count({ where: { customer_id: users.customer } })).toBe(0);
  });

  it("acepta una foto privada propia y conserva su asociación", async () => {
    const response = await send("/api/v1/requests", "customer", requestBody([{ blob_key: keys.own, sort: 0 }]));
    expect(response.status).toBe(201);
    const created = (await response.json()).data;
    requestIds.push(created.id);
    expect(created.request_photo).toEqual([expect.objectContaining({ blob_key: keys.own, request_id: created.id })]);
  });

  it("rechaza fotos duplicadas sin crear solicitud parcial", async () => {
    const response = await send("/api/v1/requests", "customer", requestBody([0, 1].map((sort) => ({ blob_key: keys.own, sort }))));
    expect(response.status).toBe(400);
    expect(await prisma.service_request.count({ where: { customer_id: users.customer } })).toBe(0);
  });

  it("un profesional no puede reclamar su propia solicitud", async () => {
    const request = await makeRequest("searching", users.provider);
    expect((await send(`/api/v1/provider/requests/${request.id}/claim`, "provider", { eta_min: 15 })).status).toBe(403);
    expect((await prisma.service_request.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("searching");
  });

  it("un profesional no puede reclamar fuera de sus zonas", async () => {
    const request = await makeRequest("searching", users.customer, zones[1]);
    expect((await send(`/api/v1/provider/requests/${request.id}/claim`, "provider", { eta_min: 15 })).status).toBe(403);
    expect(await prisma.request_status_history.count({ where: { request_id: request.id } })).toBe(0);
  });

  it("crear un perfil rechaza catálogos inválidos o repetidos sin registros parciales", async () => {
    const invalid = [
      { category_ids: [ulid()], zone_ids: [zones[0]] },
      { category_ids: [categoryId], zone_ids: [ulid()] },
      { category_ids: [categoryId, categoryId], zone_ids: [zones[0]] },
      { category_ids: [categoryId], zone_ids: [zones[0], zones[0]] },
    ];
    for (const body of invalid) expect((await send("/api/v1/provider/me", "other", body)).status).toBe(400);
    expect(await prisma.provider_profile.count({ where: { user_id: users.other } })).toBe(0);
  });

  it("PATCH de un perfil inexistente responde 404 en vez de un fallo Prisma", async () => {
    expect((await send("/api/v1/provider/me", "other", { bio: "Actualización sin perfil" }, "PATCH")).status).toBe(404);
  });

  it.each(["cancel", "confirm", "review"])("%s concurrente solo aplica una transición", async (action) => {
    const status = action === "cancel" ? "searching" : action === "confirm" ? "completed" : "confirmed";
    const request = await makeRequest(status);
    const responses = await Promise.all([0, 1, 2].map(() => send(`/api/v1/requests/${request.id}/${action}`, "customer", action === "review" ? { rating: 5 } : undefined)));
    expect(responses.map((response) => response.status).sort()).toEqual(action === "review" ? [201, 409, 409] : [200, 409, 409]);
    expect(await prisma.request_status_history.count({ where: { request_id: request.id } })).toBe(1);
    if (action === "review") expect(await prisma.review.count({ where: { request_id: request.id } })).toBe(1);
  });

  it("una transición profesional concurrente no duplica historial ni notificaciones", async () => {
    const request = await makeRequest("accepted");
    const responses = await Promise.all([0, 1, 2].map(() => send(`/api/v1/provider/requests/${request.id}/status`, "provider", { status: "on_the_way" })));
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409, 409]);
    expect(await prisma.request_status_history.count({ where: { request_id: request.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { user_id: users.customer, kind: "provider_on_the_way" } })).toBe(1);
  });

  it("cancelación y avance concurrentes no sobrescriben la transición ganadora", async () => {
    const request = await makeRequest("accepted");
    const responses = await Promise.all([
      send(`/api/v1/requests/${request.id}/cancel`, "customer"),
      send(`/api/v1/provider/requests/${request.id}/status`, "provider", { status: "on_the_way" }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const saved = await prisma.service_request.findUniqueOrThrow({ where: { id: request.id } });
    expect(["cancelled", "on_the_way"]).toContain(saved.status);
    const history = await prisma.request_status_history.findMany({ where: { request_id: request.id } });
    expect(history).toHaveLength(1);
    expect(history[0].to_status).toBe(saved.status);
  });

  it("dos aperturas concurrentes crean una sola disputa y devuelven un conflicto limpio", async () => {
    const request = await makeRequest("completed");
    const responses = await Promise.all([0, 1].map(() => send("/api/v1/disputes", "customer", { request_id: request.id, reason: "Servicio disputado en regresión" })));
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await prisma.dispute.count({ where: { request_id: request.id, status: "open" } })).toBe(1);
  });

  it("detalle de disputa exige admin_profile y permiso, además del role administrativo", async () => {
    const request = await makeRequest("completed");
    const dispute = await prisma.dispute.create({ data: { id: ulid(), request_id: request.id, opened_by: users.customer, reason: "Detalle privado de regresión" } });
    for (const name of ["fake-admin", "support"]) {
      expect((await send(`/api/v1/disputes/${dispute.id}`, name, undefined, "GET")).status).toBe(403);
    }
    expect((await send(`/api/v1/disputes/${dispute.id}`, "admin", undefined, "GET")).status).toBe(200);
  });

  it("resoluciones concurrentes escriben una sola auditoría y dos notificaciones", async () => {
    const request = await makeRequest("completed");
    const dispute = await prisma.dispute.create({ data: { id: ulid(), request_id: request.id, opened_by: users.customer, reason: "Resolver regresión concurrente" } });
    const responses = await Promise.all(["resolved_customer", "resolved_provider"].map((status) => send(`/api/v1/disputes/${dispute.id}/resolve`, "admin", { status, resolution: "Resolución atómica de regresión" })));
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await prisma.admin_audit_log.count({ where: { entity_id: dispute.id, action: "DISPUTE_RESOLVED" } })).toBe(1);
    expect(await prisma.notification.count({ where: { kind: "dispute_resolved", user_id: { in: [users.customer, users.provider] } } })).toBe(2);
  });

  it("fallar una notificación revierte la apertura de disputa", async () => {
    const request = await makeRequest("completed");
    const transaction = prisma.$transaction.bind(prisma);
    vi.spyOn(prisma, "$transaction").mockImplementationOnce(((callback: (tx: Tx) => Promise<unknown>) => transaction(async (tx) => callback(new Proxy(tx, {
      get(target, property) {
        if (property === "notification") return { createMany: async () => { throw new Error("INJECTED_NOTIFICATION_FAILURE"); } };
        return target[property as keyof Tx];
      },
    })))) as typeof prisma.$transaction);
    const response = await send("/api/v1/disputes", "customer", { request_id: request.id, reason: "Prueba de rollback transaccional" });
    expect(response.status).toBe(500);
    expect(await prisma.dispute.count({ where: { request_id: request.id } })).toBe(0);
    expect(await prisma.notification.count({ where: { user_id: { in: Object.values(users) } } })).toBe(0);
  });
});
