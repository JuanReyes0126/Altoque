/**
 * ALTOQUE · Tests de active-job (F3)
 * 
 * Tests para endpoint GET /api/v1/provider/active-job
 * 
 * TEST WRITTEN / NOT EXECUTED (requiere DB real)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../index.js";
import { prisma } from "../database/prisma.js";
import { ulid } from "../lib/ids.js";

describe("Provider Active Job API", () => {
  let providerToken: string;
  let customerToken: string;
  let providerId: string;
  let customerId: string;
  let activeJobId: string;

  beforeAll(async () => {
    // Crear proveedor
    const providerUser = await prisma.user.create({
      data: {
        id: ulid(),
        name: "Test Provider",
        email: `provider-active-${Date.now()}@test.com`,
        role: "customer",
        status: "active",
        emailVerified: true,
      },
    });
    providerId = providerUser.id;

    await prisma.provider_profile.create({
      data: {
        id: ulid(),
        user_id: providerId,
        verification_status: "verified",
        is_available: true,
        referral_code: `ACTIVE-${Date.now()}`,
      },
    });

    // Crear cliente
    const customer = await prisma.user.create({
      data: {
        id: ulid(),
        name: "Test Customer",
        email: `customer-active-${Date.now()}@test.com`,
        role: "customer",
        status: "active",
        emailVerified: true,
      },
    });
    customerId = customer.id;

    // Crear trabajo activo
    const category = await prisma.category.findFirst();
    const zone = await prisma.zone.findFirst();

    activeJobId = ulid();
    await prisma.service_request.create({
      data: {
        id: activeJobId,
        code: `ALT-ACTIVE-${Date.now()}`,
        customer_id: customerId,
        category_id: category!.id,
        zone_id: zone!.id,
        description: "Active job test",
        when_type: "now",
        status: "on_the_way",
        provider_id: providerId,
        eta_min: 15,
      },
    });

    providerToken = await createTestSession(providerId);
    customerToken = await createTestSession(customerId);
  });

  afterAll(async () => {
    await prisma.service_request.deleteMany({ where: { id: activeJobId } });
    await prisma.provider_profile.deleteMany({ where: { user_id: providerId } });
    await prisma.user.deleteMany({ where: { id: { in: [providerId, customerId] } } });
  });

  it("provider sin active job recibe null", async () => {
    const otherProvider = await prisma.user.create({
      data: {
        id: ulid(),
        name: "Other Provider",
        email: `other-${Date.now()}@test.com`,
        role: "customer",
        status: "active",
        emailVerified: true,
      },
    });

    await prisma.provider_profile.create({
      data: {
        id: ulid(),
        user_id: otherProvider.id,
        verification_status: "verified",
        is_available: true,
        referral_code: `OTHER-${Date.now()}`,
      },
    });

    const otherToken = await createTestSession(otherProvider.id);

    const res = await app.request("/api/v1/provider/active-job", {
      method: "GET",
      headers: { Cookie: `session=${otherToken}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.job).toBeNull();

    await prisma.provider_profile.deleteMany({ where: { user_id: otherProvider.id } });
    await prisma.user.delete({ where: { id: otherProvider.id } });
  });

  it("provider con active job recibe el trabajo correcto", async () => {
    const res = await app.request("/api/v1/provider/active-job", {
      method: "GET",
      headers: { Cookie: `session=${providerToken}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.job).toBeDefined();
    expect(data.data.job.id).toBe(activeJobId);
    expect(data.data.job.status).toBe("on_the_way");
  });

  it("customer no puede usar endpoint provider", async () => {
    const res = await app.request("/api/v1/provider/active-job", {
      method: "GET",
      headers: { Cookie: `session=${customerToken}` },
    });

    expect(res.status).toBe(403);
  });

  it("active job pertenece al provider correcto", async () => {
    const res = await app.request("/api/v1/provider/active-job", {
      method: "GET",
      headers: { Cookie: `session=${providerToken}` },
    });

    const data = await res.json();
    expect(data.data.job.provider_id).toBe(providerId);
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
