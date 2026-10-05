/** Altas simultáneas y retry ante una colisión real del unique de referido. */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../index.js";
import { prisma } from "../database/prisma.js";
import { ulid } from "../lib/ids.js";
import * as ids from "../lib/ids.js";
import { HAS_DB } from "./setup";
import { createTestCookie, testHeaders } from "./session-helpers.js";

describe.runIf(HAS_DB)("Provider onboarding · integración aislada", () => {
  const categoryId = ulid();
  const zoneId = ulid();
  const userIds: string[] = [];
  const cookies: string[] = [];
  let categoryCreated = false;
  let zoneCreated = false;
  const occupiedCode = `AT-${"0".repeat(24)}`;
  const retryCode = `AT-${"1".repeat(24)}`;

  beforeAll(async () => {
    await prisma.category.create({
      data: { id: categoryId, name: "Onboarding test", icon: "wrench", group_name: "Test" },
    });
    categoryCreated = true;
    await prisma.zone.create({ data: { id: zoneId, name: "Onboarding test" } });
    zoneCreated = true;
    for (let index = 0; index < 4; index++) {
      const user = await prisma.user.create({
        data: {
          name: `Onboarding ${index}`,
          email: `onboarding-${ulid()}@test.altoque.do`.toLowerCase(),
          emailVerified: true,
          role: "customer",
          status: "active",
        },
      });
      userIds.push(user.id);
      cookies.push(await createTestCookie(user.id));
    }
    await prisma.provider_profile.create({
      data: { id: ulid(), user_id: userIds[2], referral_code: occupiedCode },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  afterAll(async () => {
    vi.useRealTimers();
    try {
      await prisma.$transaction(async (tx) => {
        if (userIds.length > 0) {
          await tx.provider_profile.deleteMany({ where: { user_id: { in: userIds } } });
          await tx.user.deleteMany({ where: { id: { in: userIds } } });
        }
        if (categoryCreated) await tx.category.deleteMany({ where: { id: categoryId } });
        if (zoneCreated) await tx.zone.deleteMany({ where: { id: zoneId } });
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("dos usuarios pueden crear sus perfiles con el mismo Date.now sin colisión", async () => {
    const fixedNow = Date.now();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(fixedNow);
      const responses = await Promise.all(cookies.slice(0, 2).map((cookie) => app.request("/api/v1/provider/me", {
        method: "POST",
        headers: { ...testHeaders(cookie), "Content-Type": "application/json" },
        body: JSON.stringify({ category_ids: [categoryId], zone_ids: [zoneId] }),
      })));
      expect(responses.map((response) => response.status)).toEqual([201, 201]);
      const profiles = await prisma.provider_profile.findMany({
        where: { user_id: { in: userIds.slice(0, 2) } },
        include: { provider_service: true, provider_zone: true },
      });
      expect(profiles).toHaveLength(2);
      expect(new Set(profiles.map((profile) => profile.referral_code)).size).toBe(2);
      for (const profile of profiles) {
        expect(profile.verification_status).toBe("pending_verification");
        expect(profile.provider_service.map((service) => service.category_id)).toEqual([categoryId]);
        expect(profile.provider_zone.map((zone) => zone.zone_id)).toEqual([zoneId]);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("una colisión real del unique crea el perfil completo en el segundo intento", async () => {
    const generator = vi.spyOn(ids, "referralCode")
      .mockReturnValueOnce(occupiedCode)
      .mockReturnValueOnce(retryCode);
    const response = await app.request("/api/v1/provider/me", {
      method: "POST",
      headers: { ...testHeaders(cookies[3]), "Content-Type": "application/json" },
      body: JSON.stringify({ category_ids: [categoryId], zone_ids: [zoneId] }),
    });

    expect(response.status).toBe(201);
    expect(generator).toHaveBeenCalledTimes(2);
    const profiles = await prisma.provider_profile.findMany({
      where: { user_id: { in: userIds.slice(2) } },
      include: { provider_service: true, provider_zone: true },
    });
    expect(profiles).toHaveLength(2);
    expect(profiles.find((profile) => profile.user_id === userIds[2])?.referral_code).toBe(occupiedCode);
    const created = profiles.find((profile) => profile.user_id === userIds[3]);
    expect(created?.referral_code).toBe(retryCode);
    expect(created?.provider_service.map((service) => service.category_id)).toEqual([categoryId]);
    expect(created?.provider_zone.map((zone) => zone.zone_id)).toEqual([zoneId]);
  });
});
