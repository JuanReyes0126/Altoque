/**
 * ALTOQUE · Tests de disputas (F5)
 * 
 * Tests para endpoints de disputas:
 * - Creación por cliente/proveedor
 * - Ownership y permisos
 * - Estados válidos
 * - Resolución admin
 * - Duplicados
 * 
 * TEST WRITTEN / NOT EXECUTED (requiere DB real)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../index.js";
import { prisma } from "../database/prisma.js";
import { ulid } from "../lib/ids.js";

describe("Disputes API", () => {
  let customerToken: string;
  let providerToken: string;
  let adminToken: string;
  let customerId: string;
  let providerId: string;
  let adminId: string;
  let requestId: string;
  let completedRequestId: string;

  beforeAll(async () => {
    // Crear usuarios de prueba
    const customer = await prisma.user.create({
      data: {
        id: ulid(),
        name: "Test Customer",
        email: `customer-${Date.now()}@test.com`,
        role: "customer",
        status: "active",
        emailVerified: true,
      },
    });
    customerId = customer.id;

    const providerUser = await prisma.user.create({
      data: {
        id: ulid(),
        name: "Test Provider",
        email: `provider-${Date.now()}@test.com`,
        role: "customer",
        status: "active",
        emailVerified: true,
      },
    });
    providerId = providerUser.id;

    const admin = await prisma.user.create({
      data: {
        id: ulid(),
        name: "Test Admin",
        email: `admin-${Date.now()}@test.com`,
        role: "admin",
        status: "active",
        emailVerified: true,
      },
    });
    adminId = admin.id;

    // Crear perfil de proveedor
    await prisma.provider_profile.create({
      data: {
        id: ulid(),
        user_id: providerId,
        verification_status: "verified",
        is_available: true,
        referral_code: `TEST-${Date.now()}`,
      },
    });

    // Crear perfil admin
    await prisma.admin_profile.create({
      data: {
        user_id: adminId,
        admin_role: "admin",
      },
    });

    // Crear solicitud de prueba (searching)
    const category = await prisma.category.findFirst();
    const zone = await prisma.zone.findFirst();

    if (!category || !zone) {
      throw new Error("No hay categorías o zonas en la base de datos");
    }

    requestId = await createTestRequest(customerId, category.id, zone.id, "searching");
    completedRequestId = await createTestRequest(customerId, category.id, zone.id, "completed", providerId);

    // Generar tokens de sesión (mock para tests)
    customerToken = await createTestSession(customerId);
    providerToken = await createTestSession(providerId);
    adminToken = await createTestSession(adminId);
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    await prisma.dispute.deleteMany({
      where: {
        OR: [
          { opened_by: customerId },
          { opened_by: providerId },
          { resolved_by: adminId },
        ],
      },
    });
    await prisma.service_request.deleteMany({
      where: { id: { in: [requestId, completedRequestId] } },
    });
    await prisma.admin_profile.deleteMany({ where: { user_id: adminId } });
    await prisma.provider_profile.deleteMany({ where: { user_id: providerId } });
    await prisma.user.deleteMany({
      where: { id: { in: [customerId, providerId, adminId] } },
    });
  });

  // A. Customer puede crear disputa sobre request propio elegible
  it("A. customer puede crear disputa sobre request completado propio", async () => {
    const res = await app.request("/api/v1/disputes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${customerToken}`,
      },
      body: JSON.stringify({
        request_id: completedRequestId,
        reason: "El servicio no fue completado correctamente",
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.data).toBeDefined();
    expect(data.data.request_id).toBe(completedRequestId);
    expect(data.data.status).toBe("open");
  });

  // B. Customer NO puede crear disputa sobre request ajeno
  it("B. customer NO puede crear disputa sobre request ajeno", async () => {
    const otherCustomer = await prisma.user.create({
      data: {
        id: ulid(),
        name: "Other Customer",
        email: `other-${Date.now()}@test.com`,
        role: "customer",
        status: "active",
        emailVerified: true,
      },
    });

    const category = await prisma.category.findFirst();
    const zone = await prisma.zone.findFirst();
    const otherRequestId = await createTestRequest(otherCustomer.id, category!.id, zone!.id, "completed");

    const res = await app.request("/api/v1/disputes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${customerToken}`,
      },
      body: JSON.stringify({
        request_id: otherRequestId,
        reason: "Intentando disputar request ajeno",
      }),
    });

    expect(res.status).toBe(403);

    // Cleanup
    await prisma.service_request.delete({ where: { id: otherRequestId } });
    await prisma.user.delete({ where: { id: otherCustomer.id } });
  });

  // C. Provider asignado puede crear disputa
  it("C. provider asignado puede crear disputa sobre request completado", async () => {
    const res = await app.request("/api/v1/disputes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${providerToken}`,
      },
      body: JSON.stringify({
        request_id: completedRequestId,
        reason: "El cliente no pagó el servicio completado",
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.data.opened_by).toBe(providerId);
  });

  // D. Provider ajeno NO puede crear disputa
  it("D. provider ajeno NO puede crear disputa", async () => {
    const otherProvider = await prisma.user.create({
      data: {
        id: ulid(),
        name: "Other Provider",
        email: `other-provider-${Date.now()}@test.com`,
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

    const otherProviderToken = await createTestSession(otherProvider.id);

    const res = await app.request("/api/v1/disputes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${otherProviderToken}`,
      },
      body: JSON.stringify({
        request_id: completedRequestId,
        reason: "Provider ajeno intentando disputar",
      }),
    });

    expect(res.status).toBe(403);

    // Cleanup
    await prisma.provider_profile.deleteMany({ where: { user_id: otherProvider.id } });
    await prisma.user.delete({ where: { id: otherProvider.id } });
  });

  // E. Usuario no relacionado NO puede leer disputa
  it("E. usuario no relacionado NO puede leer disputa", async () => {
    const dispute = await prisma.dispute.findFirst({
      where: { request_id: completedRequestId },
    });

    if (!dispute) {
      throw new Error("No se creó la disputa en tests anteriores");
    }

    const unrelatedUser = await prisma.user.create({
      data: {
        id: ulid(),
        name: "Unrelated User",
        email: `unrelated-${Date.now()}@test.com`,
        role: "customer",
        status: "active",
        emailVerified: true,
      },
    });

    const unrelatedToken = await createTestSession(unrelatedUser.id);

    const res = await app.request(`/api/v1/disputes/${dispute.id}`, {
      method: "GET",
      headers: {
        Cookie: `session=${unrelatedToken}`,
      },
    });

    expect(res.status).toBe(403);

    // Cleanup
    await prisma.user.delete({ where: { id: unrelatedUser.id } });
  });

  // F. Duplicate open dispute falla
  it("F. duplicate open dispute falla", async () => {
    const res = await app.request("/api/v1/disputes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${customerToken}`,
      },
      body: JSON.stringify({
        request_id: completedRequestId,
        reason: "Intentando crear segunda disputa",
      }),
    });

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error.code).toBe("CONFLICT");
  });

  // G. Request en estado no elegible falla
  it("G. request en estado searching NO es elegible para disputa", async () => {
    const res = await app.request("/api/v1/disputes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${customerToken}`,
      },
      body: JSON.stringify({
        request_id: requestId, // searching
        reason: "Intentando disputar request en searching",
      }),
    });

    expect(res.status).toBe(409);
  });

  // H. Admin puede listar disputas
  it("H. admin puede listar todas las disputas", async () => {
    const res = await app.request("/api/v1/disputes/admin/all", {
      method: "GET",
      headers: {
        Cookie: `session=${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
  });

  // I. Non-admin NO puede usar admin/all
  it("I. non-admin NO puede listar todas las disputas", async () => {
    const res = await app.request("/api/v1/disputes/admin/all", {
      method: "GET",
      headers: {
        Cookie: `session=${customerToken}`,
      },
    });

    expect(res.status).toBe(403);
  });

  // J. Admin puede resolver disputa
  it("J. admin puede resolver disputa", async () => {
    const dispute = await prisma.dispute.findFirst({
      where: { request_id: completedRequestId, status: "open" },
    });

    if (!dispute) {
      throw new Error("No hay disputa abierta para resolver");
    }

    const res = await app.request(`/api/v1/disputes/${dispute.id}/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${adminToken}`,
      },
      body: JSON.stringify({
        status: "resolved_customer",
        resolution: "Se determinó que el servicio no fue completado según lo acordado",
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.status).toBe("resolved_customer");
    expect(data.data.resolved_by).toBe(adminId);
  });

  // K. Non-admin NO puede resolver
  it("K. non-admin NO puede resolver disputa", async () => {
    // Crear nueva disputa para test
    const newRequestId = await createTestRequest(
      customerId,
      (await prisma.category.findFirst())!.id,
      (await prisma.zone.findFirst())!.id,
      "completed",
      providerId
    );

    const newDispute = await prisma.dispute.create({
      data: {
        id: ulid(),
        request_id: newRequestId,
        opened_by: customerId,
        reason: "Disputa para test de resolución no-admin",
        status: "open",
      },
    });

    const res = await app.request(`/api/v1/disputes/${newDispute.id}/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${customerToken}`,
      },
      body: JSON.stringify({
        status: "resolved_customer",
        resolution: "Intentando resolver sin permisos",
      }),
    });

    expect(res.status).toBe(403);

    // Cleanup
    await prisma.dispute.delete({ where: { id: newDispute.id } });
    await prisma.service_request.delete({ where: { id: newRequestId } });
  });

  // L. Disputa ya resuelta no puede resolverse otra vez
  it("L. disputa ya resuelta NO puede resolverse otra vez", async () => {
    const resolvedDispute = await prisma.dispute.findFirst({
      where: { status: { in: ["resolved_customer", "resolved_provider"] } },
    });

    if (!resolvedDispute) {
      throw new Error("No hay disputa resuelta para test");
    }

    const res = await app.request(`/api/v1/disputes/${resolvedDispute.id}/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${adminToken}`,
      },
      body: JSON.stringify({
        status: "resolved_provider",
        resolution: "Intentando resolver disputa ya resuelta",
      }),
    });

    expect(res.status).toBe(409);
  });

  // M. Request sin provider no rompe resolución
  it("M. request sin provider no rompe resolución admin", async () => {
    const category = await prisma.category.findFirst();
    const zone = await prisma.zone.findFirst();

    // Crear request completado sin provider
    const requestWithoutProvider = await createTestRequest(
      customerId,
      category!.id,
      zone!.id,
      "completed",
      null // Sin provider
    );

    // Crear disputa
    const dispute = await prisma.dispute.create({
      data: {
        id: ulid(),
        request_id: requestWithoutProvider,
        opened_by: customerId,
        reason: "Disputa sobre request sin provider",
        status: "open",
      },
    });

    const res = await app.request(`/api/v1/disputes/${dispute.id}/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${adminToken}`,
      },
      body: JSON.stringify({
        status: "resolved_customer",
        resolution: "Resolución de disputa sin provider",
      }),
    });

    expect(res.status).toBe(200);

    // Cleanup
    await prisma.dispute.delete({ where: { id: dispute.id } });
    await prisma.service_request.delete({ where: { id: requestWithoutProvider } });
  });

  // N. Reason demasiado corto falla
  it("N. reason demasiado corto falla validación", async () => {
    const category = await prisma.category.findFirst();
    const zone = await prisma.zone.findFirst();

    const newRequestId = await createTestRequest(
      customerId,
      category!.id,
      zone!.id,
      "completed"
    );

    const res = await app.request("/api/v1/disputes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${customerToken}`,
      },
      body: JSON.stringify({
        request_id: newRequestId,
        reason: "Corto", // Menos de 10 caracteres
      }),
    });

    expect(res.status).toBe(400);

    // Cleanup
    await prisma.service_request.delete({ where: { id: newRequestId } });
  });
});

// Helper functions
async function createTestRequest(
  customerId: string,
  categoryId: string,
  zoneId: string,
  status: string,
  providerId?: string | null
): Promise<string> {
  const requestId = ulid();
  await prisma.service_request.create({
    data: {
      id: requestId,
      code: `ALT-TEST-${Date.now()}`,
      customer_id: customerId,
      category_id: categoryId,
      zone_id: zoneId,
      description: "Test request",
      when_type: "now",
      status: status as any,
      provider_id: providerId || null,
    },
  });
  return requestId;
}

async function createTestSession(userId: string): Promise<string> {
  // Mock session token para tests
  // En producción, Better Auth maneja esto
  const token = `test-session-${userId}-${Date.now()}`;
  await prisma.session.create({
    data: {
      id: ulid(),
      token,
      userId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
    },
  });
  return token;
}
