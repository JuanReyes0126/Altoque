/**
 * ALTOQUE · Tests de providers-public (F2)
 * 
 * Tests para endpoints públicos de proveedores:
 * - GET /api/v1/providers (listado)
 * - GET /api/v1/providers/available (disponibles)
 * - GET /api/v1/providers/:id (detalle)
 * 
 * TEST WRITTEN / NOT EXECUTED (requiere DB real)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../index.js";
import { prisma } from "../database/prisma.js";
import { ulid } from "../lib/ids.js";

describe("Providers Public API", () => {
  let verifiedProviderId: string;
  let verifiedUserId: string;
  let pendingProviderId: string;
  let pendingUserId: string;
  let categoryId: string;
  let zoneId: string;

  beforeAll(async () => {
    // Crear categoría y zona de prueba
    const category = await prisma.category.create({
      data: {
        id: ulid(),
        name: "Test Category",
        icon: "wrench",
        group_name: "Test",
        is_active: true,
        sort: 99,
      },
    });
    categoryId = category.id;

    const zone = await prisma.zone.create({
      data: {
        id: ulid(),
        name: "Test Zone",
      },
    });
    zoneId = zone.id;

    // Crear usuario y proveedor verificado
    const verifiedUser = await prisma.user.create({
      data: {
        id: ulid(),
        name: "Verified Provider",
        email: `verified-${Date.now()}@test.com`,
        role: "customer",
        status: "active",
        emailVerified: true,
      },
    });
    verifiedUserId = verifiedUser.id;

    const verifiedProvider = await prisma.provider_profile.create({
      data: {
        id: ulid(),
        user_id: verifiedUserId,
        verification_status: "verified",
        is_available: true,
        referral_code: `VER-${Date.now()}`,
        provider_service: {
          create: {
            category_id: categoryId,
            price_from: 1000,
          },
        },
        provider_zone: {
          create: {
            zone_id: zoneId,
          },
        },
      },
    });
    verifiedProviderId = verifiedProvider.id;

    // Crear usuario y proveedor pendiente (no verificado)
    const pendingUser = await prisma.user.create({
      data: {
        id: ulid(),
        name: "Pending Provider",
        email: `pending-${Date.now()}@test.com`,
        role: "customer",
        status: "active",
        emailVerified: true,
      },
    });
    pendingUserId = pendingUser.id;

    const pendingProvider = await prisma.provider_profile.create({
      data: {
        id: ulid(),
        user_id: pendingUserId,
        verification_status: "pending_verification",
        is_available: true,
        referral_code: `PEN-${Date.now()}`,
      },
    });
    pendingProviderId = pendingProvider.id;
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    await prisma.provider_zone.deleteMany({
      where: { provider_id: { in: [verifiedProviderId, pendingProviderId] } },
    });
    await prisma.provider_service.deleteMany({
      where: { provider_id: { in: [verifiedProviderId, pendingProviderId] } },
    });
    await prisma.provider_profile.deleteMany({
      where: { id: { in: [verifiedProviderId, pendingProviderId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [verifiedUserId, pendingUserId] } },
    });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.zone.deleteMany({ where: { id: zoneId } });
  });

  describe("GET /api/v1/providers", () => {
    it("solo devuelve proveedores verificados", async () => {
      const res = await app.request("/api/v1/providers");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);

      // Verificar que todos los proveedores devueltos están verificados
      for (const provider of data.data) {
        expect(provider.verification_status).toBe("verified");
      }

      // Verificar que el proveedor pendiente NO está en la lista
      const pendingInList = data.data.find((p: any) => p.id === pendingProviderId);
      expect(pendingInList).toBeUndefined();
    });

    it("filtra por categoría", async () => {
      const res = await app.request(`/api/v1/providers?category=${categoryId}`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.data.length).toBeGreaterThan(0);

      // Verificar que todos tienen la categoría solicitada
      for (const provider of data.data) {
        const hasCategory = provider.categories.some((c: any) => c.id === categoryId);
        expect(hasCategory).toBe(true);
      }
    });

    it("filtra por disponibilidad", async () => {
      const res = await app.request("/api/v1/providers?available=true");
      expect(res.status).toBe(200);

      const data = await res.json();
      for (const provider of data.data) {
        expect(provider.is_available).toBe(true);
      }
    });

    it("no expone datos privados", async () => {
      const res = await app.request("/api/v1/providers");
      const data = await res.json();

      for (const provider of data.data) {
        expect(provider.email).toBeUndefined();
        expect(provider.phone).toBeUndefined();
        expect(provider.user?.email).toBeUndefined();
      }
    });
  });

  describe("GET /api/v1/providers/available", () => {
    it("devuelve solo proveedores disponibles y verificados", async () => {
      const res = await app.request("/api/v1/providers/available");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);

      // Verificar que todos están disponibles y verificados
      for (const provider of data.data) {
        expect(provider.is_available).toBe(true);
        expect(provider.verification_status).toBe("verified");
      }
    });

    it("respeta el límite de resultados", async () => {
      const res = await app.request("/api/v1/providers/available?limit=5");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.data.length).toBeLessThanOrEqual(5);
    });

    it("no captura 'available' como :id", async () => {
      // Este test verifica que /available no sea tratado como /:id
      const res = await app.request("/api/v1/providers/available");
      expect(res.status).toBe(200);

      const data = await res.json();
      // Si fuera capturado como :id, devolvería 404 o un objeto individual
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  describe("GET /api/v1/providers/:id", () => {
    it("devuelve proveedor verificado con datos completos", async () => {
      const res = await app.request(`/api/v1/providers/${verifiedProviderId}`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.data).toBeDefined();
      expect(data.data.id).toBe(verifiedProviderId);
      expect(data.data.verification_status).toBe("verified");
      expect(data.data.categories).toBeDefined();
      expect(data.data.zones).toBeDefined();
    });

    it("devuelve 404 para proveedor no verificado", async () => {
      const res = await app.request(`/api/v1/providers/${pendingProviderId}`);
      expect(res.status).toBe(404);
    });

    it("devuelve 404 para ID inexistente", async () => {
      const res = await app.request("/api/v1/providers/nonexistent-id");
      expect(res.status).toBe(404);
    });

    it("no expone datos privados en detalle", async () => {
      const res = await app.request(`/api/v1/providers/${verifiedProviderId}`);
      const data = await res.json();

      expect(data.data.email).toBeUndefined();
      expect(data.data.phone).toBeUndefined();
      expect(data.data.user?.email).toBeUndefined();
    });
  });
});
