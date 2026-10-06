import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";
import { app } from "../index.js";
import { prisma, type Tx } from "../database/prisma.js";
import { claimRequest } from "../requests/claimRequest.js";
import { ulid } from "../lib/ids.js";
import { HAS_DB } from "./setup.js";
import { createTestCookie, testHeaders } from "./session-helpers.js";

describe.runIf(HAS_DB)("Backend · estabilización de inputs, altas y elegibilidad", () => {
  const categoryId = ulid(), zoneId = ulid();
  const users: Record<string, string> = {};
  const cookies: Record<string, string> = {};
  let sequenceCreated = false;
  let categoryCreated = false, zoneCreated = false;

  const send = (path: string, actor: string, body?: unknown, method = "POST") => app.request(path, {
    method, headers: { ...testHeaders(cookies[actor]), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const providerBody = () => ({ category_ids: [categoryId], zone_ids: [zoneId] });
  const requestBody = (extra: Record<string, unknown> = {}) => ({
    category_id: categoryId, zone_id: zoneId, description: "Solicitud de regresión", when_type: "now", ...extra,
  });

  beforeAll(async () => {
    await prisma.category.create({ data: { id: categoryId, name: "Stabilization category", icon: "wrench", group_name: "Test" } });
    categoryCreated = true;
    await prisma.zone.create({ data: { id: zoneId, name: "Stabilization zone" } });
    zoneCreated = true;
    for (const name of ["customer", "provider", "other"]) {
      const user = await prisma.user.create({ data: { id: ulid(), name, email: `${ulid()}@example.invalid`, emailVerified: true } });
      users[name] = user.id;
      cookies[name] = await createTestCookie(user.id);
    }
    if (!await prisma.request_code_seq.findUnique({ where: { id: 1 } })) {
      await prisma.request_code_seq.create({ data: { id: 1, last_value: 0 } });
      sequenceCreated = true;
    }
  });

  async function cleanup() {
    const ids = Object.values(users);
    await prisma.service_request.deleteMany({ where: { customer_id: { in: ids } } });
    await prisma.notification.deleteMany({ where: { user_id: { in: ids } } });
    await prisma.rate_limit.deleteMany({ where: { subject: { in: ids } } });
    await prisma.provider_profile.deleteMany({ where: { user_id: { in: ids } } });
  }
  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanup();
    await prisma.user.updateMany({ where: { id: { in: Object.values(users) } }, data: { status: "active", emailVerified: true } });
  });
  afterAll(async () => {
    try {
      await cleanup();
      await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
      if (categoryCreated) await prisma.category.deleteMany({ where: { id: categoryId } });
      if (zoneCreated) await prisma.zone.deleteMany({ where: { id: zoneId } });
      if (sequenceCreated) await prisma.request_code_seq.deleteMany({ where: { id: 1 } });
    } finally { await prisma.$disconnect(); }
  });

  async function makeProvider() {
    return prisma.provider_profile.create({ data: {
      id: ulid(), user_id: users.provider, referral_code: `STAB-${ulid()}`, verification_status: "verified",
      provider_service: { create: { category_id: categoryId, price_from: 0 } },
      provider_zone: { create: { zone_id: zoneId } },
    } });
  }
  async function makeRequest(customerId = users.customer) {
    const id = ulid();
    return prisma.service_request.create({ data: {
      id, code: `STAB-${id}`, customer_id: customerId, category_id: categoryId, zone_id: zoneId,
      description: "Solicitud fixture", when_type: "now",
    } });
  }

  it("dos altas simultáneas producen 201/409 y una sola asociación de servicios/zonas", async () => {
    const original = prisma.provider_profile.findUnique.bind(prisma.provider_profile);
    let prechecks = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    vi.spyOn(prisma.provider_profile, "findUnique").mockImplementation((async (args: Parameters<typeof original>[0]) => {
      const result = await original(args);
      if (args.where.user_id === users.other) {
        prechecks++;
        if (prechecks === 2) release();
        await barrier;
      }
      return result;
    }) as unknown as typeof prisma.provider_profile.findUnique);
    const responses = await Promise.all([0, 1].map(() => send("/api/v1/provider/me", "other", providerBody())));
    expect(prechecks).toBe(2);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const profiles = await prisma.provider_profile.findMany({ where: { user_id: users.other }, include: { provider_service: true, provider_zone: true } });
    expect(profiles).toHaveLength(1);
    expect(profiles[0].provider_service).toHaveLength(1);
    expect(profiles[0].provider_zone).toHaveLength(1);
  });

  it.each([
    { modelName: "provider_profile", target: ["user_id"] },
    { modelName: "provider_profile", target: "user_id" },
    { target: "provider_profile_user_id_key" },
  ])("solo el unique del usuario profesional produce conflicto: %j", async (meta) => {
    vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("Fixture", { code: "P2002", clientVersion: "6.19.3", meta }));
    const response = await send("/api/v1/provider/me", "other", providerBody());
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("CONFLICT");
  });

  it.each([
    { code: "P2002", meta: { modelName: "other_model", target: ["user_id"] } },
    { code: "P2002", meta: { target: ["user_id"] } },
    { code: "P2002", meta: { modelName: "provider_profile", target: ["user_id", "referral_code"] } },
    { code: "P2003", meta: { modelName: "provider_profile", target: ["user_id"] } },
  ])("no oculta errores DB diferentes: %j", async ({ code, meta }) => {
    const transaction = vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("Fixture", { code, clientVersion: "6.19.3", meta }));
    expect((await send("/api/v1/provider/me", "other", providerBody())).status).toBe(500);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("el inbox excluye solicitudes propias antes de calcular página y total", async () => {
    await makeProvider();
    await makeRequest(users.provider);
    const visible = await makeRequest();
    const response = await send("/api/v1/provider/inbox?limit=1", "provider", undefined, "GET");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.meta).toEqual({ page: 1, limit: 1, total: 1, pages: 1 });
    expect(body.data.map((row: { id: string }) => row.id)).toEqual([visible.id]);
  });

  it("el inbox con únicamente solicitudes propias devuelve éxito vacío", async () => {
    await makeProvider();
    await makeRequest(users.provider);
    const response = await send("/api/v1/provider/inbox", "provider", undefined, "GET");
    expect(await response.json()).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 1 } });
  });


});
