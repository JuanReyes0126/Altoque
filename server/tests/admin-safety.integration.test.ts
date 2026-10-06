/** Protección administrativa, idempotencia y rollback en DB local aislada. */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../index.js";
import { auth } from "../auth/auth.js";
import { prisma } from "../database/prisma.js";
import { ulid } from "../lib/ids.js";
import * as auditModule from "../lib/audit.js";
import { HAS_DB } from "./setup";
import { createTestCookie, testHeaders } from "./session-helpers.js";

describe.runIf(HAS_DB)("Admin · protección y atomicidad", () => {
  const userIds: string[] = [];
  const providerIds: string[] = [];
  let adminId: string;
  let superId: string;
  let adminCookie: string;
  let superCookie: string;
  let staleCookie: string;
  let protectedIds: string[];

  async function createUser(role: "customer" | "admin" = "customer", adminRole?: "support" | "admin" | "super_admin") {
    const user = await prisma.user.create({
      data: {
        id: ulid(), name: "Admin safety fixture", email: `admin-safety-${ulid()}@test.altoque.do`, role, emailVerified: true,
        ...(adminRole ? { admin_profile: { create: { admin_role: adminRole } } } : {}),
      },
    });
    userIds.push(user.id);
    return user;
  }

  async function createProvider(role: "customer" | "admin" = "customer") {
    const user = await createUser(role, role === "admin" ? "support" : undefined);
    const provider = await prisma.provider_profile.create({
      data: { id: ulid(), user_id: user.id, referral_code: `TEST-${ulid()}`, verification_status: "pending_verification", is_available: true },
    });
    providerIds.push(provider.id);
    return { user, provider };
  }

  function post(path: string, cookie = adminCookie, body: unknown = {}) {
    return app.request(`/api/v1/admin/${path}`, {
      method: "POST", headers: { ...testHeaders(cookie), "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
  }

  beforeAll(async () => {
    const admin = await createUser("admin", "admin");
    const superAdmin = await createUser("admin", "super_admin");
    const missingProfile = await createUser("admin");
    const inconsistent = await createUser("customer", "support");
    adminId = admin.id;
    superId = superAdmin.id;
    protectedIds = [admin.id, superAdmin.id, missingProfile.id, inconsistent.id];
    adminCookie = await createTestCookie(admin.id);
    superCookie = await createTestCookie(superAdmin.id);
    staleCookie = await createTestCookie(admin.id);
    const staleSession = await auth.api.getSession({ headers: new Headers(testHeaders(staleCookie)) });
    if (!staleSession) throw new Error("ADMIN_TEST_SESSION_MISSING");
    const { sessionConfig } = await auth.$context;
    await prisma.session.update({
      where: { id: staleSession.session.id },
      data: { createdAt: new Date(Date.now() - (sessionConfig.freshAge + 60) * 1000) },
    });
  });

  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await prisma.provider_verification_history.deleteMany({ where: { provider_id: { in: providerIds } } });
    await prisma.admin_audit_log.deleteMany({ where: { OR: [{ actor_id: { in: userIds } }, { entity_id: { in: [...userIds, ...providerIds] } }] } });
    await prisma.provider_profile.deleteMany({ where: { id: { in: providerIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it.each(["suspend", "block"])("%s no altera administradores, al propio actor ni al único super_admin", async (action) => {
    for (const targetId of protectedIds) {
      expect((await post(`users/${targetId}/${action}`)).status).toBe(403);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: targetId } })).status).toBe("active");
    }
    expect((await post(`users/${superId}/${action}`, superCookie)).status).toBe(403);
    expect((await post(`users/${adminId}/${action}`, superCookie)).status).toBe(403);
    expect(await prisma.user.count({ where: { role: "admin", status: "active", admin_profile: { is: { admin_role: "super_admin" } } } })).toBe(1);
    expect(await prisma.admin_audit_log.count({ where: { action: action === "block" ? "USER_BLOCKED" : "USER_SUSPENDED", entity_id: { in: protectedIds } } })).toBe(0);
  });

  it("block requiere sesión fresca; una sesión antigua aún permite lecturas", async () => {
    const customer = await createUser();
    expect((await app.request("/api/v1/admin/users", { headers: testHeaders(staleCookie) })).status).toBe(200);
    expect((await post(`users/${customer.id}/block`, staleCookie)).status).toBe(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: customer.id } })).status).toBe("active");
    expect((await post(`users/${customer.id}/block`)).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: customer.id } })).status).toBe("blocked");
    expect(await prisma.admin_audit_log.count({ where: { actor_id: adminId, entity_id: customer.id, action: "USER_BLOCKED" } })).toBe(1);
  });

  it.each(["suspend", "block"])("fallo de audit revierte %s de un usuario", async (action) => {
    const customer = await createUser();
    vi.spyOn(auditModule, "audit").mockRejectedValueOnce(new Error("TEST_AUDIT_FAILURE"));
    expect((await post(`users/${customer.id}/${action}`)).status).toBe(500);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: customer.id } })).status).toBe("active");
    expect(await prisma.admin_audit_log.count({ where: { entity_id: customer.id } })).toBe(0);
  });

  it("aprobar perfil dual conserva user.role admin y su admin_profile", async () => {
    const { user, provider } = await createProvider("admin");
    expect((await post(`providers/${provider.id}/approve`)).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe("admin");
    expect((await prisma.admin_profile.findUniqueOrThrow({ where: { user_id: user.id } })).admin_role).toBe("support");
    expect((await prisma.provider_profile.findUniqueOrThrow({ where: { id: provider.id } })).verification_status).toBe("verified");
  });

  it.each(["approve", "reject"])("fallo de audit revierte %s, rol, disponibilidad e historial", async (action) => {
    const { user, provider } = await createProvider();
    vi.spyOn(auditModule, "audit").mockRejectedValueOnce(new Error("TEST_AUDIT_FAILURE"));
    expect((await post(`providers/${provider.id}/${action}`, adminCookie, { reason: "Fixture rejection" })).status).toBe(500);
    const preserved = await prisma.provider_profile.findUniqueOrThrow({ where: { id: provider.id } });
    expect(preserved.verification_status).toBe("pending_verification");
    expect(preserved.is_available).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe("customer");
    expect(await prisma.provider_verification_history.count({ where: { provider_id: provider.id } })).toBe(0);
    expect(await prisma.admin_audit_log.count({ where: { entity_id: provider.id } })).toBe(0);
  });

  it.each(["approve", "reject"])("%s repetido y concurrente produce un único audit e historial", async (action) => {
    const { provider } = await createProvider();
    const responses = await Promise.all([post(`providers/${provider.id}/${action}`, adminCookie, { reason: "Fixture rejection" }), post(`providers/${provider.id}/${action}`, adminCookie, { reason: "Fixture rejection" })]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect((await post(`providers/${provider.id}/${action}`, adminCookie, { reason: "Fixture rejection" })).status).toBe(200);
    expect(await prisma.admin_audit_log.count({ where: { entity_id: provider.id } })).toBe(1);
    expect(await prisma.provider_verification_history.count({ where: { provider_id: provider.id } })).toBe(1);
    const history = await prisma.provider_verification_history.findFirstOrThrow({ where: { provider_id: provider.id } });
    expect(history.from_status).toBe("pending_verification");
    expect(history.to_status).toBe(action === "approve" ? "verified" : "rejected");
  });

  it("aprobar y rechazar en paralelo permite una sola decisión y mantiene auditoría consistente", async () => {
    const { provider } = await createProvider();
    const responses = await Promise.all([post(`providers/${provider.id}/approve`), post(`providers/${provider.id}/reject`, adminCookie, { reason: "Fixture rejection" })]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const persisted = await prisma.provider_profile.findUniqueOrThrow({ where: { id: provider.id } });
    const histories = await prisma.provider_verification_history.findMany({ where: { provider_id: provider.id } });
    expect(histories).toHaveLength(1);
    expect(histories[0].to_status).toBe(persisted.verification_status);
    expect(await prisma.admin_audit_log.count({ where: { entity_id: provider.id } })).toBe(1);
  });

  it.each(["users?role=invalid", "users?status=invalid", "providers?status=invalid", "requests?status=invalid"])("filtro inválido %s devuelve 400", async (path) => {
    expect((await app.request(`/api/v1/admin/${path}`, { headers: testHeaders(adminCookie) })).status).toBe(400);
  });
});
