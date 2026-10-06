/** CRUD privado y uso seguro de direcciones en la DB exclusiva del runner. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../index.js";
import { prisma } from "../database/prisma.js";
import { ulid } from "../lib/ids.js";
import { HAS_DB } from "./setup";
import { createTestCookie, testHeaders } from "./session-helpers.js";

describe.runIf(HAS_DB)("Direcciones · integración aislada", () => {
  const userIds: string[] = [];
  const zoneIds: string[] = [];
  const categoryId = ulid();
  let categoryCreated = false;
  let sequenceCreated = false;
  let cookie: string;
  let unverifiedCookie: string;
  let otherAddressId: string;
  let ownAddressId: string;

  async function request(path: string, method = "GET", body?: unknown, requestCookie = cookie) {
    return app.request(path, {
      method,
      headers: { ...testHeaders(requestCookie), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }

  beforeAll(async () => {
    for (let index = 0; index < 3; index++) {
      const user = await prisma.user.create({
        data: { id: ulid(), name: `Address ${index}`, email: `address-${ulid()}@test.altoque.do`, emailVerified: index !== 2 },
      });
      userIds.push(user.id);
    }
    cookie = await createTestCookie(userIds[0]);
    unverifiedCookie = await createTestCookie(userIds[2]);
    for (let index = 0; index < 3; index++) {
      const zone = await prisma.zone.create({ data: { id: ulid(), name: `Address zone ${index}`, is_active: index !== 2 } });
      zoneIds.push(zone.id);
    }
    await prisma.category.create({ data: { id: categoryId, name: "Address category", icon: "wrench", group_name: "Test" } });
    categoryCreated = true;
    if (!await prisma.request_code_seq.findUnique({ where: { id: 1 } })) {
      await prisma.request_code_seq.create({ data: { id: 1, last_value: 0 } });
      sequenceCreated = true;
    }
    const other = await prisma.address.create({
      data: { id: ulid(), user_id: userIds[1], label: "Otra cuenta", line: "Dirección privada", zone_id: zoneIds[0] },
    });
    otherAddressId = other.id;
  });

  afterAll(async () => {
    // Filtrar siempre por fixtures registrados, incluido rate_limit sin FK.
    await prisma.request_status_history.deleteMany({ where: { actor_id: { in: userIds } } });
    await prisma.service_request.deleteMany({ where: { customer_id: { in: userIds } } });
    await prisma.rate_limit.deleteMany({ where: { subject: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (categoryCreated) await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.zone.deleteMany({ where: { id: { in: zoneIds } } });
    if (sequenceCreated) await prisma.request_code_seq.deleteMany({ where: { id: 1 } });
  });

  it("sin direcciones propias devuelve 200 vacío y no filtra otras cuentas", async () => {
    const response = await request("/api/v1/me/addresses");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ data: [] });
  });

  it("crear, editar, recargar y eliminar persiste los datos de la cuenta", async () => {
    const created = await request("/api/v1/me/addresses", "POST", { label: " Casa ", line: " Calle 1, casa 20 ", zone_id: zoneIds[0] });
    expect(created.status).toBe(201);
    const { data } = await created.json();
    expect(data).toMatchObject({ label: "Casa", line: "Calle 1, casa 20", zone_id: zoneIds[0] });
    expect(Object.keys(data).sort()).toEqual(["id", "label", "line", "zone", "zone_id"]);
    expect(Object.keys(data.zone).sort()).toEqual(["id", "municipality", "name"]);
    const updated = await request(`/api/v1/me/addresses/${data.id}`, "PATCH", { label: "Trabajo", line: "Edificio 2", zone_id: zoneIds[1] });
    expect(updated.status).toBe(200);
    const reloaded = await request("/api/v1/me/addresses");
    const saved = (await reloaded.json()).data;
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ id: data.id, label: "Trabajo", line: "Edificio 2", zone_id: zoneIds[1] });
    expect((await prisma.address.findUniqueOrThrow({ where: { id: data.id } })).user_id).toBe(userIds[0]);
    expect((await request(`/api/v1/me/addresses/${data.id}`, "DELETE")).status).toBe(200);
    expect((await (await request("/api/v1/me/addresses")).json()).data).toEqual([]);
    expect(await prisma.address.count({ where: { id: data.id } })).toBe(0);
  });

  it.each(["GET", "PATCH", "DELETE"])("%s ajeno devuelve 404 y conserva la dirección", async (method) => {
    const response = await request(`/api/v1/me/addresses/${otherAddressId}`, method, method === "PATCH" ? { label: "Intento" } : undefined);
    expect(response.status).toBe(404);
    const other = await prisma.address.findUniqueOrThrow({ where: { id: otherAddressId } });
    expect(other.user_id).toBe(userIds[1]);
    expect(other.label).toBe("Otra cuenta");
  });

  it("rechaza inyectar propietario o flags ajenos al formulario", async () => {
    const response = await request("/api/v1/me/addresses", "POST", {
      label: "Casa", line: "Calle 1", zone_id: zoneIds[0], user_id: userIds[1], is_default: true,
    });
    expect(response.status).toBe(400);
    expect(await prisma.address.count({ where: { user_id: userIds[0] } })).toBe(0);
  });

  it("rechaza zonas inexistentes o inactivas y etiquetas vacías", async () => {
    for (const zoneId of [ulid(), zoneIds[2]]) {
      expect((await request("/api/v1/me/addresses", "POST", { label: "Casa", line: "Calle 1", zone_id: zoneId })).status).toBe(400);
    }
    expect((await request("/api/v1/me/addresses", "POST", { label: "  ", line: "Calle 1", zone_id: zoneIds[0] })).status).toBe(400);
    expect(await prisma.address.count({ where: { user_id: userIds[0] } })).toBe(0);
  });

  it("requiere sesión y correo verificado", async () => {
    expect((await app.request("/api/v1/me/addresses")).status).toBe(401);
    expect((await request("/api/v1/me/addresses", "GET", undefined, unverifiedCookie)).status).toBe(403);
  });

  it("las zonas públicas vienen de la DB y excluyen las inactivas", async () => {
    const response = await app.request("/api/v1/zones");
    expect(response.status).toBe(200);
    const zones = (await response.json()).data;
    expect(zones.map((zone: { id: string }) => zone.id)).toContain(zoneIds[0]);
    expect(zones.map((zone: { id: string }) => zone.id)).toContain(zoneIds[1]);
    expect(zones.map((zone: { id: string }) => zone.id)).not.toContain(zoneIds[2]);
    expect(Object.keys(zones[0]).sort()).toEqual(["id", "municipality", "name"]);
  });

  it("una solicitud rechaza dirección ajena y una propia de otra zona", async () => {
    const own = await prisma.address.create({ data: { id: ulid(), user_id: userIds[0], label: "Casa", line: "Calle propia", zone_id: zoneIds[0] } });
    ownAddressId = own.id;
    const base = { category_id: categoryId, zone_id: zoneIds[0], description: "Test dirección", when_type: "now" };
    expect((await request("/api/v1/requests", "POST", { ...base, address_id: otherAddressId })).status).toBe(404);
    expect((await request("/api/v1/requests", "POST", { ...base, address_id: own.id, zone_id: zoneIds[1] })).status).toBe(400);
    expect(await prisma.service_request.count({ where: { customer_id: userIds[0] } })).toBe(0);
  });

  it("una solicitud acepta la dirección propia en su zona", async () => {
    const response = await request("/api/v1/requests", "POST", {
      category_id: categoryId, zone_id: zoneIds[0], description: "Dirección válida", when_type: "now", address_id: ownAddressId,
    });
    expect(response.status).toBe(201);
    const requestId = (await response.json()).data.id;
    const saved = await prisma.service_request.findUniqueOrThrow({ where: { id: requestId } });
    expect(saved.customer_id).toBe(userIds[0]);
    expect(saved.address_id).toBe(ownAddressId);
    expect(saved.zone_id).toBe(zoneIds[0]);
  });
});
