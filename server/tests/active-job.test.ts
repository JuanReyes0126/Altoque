/** Tests HTTP del trabajo activo con fixtures propias y limpieza acotada. */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../index.js";
import { prisma } from "../database/prisma.js";
import { ulid } from "../lib/ids.js";
import { HAS_DB } from "./setup";
import { createTestCookie, testHeaders } from "./session-helpers.js";

describe.runIf(HAS_DB)("Provider Active Job API", () => {
  const userIds: string[] = [];
  const providerIds: string[] = [];
  const requestIds: string[] = [];
  const categoryIds: string[] = [];
  const zoneIds: string[] = [];
  let providerCookie: string;
  let idleProviderCookie: string;
  let customerCookie: string;
  let providerProfileId: string;
  let activeJobId: string;

  async function createUser(name: string) {
    const user = await prisma.user.create({
      data: {
        id: ulid(),
        name,
        email: `active-job-${ulid()}@test.com`,
        role: "customer",
        status: "active",
        emailVerified: true,
      },
    });
    userIds.push(user.id);
    return user;
  }

  async function createProvider(userId: string) {
    const provider = await prisma.provider_profile.create({
      data: {
        id: ulid(),
        user_id: userId,
        verification_status: "verified",
        is_available: true,
        referral_code: `ACTIVE-${ulid()}`,
      },
    });
    providerIds.push(provider.id);
    return provider;
  }

  beforeAll(async () => {
    const category = await prisma.category.create({
      data: { id: ulid(), name: "Active job category", icon: "wrench", group_name: "Test" },
    });
    categoryIds.push(category.id);
    const zone = await prisma.zone.create({ data: { id: ulid(), name: "Active job zone" } });
    zoneIds.push(zone.id);
    const providerUser = await createUser("Active Provider");
    const provider = await createProvider(providerUser.id);
    providerProfileId = provider.id;
    const idleProvider = await createUser("Idle Provider");
    await createProvider(idleProvider.id);
    const customer = await createUser("Active Job Customer");
    const job = await prisma.service_request.create({
      data: {
        id: ulid(),
        code: `ALT-ACTIVE-${ulid()}`,
        customer_id: customer.id,
        category_id: category.id,
        zone_id: zone.id,
        description: "Active job test",
        when_type: "now",
        status: "on_the_way",
        provider_id: provider.id,
        eta_min: 15,
      },
    });
    requestIds.push(job.id);
    activeJobId = job.id;
    providerCookie = await createTestCookie(providerUser.id);
    idleProviderCookie = await createTestCookie(idleProvider.id);
    customerCookie = await createTestCookie(customer.id);
  });

  afterAll(async () => {
    await prisma.service_request.deleteMany({ where: { id: { in: requestIds } } });
    await prisma.notification.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.admin_audit_log.deleteMany({ where: { actor_id: { in: userIds } } });
    await prisma.provider_profile.deleteMany({ where: { id: { in: providerIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
    await prisma.zone.deleteMany({ where: { id: { in: zoneIds } } });
  });

  it("provider sin active job recibe null", async () => {
    const res = await app.request("/api/v1/provider/active-job", {
      headers: testHeaders(idleProviderCookie),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).data.job).toBeNull();
  });

  it("provider con active job recibe el trabajo correcto", async () => {
    const res = await app.request("/api/v1/provider/active-job", {
      headers: testHeaders(providerCookie),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.job.id).toBe(activeJobId);
    expect(data.data.job.status).toBe("on_the_way");
  });

  it("customer sin perfil provider recibe 404", async () => {
    const res = await app.request("/api/v1/provider/active-job", {
      headers: testHeaders(customerCookie),
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
  });

  it("active job pertenece al perfil del provider correcto", async () => {
    const res = await app.request("/api/v1/provider/active-job", {
      headers: testHeaders(providerCookie),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).data.job.provider_id).toBe(providerProfileId);
  });
});
