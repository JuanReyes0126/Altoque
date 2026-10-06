/** Tests de proveedores públicos con fixtures propias y comprobación de privacidad. */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../index.js";
import { prisma } from "../database/prisma.js";
import { ulid } from "../lib/ids.js";
import { HAS_DB } from "./setup";

describe.runIf(HAS_DB)("Providers Public API", () => {
  const userIds: string[] = [];
  const providerIds: string[] = [];
  const categoryIds: string[] = [];
  const zoneIds: string[] = [];
  let verifiedProviderId: string;
  let unavailableProviderId: string;
  let pendingProviderId: string;
  let categoryId: string;
  let zoneId: string;

  async function createProvider(name: string, verified: boolean, available: boolean) {
    const user = await prisma.user.create({
      data: {
        id: ulid(), name, email: `public-provider-${ulid()}@test.com`,
        phone: "8095550100", role: "customer", status: "active", emailVerified: true,
      },
    });
    userIds.push(user.id);
    const provider = await prisma.provider_profile.create({
      data: {
        id: ulid(), user_id: user.id,
        verification_status: verified ? "verified" : "pending_verification",
        is_available: available, referral_code: `PUBLIC-${ulid()}`,
        provider_service: { create: { category_id: categoryId, price_from: 1000 } },
        provider_zone: { create: { zone_id: zoneId } },
      },
    });
    providerIds.push(provider.id);
    return provider;
  }

  beforeAll(async () => {
    const category = await prisma.category.create({
      data: {
        id: ulid(), name: "Public provider category", icon: "wrench",
        group_name: "Test", is_active: true, sort: 99,
      },
    });
    categoryIds.push(category.id);
    categoryId = category.id;
    const zone = await prisma.zone.create({ data: { id: ulid(), name: "Public provider zone" } });
    zoneIds.push(zone.id);
    zoneId = zone.id;
    verifiedProviderId = (await createProvider("Verified Provider", true, true)).id;
    unavailableProviderId = (await createProvider("Unavailable Provider", true, false)).id;
    pendingProviderId = (await createProvider("Pending Provider", false, true)).id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.admin_audit_log.deleteMany({ where: { actor_id: { in: userIds } } });
    await prisma.provider_zone.deleteMany({ where: { provider_id: { in: providerIds } } });
    await prisma.provider_service.deleteMany({ where: { provider_id: { in: providerIds } } });
    await prisma.provider_profile.deleteMany({ where: { id: { in: providerIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
    await prisma.zone.deleteMany({ where: { id: { in: zoneIds } } });
  });

  describe("GET /api/v1/providers", () => {
    it("solo devuelve proveedores verificados", async () => {
      const res = await app.request(`/api/v1/providers?category=${categoryId}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.data)).toBe(true);
      const ids = data.data.map((provider: { id: string }) => provider.id);
      expect(ids).toContain(verifiedProviderId);
      expect(ids).toContain(unavailableProviderId);
      expect(ids).not.toContain(pendingProviderId);
      // verification_status es privado y no forma parte del DTO público.
      const profiles = await prisma.provider_profile.findMany({ where: { id: { in: ids } } });
      expect(profiles).toHaveLength(ids.length);
      expect(profiles.every((provider) => provider.verification_status === "verified")).toBe(true);
    });

    it("filtra por categoría", async () => {
      const res = await app.request(`/api/v1/providers?category=${categoryId}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.length).toBeGreaterThan(0);
      for (const provider of data.data) {
        expect(provider.categories.some((category: { id: string }) => category.id === categoryId)).toBe(true);
      }
    });

    it("filtra por disponibilidad", async () => {
      const res = await app.request(`/api/v1/providers?category=${categoryId}&available=true`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.map((provider: { id: string }) => provider.id)).toEqual([verifiedProviderId]);
      expect(data.data[0].is_available).toBe(true);
    });

    it("no expone datos privados", async () => {
      const res = await app.request(`/api/v1/providers?category=${categoryId}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.length).toBeGreaterThan(0);
      for (const provider of data.data) {
        expect(provider.email).toBeUndefined();
        expect(provider.phone).toBeUndefined();
        expect(provider.user?.email).toBeUndefined();
      }
    });
  });

  describe("GET /api/v1/providers/available", () => {
    it.each(["-1", "NaN", "Infinity", "2.5"])("un límite %s se normaliza sin errores Prisma", async (limit) => {
      const response = await app.request(`/api/v1/providers/available?limit=${limit}`);
      expect(response.status).toBe(200);
      expect(Array.isArray((await response.json()).data)).toBe(true);
    });
    it("devuelve solo proveedores disponibles y verificados", async () => {
      const res = await app.request("/api/v1/providers/available?limit=50");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.data)).toBe(true);
      const ids = data.data.map((provider: { id: string }) => provider.id);
      expect(ids).toContain(verifiedProviderId);
      expect(ids).not.toContain(unavailableProviderId);
      expect(ids).not.toContain(pendingProviderId);
      // El DTO compacto omite is_available y verification_status.
      const profiles = await prisma.provider_profile.findMany({ where: { id: { in: ids } } });
      expect(profiles).toHaveLength(ids.length);
      expect(profiles.every((provider) => provider.is_available && provider.verification_status === "verified")).toBe(true);
    });

    it("respeta el límite de resultados", async () => {
      const res = await app.request("/api/v1/providers/available?limit=1");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data).toHaveLength(1);
    });

    it("no captura 'available' como :id", async () => {
      const res = await app.request("/api/v1/providers/available");
      expect(res.status).toBe(200);
      expect(Array.isArray((await res.json()).data)).toBe(true);
    });
  });

  describe("GET /api/v1/providers/:id", () => {
    it("un perfil verificado con una cuenta bloqueada no aparece públicamente", async () => {
      const provider = await createProvider("Blocked account provider", true, true);
      await prisma.user.update({ where: { id: provider.user_id }, data: { status: "blocked" } });
      expect((await app.request(`/api/v1/providers/${provider.id}`)).status).toBe(404);
      const available = await app.request("/api/v1/providers/available?limit=50");
      expect((await available.json()).data.map((item: { id: string }) => item.id)).not.toContain(provider.id);
    });
    it("devuelve proveedor verificado con datos públicos completos", async () => {
      const res = await app.request(`/api/v1/providers/${verifiedProviderId}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.id).toBe(verifiedProviderId);
      expect(data.data.categories).toEqual([expect.objectContaining({ id: categoryId })]);
      expect(data.data.zones).toEqual([expect.objectContaining({ id: zoneId })]);
    });

    it("devuelve 404 para proveedor no verificado", async () => {
      const res = await app.request(`/api/v1/providers/${pendingProviderId}`);
      expect(res.status).toBe(404);
    });

    it("devuelve 404 para ID inexistente", async () => {
      const res = await app.request(`/api/v1/providers/${ulid()}`);
      expect(res.status).toBe(404);
    });

    it("no expone datos privados en detalle", async () => {
      const res = await app.request(`/api/v1/providers/${verifiedProviderId}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.email).toBeUndefined();
      expect(data.data.phone).toBeUndefined();
      expect(data.data.user?.email).toBeUndefined();
    });
  });
});
