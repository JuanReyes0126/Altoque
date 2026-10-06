import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../index.js";
import { prisma } from "../database/prisma.js";
import { ulid } from "../lib/ids.js";
import { HAS_DB } from "./setup";

describe.runIf(HAS_DB)("A04 · resumen público de reseñas acotado", () => {
  const customer = ulid(); const owner = ulid(); const emptyOwner = ulid();
  const provider = ulid(); const emptyProvider = ulid();
  const category = ulid(); const zone = ulid();
  const requests = Array.from({ length: 503 }, () => ulid());
  const ratings = requests.map((_, index) => index % 5 + 1);

  beforeAll(async () => {
    await prisma.user.createMany({ data: [customer, owner, emptyOwner].map((id) => ({
      id, name: "Aggregate fixture", email: `aggregate-${id.toLowerCase()}@test.altoque.do`, emailVerified: true,
    })) });
    await prisma.category.create({ data: { id: category, name: "Aggregate category", icon: "wrench", group_name: "Test" } });
    await prisma.zone.create({ data: { id: zone, name: "Aggregate zone" } });
    await prisma.provider_profile.createMany({ data: [
      { id: provider, user_id: owner, referral_code: `AGG-${provider}`, verification_status: "verified" },
      { id: emptyProvider, user_id: emptyOwner, referral_code: `AGG-${emptyProvider}`, verification_status: "verified" },
    ] });
    await prisma.service_request.createMany({ data: requests.map((id) => ({
      id, code: `AGG-${id}`, customer_id: customer, provider_id: provider,
      category_id: category, zone_id: zone, description: "Aggregate fixture", when_type: "now", status: "reviewed",
    })) });
    await prisma.review.createMany({ data: requests.map((request_id, index) => ({
      id: ulid(), request_id, reviewer_id: customer, provider_id: provider, rating: ratings[index],
      created_at: new Date(Date.UTC(2025, 0, 1, 0, 0, index)), comment: `Fixture ${index}`,
    })) });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.service_request.deleteMany({ where: { id: { in: requests } } });
    await prisma.provider_profile.deleteMany({ where: { id: { in: [provider, emptyProvider] } } });
    await prisma.user.deleteMany({ where: { id: { in: [customer, owner, emptyOwner] } } });
    await prisma.category.deleteMany({ where: { id: category } });
    await prisma.zone.deleteMany({ where: { id: zone } });
  });

  it("503 reseñas conservan el promedio/conteo global y sólo exponen las diez recientes", async () => {
    // Regresión de transferencia: el handler no debe pedir una lista sin límite de ratings.
    const list = vi.spyOn(prisma.review, "findMany");
    const aggregate = vi.spyOn(prisma.review, "aggregate");
    try {
      const response = await app.request(`/api/v1/providers/${provider}`);
      expect(response.status).toBe(200);
      const { data } = await response.json();
      const average = Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length * 10) / 10;
      expect(data).toMatchObject({ id: provider, rating: average, reviews_count: 503 });
      expect(data.recent_reviews).toHaveLength(10);
      expect(data.recent_reviews[0].comment).toBe("Fixture 502");
      expect(data.recent_reviews[9].comment).toBe("Fixture 493");
      expect(list).not.toHaveBeenCalled();
      expect(aggregate).toHaveBeenCalledOnce();
      for (const field of ["user_id", "email", "phone", "referral_code", "verification_status"]) expect(data[field]).toBeUndefined();
    } finally { list.mockRestore(); aggregate.mockRestore(); }
  });

  it("sin reseñas conserva rating=0, conteo=0 y lista reciente vacía", async () => {
    const response = await app.request(`/api/v1/providers/${emptyProvider}`);
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ rating: 0, reviews_count: 0, recent_reviews: [] });
  });

  it("un fallo de agregado conserva el error real 500 sin exponer detalles", async () => {
    const aggregate = vi.spyOn(prisma.review, "aggregate").mockRejectedValueOnce(new Error("PRIVATE_AGGREGATE_FIXTURE"));
    try {
      const response = await app.request(`/api/v1/providers/${provider}`);
      expect(response.status).toBe(500);
      const body = await response.text();
      expect(body).toContain("INTERNAL_ERROR");
      expect(body).not.toContain("PRIVATE_AGGREGATE_FIXTURE");
    } finally { aggregate.mockRestore(); }
  });
});
