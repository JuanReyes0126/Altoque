import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../index";
import { prisma } from "../database/prisma";
import { ulid } from "../lib/ids";
import { createTestCookie, testHeaders } from "./session-helpers";
import { HAS_DB } from "./setup";

describe.runIf(HAS_DB)("Disputa por solicitud · paginación y ownership", () => {
  const customerId = ulid(), otherId = ulid(), categoryId = ulid(), zoneId = ulid();
  const requests: string[] = [];
  let cookie: string;
  beforeAll(async () => {
    await prisma.category.create({ data: { id: categoryId, name: "Dispute filter fixture", icon: "wrench", group_name: "Test" } });
    await prisma.zone.create({ data: { id: zoneId, name: "Dispute filter zone" } });
    for (const id of [customerId, otherId]) await prisma.user.create({ data: { id, name: "Dispute fixture", email: `${id}@example.invalid`, emailVerified: true } });
    cookie = await createTestCookie(customerId);
    for (let index = 0; index < 23; index++) {
      const id = ulid(); requests.push(id);
      await prisma.service_request.create({ data: { id, code: `FILTER-${id}`, customer_id: index === 22 ? otherId : customerId, category_id: categoryId, zone_id: zoneId, description: "Dispute filtering fixture", when_type: "now", status: "completed" } });
      await prisma.dispute.create({ data: { id: ulid(), request_id: id, opened_by: index === 22 ? otherId : customerId, reason: "Dispute filter reason", created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, index)) } });
    }
  });
  afterAll(async () => {
    await prisma.dispute.deleteMany({ where: { request_id: { in: requests } } });
    await prisma.service_request.deleteMany({ where: { id: { in: requests } } });
    await prisma.user.deleteMany({ where: { id: { in: [customerId, otherId] } } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.zone.deleteMany({ where: { id: zoneId } });
  });
  it("encuentra una disputa anterior a los primeros veinte resultados", async () => {
    const initial = await app.request('/api/v1/disputes', { headers: testHeaders(cookie) });
    const list = await initial.json() as any;
    expect(list.data).toHaveLength(20);
    expect(list.data.some((row: any) => row.request_id === requests[0])).toBe(false);
    const response = await app.request(`/api/v1/disputes?request_id=${requests[0]}&limit=1`, { headers: testHeaders(cookie) });
    expect(response.status).toBe(200);
    const filtered = await response.json() as any;
    expect(filtered.data).toHaveLength(1);
    expect(filtered.data[0].request_id).toBe(requests[0]);
  });
  it("un filtro nunca concede acceso a la disputa de otro cliente", async () => {
    const response = await app.request(`/api/v1/disputes?request_id=${requests[22]}&limit=1`, { headers: testHeaders(cookie) });
    expect(response.status).toBe(200);
    expect((await response.json() as any).data).toEqual([]);
  });
});
