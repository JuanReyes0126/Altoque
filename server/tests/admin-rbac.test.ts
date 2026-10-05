/** Tests HTTP de RBAC: permisos efectivos desde sesión y admin_profile. */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../index.js";
import { prisma } from "../database/prisma.js";
import { ulid } from "../lib/ids.js";
import { HAS_DB } from "./setup";
import { createTestCookie, testHeaders } from "./session-helpers.js";

describe.runIf(HAS_DB)("Admin RBAC", () => {
  const userIds: string[] = [];
  const providerIds: string[] = [];
  let customerCookie: string;
  let adminCookie: string;
  let superAdminCookie: string;
  let adminWithoutProfileCookie: string;
  let adminId: string;
  let providerUserId: string;
  let providerProfileId: string;

  async function createUser(name: string, role: "customer" | "admin") {
    const user = await prisma.user.create({
      data: {
        id: ulid(), name, email: `rbac-${ulid()}@test.com`, role,
        status: "active", emailVerified: true,
      },
    });
    userIds.push(user.id);
    return user;
  }

  beforeAll(async () => {
    const customer = await createUser("RBAC Customer", "customer");
    const admin = await createUser("RBAC Admin", "admin");
    adminId = admin.id;
    await prisma.admin_profile.create({ data: { user_id: admin.id, admin_role: "admin" } });
    const superAdmin = await createUser("RBAC Super Admin", "admin");
    await prisma.admin_profile.create({ data: { user_id: superAdmin.id, admin_role: "super_admin" } });
    const adminWithoutProfile = await createUser("Admin Without Profile", "admin");
    const providerUser = await createUser("Pending RBAC Provider", "customer");
    providerUserId = providerUser.id;
    const provider = await prisma.provider_profile.create({
      data: {
        id: ulid(), user_id: providerUser.id, verification_status: "pending_verification",
        is_available: false, referral_code: `RBAC-${ulid()}`,
      },
    });
    providerIds.push(provider.id);
    providerProfileId = provider.id;
    customerCookie = await createTestCookie(customer.id);
    adminCookie = await createTestCookie(admin.id);
    superAdminCookie = await createTestCookie(superAdmin.id);
    adminWithoutProfileCookie = await createTestCookie(adminWithoutProfile.id);
  });

  afterAll(async () => {
    await prisma.admin_audit_log.deleteMany({
      where: { OR: [{ actor_id: { in: userIds } }, { entity_id: { in: providerIds } }] },
    });
    await prisma.notification.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.provider_verification_history.deleteMany({ where: { provider_id: { in: providerIds } } });
    await prisma.provider_profile.deleteMany({ where: { id: { in: providerIds } } });
    await prisma.admin_profile.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it("non-admin no puede listar usuarios", async () => {
    const res = await app.request("/api/v1/admin/users", { headers: testHeaders(customerCookie) });
    expect(res.status).toBe(403);
  });

  it("admin sí puede listar usuarios", async () => {
    const res = await app.request("/api/v1/admin/users", { headers: testHeaders(adminCookie) });
    expect(res.status).toBe(200);
    expect(Array.isArray((await res.json()).data)).toBe(true);
  });

  it("user.role admin sin admin_profile no obtiene permisos", async () => {
    const res = await app.request("/api/v1/admin/users", { headers: testHeaders(adminWithoutProfileCookie) });
    expect(res.status).toBe(403);
  });

  it("non-admin no puede aprobar proveedor", async () => {
    const res = await app.request(`/api/v1/admin/providers/${providerProfileId}/approve`, {
      method: "POST", headers: testHeaders(customerCookie),
    });
    expect(res.status).toBe(403);
  });

  it("admin sí puede aprobar un perfil proveedor", async () => {
    const res = await app.request(`/api/v1/admin/providers/${providerProfileId}/approve`, {
      method: "POST", headers: testHeaders(adminCookie),
    });
    expect(res.status).toBe(200);
    const provider = await prisma.provider_profile.findUnique({ where: { id: providerProfileId } });
    expect(provider?.verification_status).toBe("verified");
    expect((await prisma.user.findUnique({ where: { id: providerUserId } }))?.role).toBe("provider");
    expect(await prisma.provider_verification_history.count({
      where: { provider_id: providerProfileId, actor_id: adminId, to_status: "verified" },
    })).toBe(1);
    expect(await prisma.admin_audit_log.count({
      where: { actor_id: adminId, entity_id: providerProfileId, action: "PROVIDER_APPROVED" },
    })).toBe(1);
  });

  it("non-admin no puede listar audit logs", async () => {
    const res = await app.request("/api/v1/admin/audit", { headers: testHeaders(customerCookie) });
    expect(res.status).toBe(403);
  });

  it("admin no tiene permiso audit.export", async () => {
    const res = await app.request("/api/v1/admin/audit", { headers: testHeaders(adminCookie) });
    expect(res.status).toBe(403);
  });

  it("super_admin sí puede listar audit logs", async () => {
    const res = await app.request("/api/v1/admin/audit", { headers: testHeaders(superAdminCookie) });
    expect(res.status).toBe(200);
    expect(Array.isArray((await res.json()).data)).toBe(true);
  });

  it("admin_role enviado por customer no concede acceso administrativo", async () => {
    const res = await app.request(`/api/v1/admin/providers/${providerProfileId}/approve`, {
      method: "POST",
      headers: { ...testHeaders(customerCookie), "Content-Type": "application/json" },
      body: JSON.stringify({ admin_role: "super_admin", user_id: adminId }),
    });
    expect(res.status).toBe(403);
  });

  it("admin no puede obtener audit.export falsificando su rol en query o headers", async () => {
    const res = await app.request("/api/v1/admin/audit?admin_role=super_admin", {
      headers: { ...testHeaders(adminCookie), "X-Admin-Role": "super_admin" },
    });
    expect(res.status).toBe(403);
    expect((await prisma.admin_profile.findUnique({ where: { user_id: adminId } }))?.admin_role).toBe("admin");
  });
});
