/** Tests de ownership, reviews y transiciones con fixtures independientes. */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../index.js";
import { prisma } from "../database/prisma.js";
import { ulid } from "../lib/ids.js";
import { HAS_DB } from "./setup";
import { createTestCookie, testHeaders } from "./session-helpers.js";

describe.runIf(HAS_DB)("Request Ownership & Reviews", () => {
  const userIds: string[] = [];
  const providerIds: string[] = [];
  const requestIds: string[] = [];
  const categoryIds: string[] = [];
  const zoneIds: string[] = [];
  let customer1Cookie: string;
  let customer1Id: string;
  let request2Id: string;
  let categoryId: string;
  let zoneId: string;
  let providerProfileId: string;

  async function createUser(name: string) {
    const user = await prisma.user.create({
      data: {
        id: ulid(), name, email: `ownership-${ulid()}@test.com`,
        role: "customer", status: "active", emailVerified: true,
      },
    });
    userIds.push(user.id);
    return user;
  }

  async function createRequest(customerId: string, status: "confirmed" | "searching" | "on_the_way") {
    const request = await prisma.service_request.create({
      data: {
        id: ulid(), code: `ALT-OWN-${ulid()}`, customer_id: customerId,
        category_id: categoryId, zone_id: zoneId, description: "Ownership test request",
        when_type: "now", status,
        provider_id: status === "searching" ? null : providerProfileId,
      },
    });
    requestIds.push(request.id);
    return request;
  }

  beforeAll(async () => {
    const category = await prisma.category.create({
      data: { id: ulid(), name: "Ownership category", icon: "wrench", group_name: "Test" },
    });
    categoryIds.push(category.id);
    categoryId = category.id;
    const zone = await prisma.zone.create({ data: { id: ulid(), name: "Ownership zone" } });
    zoneIds.push(zone.id);
    zoneId = zone.id;
    const customer1 = await createUser("Ownership Customer 1");
    customer1Id = customer1.id;
    const customer2 = await createUser("Ownership Customer 2");
    const providerUser = await createUser("Ownership Provider");
    const provider = await prisma.provider_profile.create({
      data: {
        id: ulid(), user_id: providerUser.id, verification_status: "verified",
        referral_code: `OWN-${ulid()}`,
      },
    });
    providerIds.push(provider.id);
    providerProfileId = provider.id;
    request2Id = (await createRequest(customer2.id, "confirmed")).id;
    customer1Cookie = await createTestCookie(customer1.id);
  });

  afterAll(async () => {
    await prisma.review.deleteMany({ where: { request_id: { in: requestIds } } });
    await prisma.request_status_history.deleteMany({ where: { request_id: { in: requestIds } } });
    await prisma.service_request.deleteMany({ where: { id: { in: requestIds } } });
    await prisma.notification.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.admin_audit_log.deleteMany({ where: { actor_id: { in: userIds } } });
    await prisma.provider_profile.deleteMany({ where: { id: { in: providerIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
    await prisma.zone.deleteMany({ where: { id: { in: zoneIds } } });
  });

  it("customer no puede GET request ajeno", async () => {
    const res = await app.request(`/api/v1/requests/${request2Id}`, { headers: testHeaders(customer1Cookie) });
    expect(res.status).toBe(403);
  });

  it("customer no puede cancelar request ajeno", async () => {
    const res = await app.request(`/api/v1/requests/${request2Id}/cancel`, {
      method: "POST", headers: testHeaders(customer1Cookie),
    });
    expect(res.status).toBe(403);
  });

  it("customer no puede confirmar request ajeno", async () => {
    const res = await app.request(`/api/v1/requests/${request2Id}/confirm`, {
      method: "POST", headers: testHeaders(customer1Cookie),
    });
    expect(res.status).toBe(403);
  });

  it("customer no puede review request ajeno", async () => {
    const res = await app.request(`/api/v1/requests/${request2Id}/review`, {
      method: "POST",
      headers: { ...testHeaders(customer1Cookie), "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 5, comment: "Intentando revisar request ajeno" }),
    });
    expect(res.status).toBe(403);
    expect(await prisma.review.count({ where: { request_id: request2Id } })).toBe(0);
  });

  it("primera review se crea y duplicate review falla", async () => {
    const request = await createRequest(customer1Id, "confirmed");
    const first = await app.request(`/api/v1/requests/${request.id}/review`, {
      method: "POST",
      headers: { ...testHeaders(customer1Cookie), "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 5, comment: "Primera review" }),
    });
    expect(first.status).toBe(201);
    const duplicate = await app.request(`/api/v1/requests/${request.id}/review`, {
      method: "POST",
      headers: { ...testHeaders(customer1Cookie), "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 4, comment: "Segunda review" }),
    });
    expect(duplicate.status).toBe(409);
    const reviews = await prisma.review.findMany({ where: { request_id: request.id } });
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ rating: 5, reviewer_id: customer1Id, provider_id: providerProfileId });
    expect((await prisma.service_request.findUnique({ where: { id: request.id } }))?.status).toBe("reviewed");
  });

  it.each([0, 6])("rating %i fuera de 1-5 falla", async (rating) => {
    const request = await createRequest(customer1Id, "confirmed");
    const res = await app.request(`/api/v1/requests/${request.id}/review`, {
      method: "POST",
      headers: { ...testHeaders(customer1Cookie), "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment: "Rating inválido" }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    expect(await prisma.review.count({ where: { request_id: request.id } })).toBe(0);
  });

  it("cancelar desde on_the_way es una transición inválida", async () => {
    const request = await createRequest(customer1Id, "on_the_way");
    const res = await app.request(`/api/v1/requests/${request.id}/cancel`, {
      method: "POST", headers: testHeaders(customer1Cookie),
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("INVALID_STATE_TRANSITION");
    expect((await prisma.service_request.findUnique({ where: { id: request.id } }))?.status).toBe("on_the_way");
    expect(await prisma.request_status_history.count({ where: { request_id: request.id } })).toBe(0);
  });

  it("cancelar desde searching está permitido y deja historial", async () => {
    const request = await createRequest(customer1Id, "searching");
    const res = await app.request(`/api/v1/requests/${request.id}/cancel`, {
      method: "POST", headers: testHeaders(customer1Cookie),
    });
    expect(res.status).toBe(200);
    expect((await prisma.service_request.findUnique({ where: { id: request.id } }))?.status).toBe("cancelled");
    expect(await prisma.request_status_history.count({
      where: { request_id: request.id, from_status: "searching", to_status: "cancelled", actor_id: customer1Id },
    })).toBe(1);
  });
});
