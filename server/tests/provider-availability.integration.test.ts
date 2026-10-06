import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../index.js";
import { prisma } from "../database/prisma.js";
import { ulid } from "../lib/ids.js";
import { HAS_DB } from "./setup";
import { createTestCookie, testHeaders } from "./session-helpers.js";

describe.runIf(HAS_DB)("Profesional · inbox vacío y disponibilidad persistente", () => {
  const categoryId = ulid();
  const zoneId = ulid();
  const userIds: string[] = [];
  const providerIds: string[] = [];
  const cookies: Record<string, string> = {};
  let categoryCreated = false;
  let zoneCreated = false;

  beforeAll(async () => {
    await prisma.category.create({ data: { id: categoryId, name: "Availability regression", icon: "wrench", group_name: "Test" } });
    categoryCreated = true;
    await prisma.zone.create({ data: { id: zoneId, name: "Availability regression" } });
    zoneCreated = true;
    for (const name of ["verified", "pending", "email-unverified", "missing"]) {
      const user = await prisma.user.create({ data: {
        id: ulid(), name, email: `availability-${ulid()}@test.altoque.do`.toLowerCase(),
        role: "customer", status: "active", emailVerified: name !== "email-unverified",
      } });
      userIds.push(user.id);
      cookies[name] = await createTestCookie(user.id);
      if (name === "missing") continue;
      const provider = await prisma.provider_profile.create({ data: {
        id: ulid(), user_id: user.id, verification_status: name === "pending" ? "pending_verification" : "verified",
        is_available: false, referral_code: `AVAIL-${ulid()}`,
        provider_service: { create: { category_id: categoryId, price_from: 0 } },
        provider_zone: { create: { zone_id: zoneId } },
      } });
      providerIds.push(provider.id);
    }
  });

  afterAll(async () => {
    try {
      await prisma.$transaction(async (tx) => {
        if (providerIds.length) await tx.provider_profile.deleteMany({ where: { id: { in: providerIds } } });
        if (userIds.length) await tx.user.deleteMany({ where: { id: { in: userIds } } });
        if (categoryCreated) await tx.category.deleteMany({ where: { id: categoryId } });
        if (zoneCreated) await tx.zone.deleteMany({ where: { id: zoneId } });
      });
    } finally { await prisma.$disconnect(); }
  });

  const availability = (cookie: string, value: boolean) => app.request("/api/v1/provider/availability", {
    method: "PATCH", headers: { ...testHeaders(cookie), "Content-Type": "application/json" }, body: JSON.stringify({ is_available: value }),
  });

  it("GET inbox sin solicitudes devuelve éxito vacío y no un error", async () => {
    const response = await app.request("/api/v1/provider/inbox", { headers: testHeaders(cookies.verified) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 1 } });
  });

  it("puede ponerse online sin solicitudes y GET me restaura el estado tras refrescar", async () => {
    const response = await availability(cookies.verified, true);
    expect(response.status).toBe(200);
    expect((await response.json()).data.is_available).toBe(true);
    const profileResponse = await app.request("/api/v1/provider/me", { headers: testHeaders(cookies.verified) });
    expect(profileResponse.status).toBe(200);
    const profile = (await profileResponse.json()).data;
    expect(profile.is_available).toBe(true);
    expect(profile.available_since).not.toBeNull();
    const inbox = await app.request("/api/v1/provider/inbox", { headers: testHeaders(cookies.verified) });
    expect(inbox.status).toBe(200);
    expect((await inbox.json()).data).toEqual([]);
  });

  it("puede volver offline y el estado también queda persistido", async () => {
    expect((await availability(cookies.verified, false)).status).toBe(200);
    const response = await app.request("/api/v1/provider/me", { headers: testHeaders(cookies.verified) });
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ is_available: false, available_since: null });
  });

  it("conserva la aprobación profesional y no convierte una restricción en éxito vacío", async () => {
    expect((await availability(cookies.pending, true)).status).toBe(403);
    const response = await app.request("/api/v1/provider/inbox", { headers: testHeaders(cookies.pending) });
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
    const profile = await app.request("/api/v1/provider/me", { headers: testHeaders(cookies.pending) });
    expect((await profile.json()).data.is_available).toBe(false);
  });

  it("conserva la verificación de email para operaciones protegidas", async () => {
    expect((await availability(cookies["email-unverified"], true)).status).toBe(403);
    expect((await app.request("/api/v1/provider/inbox", { headers: testHeaders(cookies["email-unverified"]) })).status).toBe(403);
  });

  it("distingue perfil inexistente de inbox vacío", async () => {
    const response = await app.request("/api/v1/provider/me", { headers: testHeaders(cookies.missing) });
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
  });

  it("la cuenta actual puede completar un perfil persistido sin omitir la aprobación", async () => {
    const response = await app.request("/api/v1/provider/me", {
      method: "POST", headers: { ...testHeaders(cookies.missing), "Content-Type": "application/json" },
      body: JSON.stringify({ business_name: "Nuevo profesional", category_ids: [categoryId], zone_ids: [zoneId] }),
    });
    expect(response.status).toBe(201);
    const created = (await response.json()).data;
    providerIds.push(created.id);
    const profileResponse = await app.request("/api/v1/provider/me", { headers: testHeaders(cookies.missing) });
    expect(profileResponse.status).toBe(200);
    const profile = (await profileResponse.json()).data;
    expect(profile).toMatchObject({ id: created.id, business_name: "Nuevo profesional", verification_status: "pending_verification", is_available: false });
    expect(profile.provider_service.map((service: { category_id: string }) => service.category_id)).toEqual([categoryId]);
    expect(profile.provider_zone.map((zone: { zone_id: string }) => zone.zone_id)).toEqual([zoneId]);
    expect((await availability(cookies.missing, true)).status).toBe(403);
  });
});
