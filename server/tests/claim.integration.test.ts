/**
 * ALTOQUE · Transacción atómica del claim en una base exclusiva de tests
 *
 * Activación únicamente mediante el runner de PostgreSQL aislado.
 *
 * Cobertura OBLIGATORIA (aprobada):
 *  - COMMIT:   request accepted + exactamente 1 history + exactamente 1 notification
 *  - ROLLBACK: fallo tras el UPDATE ⇒ request sigue searching, 0 history, 0 notifications
 *  - CONCURRENCIA: N claims simultáneos ⇒ exactamente 1 gana, el resto 409
 *  - provider no verificado ⇒ FORBIDDEN
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../database/prisma";
import { claimRequest, claimRequestInTx } from "../requests/claimRequest";
import { AppError } from "../lib/errors";
import { ulid } from "../lib/ids";
import { HAS_DB } from "./setup";

const d = describe.runIf(HAS_DB)("Claim atómico · integración aislada", () => {
  const suffix = ulid();
  const catId = `test-cat-${suffix}`;
  const zoneId = `test-zone-${suffix}`;
  const userIds: string[] = [];
  const requestIds: string[] = [];
  const providerIds: string[] = [];
  let categoryCreated = false;
  let zoneCreated = false;

  beforeAll(async () => {
    await prisma.category.create({
      data: { id: catId, name: "Categoría Test", icon: "wrench", group_name: "Test", sort: 99 },
    });
    categoryCreated = true;
    await prisma.zone.create({
      data: { id: zoneId, name: "Zona Test" },
    });
    zoneCreated = true;
  });

  afterAll(async () => {
    try {
      await prisma.$transaction(async (tx) => {
        if (requestIds.length > 0) {
          await tx.service_request.deleteMany({ where: { id: { in: requestIds } } });
        }
        if (providerIds.length > 0) {
          await tx.provider_profile.deleteMany({ where: { id: { in: providerIds } } });
        }
        if (userIds.length > 0) {
          await tx.user.deleteMany({ where: { id: { in: userIds } } });
        }
        if (categoryCreated) await tx.category.deleteMany({ where: { id: catId } });
        if (zoneCreated) await tx.zone.deleteMany({ where: { id: zoneId } });
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  async function makeCustomer() {
    const u = await prisma.user.create({
      data: { name: "Cliente Test", email: `c-${ulid()}@test.altoque.do`, emailVerified: true },
    });
    userIds.push(u.id);
    return u;
  }

  async function makeVerifiedProvider(withCategory = true) {
    const u = await prisma.user.create({
      data: { name: "Pro Test", email: `p-${ulid()}@test.altoque.do`, emailVerified: true, role: "customer" },
    });
    userIds.push(u.id);
    const p = await prisma.provider_profile.create({
      data: {
        id: ulid(),
        user_id: u.id,
        verification_status: "verified",
        referral_code: `T-${ulid()}`,
        provider_zone: { create: { zone_id: zoneId } },
      },
    });
    providerIds.push(p.id);
    if (withCategory) {
      await prisma.provider_service.create({
        data: { provider_id: p.id, category_id: catId, price_from: 800 },
      });
    }
    return { user: u, profile: p };
  }

  async function makeSearchingRequest(customerId: string) {
    const id = ulid();
    const req = await prisma.service_request.create({
      data: {
        id,
        code: `ALT-TEST-${ulid()}`,
        customer_id: customerId,
        category_id: catId,
        zone_id: zoneId,
        description: "Fuga debajo del fregadero (test)",
        when_type: "now",
        status: "searching",
      },
    });
    requestIds.push(id);
    return req;
  }

  it("COMMIT · accepted + exactamente 1 history + exactamente 1 notification", async () => {
    const customer = await makeCustomer();
    const pro = await makeVerifiedProvider();
    const req = await makeSearchingRequest(customer.id);

    const result = await claimRequest(prisma, {
      requestId: req.id,
      providerUserId: pro.user.id,
      etaMin: 15,
    });

    expect(result.status).toBe("accepted");

    const updated = await prisma.service_request.findUnique({ where: { id: req.id } });
    expect(updated!.status).toBe("accepted");
    expect(updated!.provider_id).toBe(pro.profile.id);
    expect(updated!.eta_min).toBe(15);

    const history = await prisma.request_status_history.findMany({ where: { request_id: req.id } });
    expect(history).toHaveLength(1);
    expect(history[0].from_status).toBe("searching");
    expect(history[0].to_status).toBe("accepted");
    expect(history[0].actor_id).toBe(pro.user.id);

    const notifs = await prisma.notification.findMany({ where: { user_id: customer.id } });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].kind).toBe("request_accepted");
  });

  it("ROLLBACK · fallo tras el UPDATE ⇒ nada persiste", async () => {
    const customer = await makeCustomer();
    const pro = await makeVerifiedProvider();
    const req = await makeSearchingRequest(customer.id);

    // Cliente envenenado: la transacción real corre, pero notification.create lanza.
    const poisoned: PrismaClient = new Proxy(prisma, {
      get(target, prop) {
        if (prop === "$transaction") {
          return (fn: (tx: unknown) => Promise<unknown>) =>
            (target as PrismaClient).$transaction(async (tx) => {
              const poisonedTx = new Proxy(tx, {
                get(t, p) {
                  if (p === "notification") throw new Error("fallo inyectado (test de rollback)");
                  return (t as Record<PropertyKey, unknown>)[p];
                },
              });
              return fn(poisonedTx);
            });
        }
        return (target as unknown as Record<PropertyKey, unknown>)[prop];
      },
    });

    await expect(
      claimRequest(poisoned, { requestId: req.id, providerUserId: pro.user.id, etaMin: 20 }),
    ).rejects.toThrow("fallo inyectado");

    // Verificación post-mortem: NADA persistió.
    const updated = await prisma.service_request.findUnique({ where: { id: req.id } });
    expect(updated!.status).toBe("searching");
    expect(updated!.provider_id).toBeNull();

    const history = await prisma.request_status_history.findMany({ where: { request_id: req.id } });
    expect(history).toHaveLength(0);

    const notifs = await prisma.notification.findMany({ where: { user_id: customer.id } });
    expect(notifs).toHaveLength(0);
  });

  it("CONCURRENCIA · 5 claims simultáneos ⇒ exactamente 1 gana, 4 × 409", async () => {
    const customer = await makeCustomer();
    const pros = await Promise.all([0, 1, 2, 3, 4].map(() => makeVerifiedProvider()));
    const req = await makeSearchingRequest(customer.id);

    const results = await Promise.allSettled(
      pros.map((p) => claimRequest(prisma, { requestId: req.id, providerUserId: p.user.id, etaMin: 10 })),
    );

    const winners = results.filter((r) => r.status === "fulfilled");
    const losers = results.filter((r) => r.status === "rejected");
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(4);
    for (const l of losers) {
      const e = (l as PromiseRejectedResult).reason as AppError;
      expect(e).toBeInstanceOf(AppError);
      expect(e.code).toBe("REQUEST_ALREADY_CLAIMED");
    }

    // exactamente 1 history y 1 notification en total
    const history = await prisma.request_status_history.findMany({ where: { request_id: req.id } });
    const notifs = await prisma.notification.findMany({ where: { user_id: customer.id } });
    expect(history).toHaveLength(1);
    expect(notifs).toHaveLength(1);
  });

  it("provider NO verificado ⇒ FORBIDDEN (y la solicitud no cambia)", async () => {
    const customer = await makeCustomer();
    const req = await makeSearchingRequest(customer.id);

    const u = await prisma.user.create({
      data: { name: "Pro Pending", email: `pp-${ulid()}@test.altoque.do`, emailVerified: true },
    });
    userIds.push(u.id);
    const pending = await prisma.provider_profile.create({
      data: {
        id: ulid(),
        user_id: u.id,
        verification_status: "pending_verification",
        referral_code: `T-${ulid()}`,
        provider_service: { create: { category_id: catId, price_from: 800 } },
      },
    });
    providerIds.push(pending.id);

    try {
      await claimRequest(prisma, { requestId: req.id, providerUserId: u.id, etaMin: 10 });
      expect.unreachable("debía lanzar FORBIDDEN");
    } catch (e) {
      expect((e as AppError).code).toBe("FORBIDDEN");
    }

    const updated = await prisma.service_request.findUnique({ where: { id: req.id } });
    expect(updated!.status).toBe("searching");
  });

  it("claim sobre solicitud ya aceptada ⇒ 409 directo (cuerpo transaccional)", async () => {
    const customer = await makeCustomer();
    const pro = await makeVerifiedProvider();
    const req = await makeSearchingRequest(customer.id);
    await claimRequest(prisma, { requestId: req.id, providerUserId: pro.user.id, etaMin: 10 });

    await expect(
      prisma.$transaction((tx) =>
        claimRequestInTx(tx, { requestId: req.id, providerProfileId: pro.profile.id, actorUserId: pro.user.id, etaMin: 10 }),
      ),
    ).rejects.toMatchObject({ code: "REQUEST_ALREADY_CLAIMED" });
  });

  it("el índice parcial impide dos trabajos activos del mismo provider y revierte el segundo claim", async () => {
    const customer = await makeCustomer();
    const otherCustomer = await makeCustomer();
    const pro = await makeVerifiedProvider();
    const active = await makeSearchingRequest(customer.id);
    const waiting = await makeSearchingRequest(otherCustomer.id);
    await claimRequest(prisma, { requestId: active.id, providerUserId: pro.user.id, etaMin: 10 });

    // Verificar cada estado incluido en el predicado del índice, no solo accepted.
    for (const status of ["accepted", "on_the_way", "arrived", "in_progress"] as const) {
      await prisma.service_request.update({ where: { id: active.id }, data: { status } });
      await expect(claimRequest(prisma, {
        requestId: waiting.id, providerUserId: pro.user.id, etaMin: 20,
      })).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
      const unchanged = await prisma.service_request.findUniqueOrThrow({ where: { id: waiting.id } });
      expect(unchanged.status).toBe("searching");
      expect(unchanged.provider_id).toBeNull();
      expect(unchanged.eta_min).toBeNull();
      expect(await prisma.request_status_history.count({ where: { request_id: waiting.id } })).toBe(0);
      expect(await prisma.notification.count({ where: { user_id: otherCustomer.id } })).toBe(0);
      expect(await prisma.service_request.count({
        where: { provider_id: pro.profile.id, status: { in: ["accepted", "on_the_way", "arrived", "in_progress"] } },
      })).toBe(1);
    }

    // La restricción es parcial: al terminar el primero, el siguiente sí entra.
    await prisma.service_request.update({ where: { id: active.id }, data: { status: "completed" } });
    const next = await claimRequest(prisma, {
      requestId: waiting.id, providerUserId: pro.user.id, etaMin: 20,
    });
    expect(next.status).toBe("accepted");
    expect(await prisma.request_status_history.count({ where: { request_id: waiting.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { user_id: otherCustomer.id } })).toBe(1);
  });
});

void d;
