import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../index.js";
import { prisma } from "../database/prisma.js";
import { ulid } from "../lib/ids.js";
import { HAS_DB } from "./setup";

describe.runIf(HAS_DB)("A03 · ranking global en PostgreSQL", () => {
  const userIds: string[] = [];
  const providerIds: string[] = [];
  const requestIds: string[] = [];
  const category = ulid(); const tiesCategory = ulid(); const otherCategory = ulid();
  const zone = ulid(); const otherZone = ulid(); const customerId = ulid();
  let newest: string; let middle: string; let oldestBest: string;
  let tieIds: string[]; let unratedIds: string[];

  async function provider(rating: number | null, count: number, createdAt: string, options: {
    category?: string; zone?: string; available?: boolean; hidden?: "blocked" | "email" | "pending";
  } = {}) {
    const id = ulid(); const userId = ulid();
    userIds.push(userId); providerIds.push(id);
    await prisma.user.create({ data: {
      id: userId, name: "Ranking fixture", email: `ranking-${userId.toLowerCase()}@test.altoque.do`,
      emailVerified: options.hidden !== "email", status: options.hidden === "blocked" ? "blocked" : "active",
    } });
    await prisma.provider_profile.create({ data: {
      id, user_id: userId, referral_code: `RANK-${id}`, created_at: new Date(createdAt),
      verification_status: options.hidden === "pending" ? "pending_verification" : "verified",
      is_available: options.available ?? true,
      provider_service: { create: { category_id: options.category ?? category, price_from: 0 } },
      provider_zone: { create: { zone_id: options.zone ?? zone } },
    } });
    for (let index = 0; index < count; index++) {
      const requestId = ulid(); requestIds.push(requestId);
      await prisma.service_request.create({ data: {
        id: requestId, code: `RANK-${requestId}`, customer_id: customerId,
        category_id: options.category ?? category, zone_id: options.zone ?? zone,
        provider_id: id, description: "Ranking fixture", when_type: "now", status: "reviewed",
        review: { create: { id: ulid(), reviewer_id: customerId, provider_id: id, rating: rating! } },
      } });
    }
    return id;
  }

  beforeAll(async () => {
    userIds.push(customerId);
    await prisma.user.create({ data: { id: customerId, name: "Ranking reviewer", email: `ranking-${customerId.toLowerCase()}@test.altoque.do`, emailVerified: true } });
    await prisma.category.createMany({ data: [category, tiesCategory, otherCategory].map((id) => ({ id, name: "Ranking category", icon: "wrench", group_name: "Test" })) });
    await prisma.zone.createMany({ data: [zone, otherZone].map((id) => ({ id, name: "Ranking zone" })) });
    newest = await provider(1, 1, "2025-03-03T00:00:00Z");
    middle = await provider(3, 2, "2025-03-02T00:00:00Z", { available: false });
    oldestBest = await provider(5, 3, "2025-01-01T00:00:00Z");
    for (const hidden of ["blocked", "email", "pending"] as const) await provider(5, 4, "2025-04-01T00:00:00Z", { hidden });
    await provider(4, 1, "2025-05-01T00:00:00Z", { category: otherCategory, zone: otherZone });
    tieIds = [await provider(3, 1, "2025-06-01T00:00:00Z", { category: tiesCategory }), await provider(3, 1, "2025-06-01T00:00:00Z", { category: tiesCategory })].sort();
    unratedIds = [await provider(null, 0, "2025-05-01T00:00:00Z", { category: tiesCategory }), await provider(null, 0, "2025-05-01T00:00:00Z", { category: tiesCategory })].sort();
  });

  afterAll(async () => {
    await prisma.service_request.deleteMany({ where: { id: { in: requestIds } } });
    await prisma.provider_profile.deleteMany({ where: { id: { in: providerIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.category.deleteMany({ where: { id: { in: [category, tiesCategory, otherCategory] } } });
    await prisma.zone.deleteMany({ where: { id: { in: [zone, otherZone] } } });
  });

  const list = async (query: string) => {
    const response = await app.request(`/api/v1/providers?${query}`);
    expect(response.status).toBe(200);
    return response.json();
  };

  it("el mejor rating antiguo reemplaza al primero por fecha antes de paginar", async () => {
    const previousOrder = await list(`category=${category}&zone=${zone}&limit=1`);
    expect(previousOrder.data.map((p: { id: string }) => p.id)).toEqual([newest]);
    for (const [index, id] of [oldestBest, middle, newest].entries()) {
      const result = await list(`category=${category}&zone=${zone}&sort=rating&limit=1&page=${index + 1}`);
      expect(result.data.map((p: { id: string }) => p.id)).toEqual([id]);
      expect(result.meta).toMatchObject({ total: 3, pages: 3, page: index + 1 });
    }
  });

  it("la mayor cantidad de reviews fuera de la antigua primera página lidera globalmente", async () => {
    const result = await list(`category=${category}&sort=reviews&limit=1`);
    expect(result.data[0]).toMatchObject({ id: oldestBest, rating: 5, reviews_count: 3 });
    const next = await list(`category=${category}&sort=reviews&limit=1&page=2`);
    expect(next.data[0]).toMatchObject({ id: middle, reviews_count: 2 });
  });

  it("available también aplica el ranking antes de su límite", async () => {
    const response = await app.request("/api/v1/providers/available?limit=1");
    expect(response.status).toBe(200);
    expect((await response.json()).data[0]).toMatchObject({ id: oldestBest, rating: 5 });
  });

  it("conserva filtros, elegibilidad, privacidad y parametrización", async () => {
    const unavailable = await list(`category=${category}&zone=${zone}&available=false&sort=rating`);
    expect(unavailable.data.map((p: { id: string }) => p.id)).toEqual([middle]);
    const result = await list(`category=${category}&available=true&sort=rating`);
    expect(result.meta.total).toBe(2);
    for (const p of result.data) {
      for (const field of ["email", "phone", "user", "user_id", "referral_code", "verification_status"]) expect(p[field]).toBeUndefined();
    }
    expect((await list(`category=${category}&zone=${otherZone}`)).data).toEqual([]);
    expect((await list(`category=${encodeURIComponent("' OR true --")}`)).data).toEqual([]);
  });

  it("empates tienen orden estable y perfiles sin reseñas conservan cero", async () => {
    const ids: string[] = [];
    for (let page = 1; page <= 4; page++) {
      const result = await list(`category=${tiesCategory}&sort=rating&limit=1&page=${page}`);
      ids.push(result.data[0].id);
      if (page > 2) expect(result.data[0]).toMatchObject({ rating: 0, reviews_count: 0 });
    }
    expect(ids).toEqual([...tieIds, ...unratedIds]);
    expect(new Set(ids).size).toBe(4);
  });

  it("una página fuera de rango queda vacía sin perder la metadata global", async () => {
    const result = await list(`category=${category}&sort=rating&limit=1&page=4`);
    expect(result.data).toEqual([]);
    expect(result.meta).toMatchObject({ page: 4, total: 3, pages: 3 });
  });
});
