/**
 * ALTOQUE · Tests de Admin RBAC (F6)
 * 
 * Tests para:
 * - Non-admin no puede listar usuarios
 * - Non-admin no puede aprobar proveedor
 * - Non-admin no puede listar audit
 * - Admin sí tiene acceso
 * - RBAC se deriva de sesión/DB, no de IDs enviados por frontend
 * 
 * TEST WRITTEN / NOT EXECUTED (requiere DB real)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../index.js";
import { prisma } from "../database/prisma.js";
import { ulid } from "../lib/ids.js";

describe("Admin RBAC", () => {
  let customerToken: string;
  let adminToken: string;
  let customerId: string;
  let adminId: string;
  let providerId: string;

  beforeAll(async () => {
    // Crear customer
    const customer = await prisma.user.create({
      data: {
        id: ulid(),
        name: "Test Customer",
        email: `customer-rbac-${Date.now()}@test.com`,
        role: "customer",
        status: "active",
        emailVerified: true,
      },
    });
    customerId = customer.id;

    // Crear admin
    const admin = await prisma.user.create({
      data: {
        id: ulid(),
        name: "Test Admin",
        email: `admin-rbac-${Date.now()}@test.com`,
        role: "admin",
        status: "active",
        emailVerified: true,
      },
    });
    adminId = admin.id;

    await prisma.admin_profile.create({
      data: {
        user_id: adminId,
        admin_role: "admin",
      },
    });

    // Crear proveedor pendiente
    const providerUser = await prisma.user.create({
      data: {
        id: ulid(),
        name: "Pending Provider",
        email: `provider-rbac-${Date.now()}@test.com`,
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
        verification_status: "pending_verification",
        is_available: false,
        referral_code: `RBAC-${Date.now()}`,
      },
    });

    customerToken = await createTestSession(customerId);
    adminToken = await createTestSession(adminId);
  });

  afterAll(async () => {
    await prisma.provider_profile.deleteMany({ where: { user_id: providerId } });
    await prisma.admin_profile.deleteMany({ where: { user_id: adminId } });
    await prisma.user.deleteMany({
      where: { id: { in: [customerId, adminId, providerId] } },
    });
  });

  it("non-admin no puede listar usuarios", async () => {
    const res = await app.request("/api/v1/admin/users", {
      method: "GET",
      headers: { Cookie: `session=${customerToken}` },
    });

    expect(res.status).toBe(403);
  });

  it("admin sí puede listar usuarios", async () => {
    const res = await app.request("/api/v1/admin/users", {
      method: "GET",
      headers: { Cookie: `session=${adminToken}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
  });

  it("non-admin no puede aprobar proveedor", async () => {
    const res = await app.request(`/api/v1/admin/providers/${providerId}/approve`, {
      method: "POST",
      headers: { Cookie: `session=${customerToken}` },
    });

    expect(res.status).toBe(403);
  });

  it("admin sí puede aprobar proveedor", async () => {
    const res = await app.request(`/api/v1/admin/providers/${providerId}/approve`, {
      method: "POST",
      headers: { Cookie: `session=${adminToken}` },
    });

    expect(res.status).toBe(200);

    // Verificar que el proveedor fue aprobado
    const provider = await prisma.provider_profile.findUnique({
      where: { user_id: providerId },
    });
    expect(provider?.verification_status).toBe("verified");
  });

  it("non-admin no puede listar audit logs", async () => {
    const res = await app.request("/api/v1/admin/audit", {
      method: "GET",
      headers: { Cookie: `session=${customerToken}` },
    });

    expect(res.status).toBe(403);
  });

  it("admin sí puede listar audit logs", async () => {
    const res = await app.request("/api/v1/admin/audit", {
      method: "GET",
      headers: { Cookie: `session=${adminToken}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
  });

  it("RBAC se deriva de sesión/DB, no de IDs enviados por frontend", async () => {
    // Intentar enviar admin_role en el body (debe ser ignorado)
    const res = await app.request("/api/v1/admin/users", {
      method: "GET",
      headers: {
        Cookie: `session=${customerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        admin_role: "super_admin", // Intento de escalada
      }),
    });

    // Debe fallar porque el rol real en DB es "customer"
    expect(res.status).toBe(403);
  });

  it("admin no puede escalar a super_admin sin permiso", async () => {
    // Intentar cambiar su propio rol
    const res = await app.request(`/api/v1/admin/users/${adminId}`, {
      method: "PATCH",
      headers: {
        Cookie: `session=${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        admin_role: "super_admin",
      }),
    });

    // Debe fallar porque solo super_admin puede cambiar roles admin
    expect(res.status).toBe(403);
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
