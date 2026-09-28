/**
 * ALTOQUE · Tests de request ownership y reviews (F2)
 * 
 * Tests para:
 * - Customer no puede acceder a requests ajenos
 * - Customer no puede cancelar/confirmar/review requests ajenos
 * - Duplicate review falla
 * - Rating fuera de rango falla
 * - Transiciones inválidas fallan
 * 
 * TEST WRITTEN / NOT EXECUTED (requiere DB real)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../index.js";
import { prisma } from "../database/prisma.js";
import { ulid } from "../lib/ids.js";

describe("Request Ownership & Reviews", () => {
  let customer1Token: string;
  let customer2Token: string;
  let customer1Id: string;
  let customer2Id: string;
  let request1Id: string;
  let request2Id: string;

  beforeAll(async () => {
    // Crear dos clientes
    const customer1 = await prisma.user.create({
      data: {
        id: ulid(),
        name: "Customer 1",
        email: `customer1-${Date.now()}@test.com`,
        role: "customer",
        status: "active",
        emailVerified: true,
      },
    });
    customer1Id = customer1.id;

    const customer2 = await prisma.user.create({
      data: {
        id: ulid(),
        name: "Customer 2",
        email: `customer2-${Date.now()}@test.com`,
        role: "customer",
        status: "active",
        emailVerified: true,
      },
    });
    customer2Id = customer2.id;

    // Crear requests
    const category = await prisma.category.findFirst();
    const zone = await prisma.zone.findFirst();

    request1Id = ulid();
    await prisma.service_request.create({
      data: {
        id: request1Id,
        code: `ALT-OWN1-${Date.now()}`,
        customer_id: customer1Id,
        category_id: category!.id,
        zone_id: zone!.id,
        description: "Request 1",
        when_type: "now",
        status: "completed",
      },
    });

    request2Id = ulid();
    await prisma.service_request.create({
      data: {
        id: request2Id,
        code: `ALT-OWN2-${Date.now()}`,
        customer_id: customer2Id,
        category_id: category!.id,
        zone_id: zone!.id,
        description: "Request 2",
        when_type: "now",
        status: "completed",
      },
    });

    customer1Token = await createTestSession(customer1Id);
    customer2Token = await createTestSession(customer2Id);
  });

  afterAll(async () => {
    await prisma.review.deleteMany({
      where: { request_id: { in: [request1Id, request2Id] } },
    });
    await prisma.service_request.deleteMany({
      where: { id: { in: [request1Id, request2Id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [customer1Id, customer2Id] } },
    });
  });

  it("customer no puede GET request ajeno", async () => {
    const res = await app.request(`/api/v1/requests/${request2Id}`, {
      method: "GET",
      headers: { Cookie: `session=${customer1Token}` },
    });

    expect(res.status).toBe(403);
  });

  it("customer no puede cancelar request ajeno", async () => {
    const res = await app.request(`/api/v1/requests/${request2Id}/cancel`, {
      method: "POST",
      headers: { Cookie: `session=${customer1Token}` },
    });

    expect(res.status).toBe(403);
  });

  it("customer no puede confirmar request ajeno", async () => {
    const res = await app.request(`/api/v1/requests/${request2Id}/confirm`, {
      method: "POST",
      headers: { Cookie: `session=${customer1Token}` },
    });

    expect(res.status).toBe(403);
  });

  it("customer no puede review request ajeno", async () => {
    const res = await app.request(`/api/v1/requests/${request2Id}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${customer1Token}`,
      },
      body: JSON.stringify({
        rating: 5,
        comment: "Intentando revisar request ajeno",
      }),
    });

    expect(res.status).toBe(403);
  });

  it("duplicate review falla", async () => {
    // Crear primera review
    await app.request(`/api/v1/requests/${request1Id}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${customer1Token}`,
      },
      body: JSON.stringify({
        rating: 5,
        comment: "Primera review",
      }),
    });

    // Intentar crear segunda review
    const res = await app.request(`/api/v1/requests/${request1Id}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${customer1Token}`,
      },
      body: JSON.stringify({
        rating: 4,
        comment: "Segunda review",
      }),
    });

    expect(res.status).toBe(409);
  });

  it("rating fuera de 1-5 falla", async () => {
    const newRequestId = ulid();
    const category = await prisma.category.findFirst();
    const zone = await prisma.zone.findFirst();

    await prisma.service_request.create({
      data: {
        id: newRequestId,
        code: `ALT-RATING-${Date.now()}`,
        customer_id: customer1Id,
        category_id: category!.id,
        zone_id: zone!.id,
        description: "Request for rating test",
        when_type: "now",
        status: "completed",
      },
    });

    const res = await app.request(`/api/v1/requests/${newRequestId}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${customer1Token}`,
      },
      body: JSON.stringify({
        rating: 6, // Fuera de rango
        comment: "Rating inválido",
      }),
    });

    expect(res.status).toBe(400);

    await prisma.service_request.delete({ where: { id: newRequestId } });
  });

  it("transición inválida falla", async () => {
    const newRequestId = ulid();
    const category = await prisma.category.findFirst();
    const zone = await prisma.zone.findFirst();

    await prisma.service_request.create({
      data: {
        id: newRequestId,
        code: `ALT-TRANS-${Date.now()}`,
        customer_id: customer1Id,
        category_id: category!.id,
        zone_id: zone!.id,
        description: "Request for transition test",
        when_type: "now",
        status: "searching", // No se puede cancelar desde searching
      },
    });

    const res = await app.request(`/api/v1/requests/${newRequestId}/cancel`, {
      method: "POST",
      headers: { Cookie: `session=${customer1Token}` },
    });

    expect(res.status).toBe(409);

    await prisma.service_request.delete({ where: { id: newRequestId } });
  });
});

async function createTestSession(userId: string): Promise<string> {
  const token = `test-session-${userId}-${Date.now()}`;
  await prisma.session.create({
    data: {
      id: ulid(),
      token,
      userId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  return token;
}
