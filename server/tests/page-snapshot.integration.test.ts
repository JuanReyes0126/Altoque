import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { app } from "../index.js";
import { prisma, type Tx } from "../database/prisma.js";
import { claimRequest } from "../requests/claimRequest.js";
import { ulid } from "../lib/ids.js";
import { HAS_DB } from "./setup.js";
import { createTestCookie, testHeaders } from "./session-helpers.js";

describe.runIf(HAS_DB)("Paginación · snapshot real durante DELETE/claim concurrente", () => {
  const categoryId = ulid(), zoneId = ulid();
  const users: Record<string, string> = {};
  const cookies: Record<string, string> = {};
  const fixtureUsers: string[] = [], requestIds: string[] = [], providerIds: string[] = [];
  let categoryCreated = false, zoneCreated = false;

  beforeAll(async () => {
    await prisma.category.create({ data: { id: categoryId, name: "Snapshot category", icon: "wrench", group_name: "Test" } });
    categoryCreated = true;
    await prisma.zone.create({ data: { id: zoneId, name: "Snapshot zone" } });
    zoneCreated = true;
    for (const name of ["customer", "provider", "admin"]) {
      const user = await prisma.user.create({ data: {
        id: ulid(), name, email: `${ulid()}@example.invalid`, emailVerified: true,
        ...(name === "admin" ? { role: "admin", admin_profile: { create: { admin_role: "super_admin" } } } : {}),
      } });
      users[name] = user.id;
      cookies[name] = await createTestCookie(user.id);
    }
  });
  async function cleanup() {
    await prisma.notification.deleteMany({ where: { user_id: { in: Object.values(users) } } });
    await prisma.admin_audit_log.deleteMany({ where: { actor_id: users.admin } });
    await prisma.service_request.deleteMany({ where: { id: { in: requestIds } } });
    await prisma.provider_profile.deleteMany({ where: { id: { in: providerIds } } });
    await prisma.user.deleteMany({ where: { id: { in: fixtureUsers } } });
    requestIds.length = 0; providerIds.length = 0; fixtureUsers.length = 0;
  }
  afterEach(async () => { vi.restoreAllMocks(); await cleanup(); });
  afterAll(async () => {
    try {
      await cleanup();
      await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
      if (categoryCreated) await prisma.category.deleteMany({ where: { id: categoryId } });
      if (zoneCreated) await prisma.zone.deleteMany({ where: { id: zoneId } });
    } finally { await prisma.$disconnect(); }
  });

  async function request(status: "searching" | "completed" = "searching") {
    const id = ulid(); requestIds.push(id);
    return prisma.service_request.create({ data: {
      id, code: `SNAP-${id}`, customer_id: users.customer, category_id: categoryId, zone_id: zoneId,
      description: "Solicitud fixture snapshot", when_type: "now", status,
    } });
  }
  async function provider(status: "verified" | "pending_verification") {
    const id = ulid(); providerIds.push(id);
    return prisma.provider_profile.create({ data: {
      id, user_id: users.provider, referral_code: `SNAP-${id}`, verification_status: status,
      provider_service: { create: { category_id: categoryId, price_from: 0 } },
      provider_zone: { create: { zone_id: zoneId } },
    } });
  }

  type Model = "user" | "provider_profile" | "service_request" | "dispute" | "admin_audit_log";
  const scenarios = [
    { name: "admin/users", model: "user", actor: "admin" },
    { name: "admin/providers", model: "provider_profile", actor: "admin" },
    { name: "admin/requests", model: "service_request", actor: "admin" },
    { name: "admin/audit", model: "admin_audit_log", actor: "admin" },
    { name: "disputes/admin/all", model: "dispute", actor: "admin" },
    { name: "disputes", model: "dispute", actor: "customer" },
    { name: "requests", model: "service_request", actor: "customer" },
    { name: "provider/inbox", model: "service_request", actor: "provider" },
  ] as const;

  it.each(scenarios)("$name: filas y total conservan el mismo snapshot con escritura entre SELECTs", async ({ name, model, actor }) => {
    let id: string, query = "", mutate: () => Promise<unknown>, countLive: () => Promise<number>;
    if (model === "user") {
      id = ulid(); fixtureUsers.push(id);
      const userName = `Snapshot-${id}`;
      await prisma.user.create({ data: { id, name: userName, email: `${id}@example.invalid`, emailVerified: true } });
      query = `&q=${userName}`;
      mutate = () => prisma.user.delete({ where: { id } });
      countLive = () => prisma.user.count({ where: { id } });
    } else if (model === "provider_profile") {
      id = (await provider("pending_verification")).id;
      query = "&status=pending_verification";
      mutate = () => prisma.provider_profile.delete({ where: { id } });
      countLive = () => prisma.provider_profile.count({ where: { id } });
    } else if (model === "admin_audit_log") {
      id = ulid();
      await prisma.admin_audit_log.create({ data: { id, actor_id: users.admin, actor_name: "Snapshot admin", actor_admin_role: "super_admin", action: "TEST_SNAPSHOT", entity_type: "fixture", entity_id: id } });
      query = "&action=TEST_SNAPSHOT";
      mutate = () => prisma.admin_audit_log.delete({ where: { id } });
      countLive = () => prisma.admin_audit_log.count({ where: { id } });
    } else if (model === "dispute") {
      const req = await request("completed");
      id = ulid();
      await prisma.dispute.create({ data: { id, request_id: req.id, opened_by: users.customer, reason: "Disputa snapshot fixture" } });
      mutate = () => prisma.dispute.delete({ where: { id } });
      countLive = () => prisma.dispute.count({ where: { id } });
    } else {
      id = (await request()).id;
      if (name === "provider/inbox") {
        await provider("verified");
        mutate = () => claimRequest(prisma, { requestId: id, providerUserId: users.provider, etaMin: 15 });
        countLive = () => prisma.service_request.count({ where: { id, status: "searching" } });
      } else {
        query = name === "admin/requests" ? "&status=searching" : "";
        mutate = () => prisma.service_request.delete({ where: { id } });
        countLive = () => prisma.service_request.count({ where: { id } });
      }
    }

    const transaction = prisma.$transaction.bind(prisma);
    let mutated = false, readCount = 0;
    vi.spyOn(prisma, "$transaction").mockImplementation(((read: (tx: Tx) => Promise<unknown>, options?: { isolationLevel?: Prisma.TransactionIsolationLevel }) => {
      if (options?.isolationLevel !== Prisma.TransactionIsolationLevel.RepeatableRead) return transaction(read, options);
      let firstRead!: () => void;
      const rowsReady = new Promise<void>((resolve) => { firstRead = resolve; });
      return transaction((tx) => read(new Proxy(tx, {
        get(target, key) {
          if (key !== model) return target[key as keyof Tx];
          const delegate = target[model as Model] as unknown as { findMany: (args: unknown) => Promise<unknown>; count: (args: unknown) => Promise<number> };
          return new Proxy(delegate, {
            get(modelDelegate, operation) {
              if (operation === "findMany") return async (args: unknown) => {
                try { return await modelDelegate.findMany(args); }
                finally { firstRead(); }
              };
              if (operation === "count") return async (args: unknown) => {
                await rowsReady;
                await mutate();
                mutated = true;
                readCount++;
                return modelDelegate.count(args);
              };
              return modelDelegate[operation as keyof typeof modelDelegate];
            },
          });
        },
      })), options);
    }) as unknown as typeof prisma.$transaction);

    const response = await app.request(`/api/v1/${name}?page=1&limit=2${query}`, { headers: testHeaders(cookies[actor]) });
    expect(response.status).toBe(200);
    expect(mutated).toBe(true);
    expect(readCount).toBe(1);
    const body = await response.json();
    expect(body.data.map((row: { id: string }) => row.id)).toEqual([id]);
    expect(body.meta).toEqual({ page: 1, limit: 2, total: 1, pages: 1 });
    expect(await countLive()).toBe(0);
  });
});
