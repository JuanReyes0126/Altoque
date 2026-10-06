/**
 * ALTOQUE · Endpoints de proveedores (F3)
 *
 * Gestión del lado proveedor:
 * - Perfil y configuración
 * - Disponibilidad
 * - Inbox de solicitudes compatibles
 * - Claim atómico
 * - Transiciones de estado del trabajo
 */
import { Hono } from "hono";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../database/prisma.js";
import { requireAuth, requireVerifiedEmail, type AuthEnv } from "../middleware/auth.js";
import { ok, page, pageMeta, parsePaging } from "../lib/envelope.js";
import { AppError } from "../lib/errors.js";
import { readJsonBody } from "../lib/json.js";
import { ulid } from "../lib/ids.js";
import { createWithReferralCode } from "../lib/referrals.js";
import { consume, LIMITS } from "../lib/ratelimit.js";
import { claimRequest } from "../requests/claimRequest.js";
import { transitionRequest } from "../requests/transitions.js";

export const providerRoutes = new Hono<AuthEnv>();

// ── GET /api/v1/provider/me ──
// Obtener perfil del proveedor autenticado
providerRoutes.get("/me", requireAuth, requireVerifiedEmail, async (c) => {
  const { user } = c.get("auth");

  const provider = await prisma.provider_profile.findUnique({
    where: { user_id: user.id },
    include: {
      provider_service: {
        include: { category: true },
      },
      provider_zone: {
        include: { zone: true },
      },
    },
  });

  if (!provider) {
    throw AppError.notFound("Perfil de proveedor");
  }

  return c.json(ok(provider));
});

// ── POST /api/v1/provider/me ──
// Crear perfil de proveedor (si no existe)
providerRoutes.post("/me", requireAuth, requireVerifiedEmail, async (c) => {
  const { user } = c.get("auth");
  const body = await readJsonBody(c.req);

  const schema = z.object({
    business_name: z.string().max(100).optional(),
    bio: z.string().max(600).optional(),
    years_exp: z.number().int().min(0).max(50).optional(),
    category_ids: z.array(z.string().min(1)).min(1).max(100).refine((ids) => new Set(ids).size === ids.length, "No repitas servicios"),
    zone_ids: z.array(z.string().min(1)).min(1).max(100).refine((ids) => new Set(ids).size === ids.length, "No repitas zonas"),
  });

  const data = schema.parse(body);

  // Verificar que no exista ya un perfil
  const existing = await prisma.provider_profile.findUnique({
    where: { user_id: user.id },
  });

  if (existing) {
    throw AppError.conflict("Ya tienes un perfil de proveedor");
  }

  // Cada colisión de referido reintenta toda la operación en una transacción nueva.
  const provider = await createWithReferralCode((code) => prisma.$transaction(async (tx) => {
    const [categories, zones] = await Promise.all([
      tx.category.count({ where: { id: { in: data.category_ids }, is_active: true } }),
      tx.zone.count({ where: { id: { in: data.zone_ids }, is_active: true } }),
    ]);
    if (categories !== data.category_ids.length || zones !== data.zone_ids.length) {
      throw AppError.validation([{ path: "category_ids", message: "Selecciona servicios y zonas disponibles" }]);
    }
    const newProvider = await tx.provider_profile.create({
      data: {
        id: ulid(),
        user_id: user.id,
        business_name: data.business_name,
        bio: data.bio || "",
        years_exp: data.years_exp || 0,
        verification_status: "pending_verification",
        referral_code: code,
      },
    });

    // Añadir categorías
    await tx.provider_service.createMany({
      data: data.category_ids.map((categoryId) => ({
        provider_id: newProvider.id,
        category_id: categoryId,
        price_from: 0,
      })),
    });

    // Añadir zonas
    await tx.provider_zone.createMany({
      data: data.zone_ids.map((zoneId) => ({
        provider_id: newProvider.id,
        zone_id: zoneId,
      })),
    });

    return newProvider;
  })).catch((error: unknown) => {
    // El precheck mejora UX, pero el unique sigue siendo la autoridad ante dos altas simultáneas.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const model = error.meta?.modelName;
      const target = error.meta?.target;
      if ((model === undefined || model === "provider_profile") &&
        (target === "provider_profile_user_id_key" || (model === "provider_profile" &&
          (target === "user_id" || (Array.isArray(target) && target.length === 1 && target[0] === "user_id"))))) {
        throw AppError.conflict("Ya tienes un perfil de proveedor");
      }
    }
    throw error;
  });

  return c.json(ok(provider), 201);
});

// ── PATCH /api/v1/provider/me ──
// Actualizar perfil del proveedor
providerRoutes.patch("/me", requireAuth, requireVerifiedEmail, async (c) => {
  const { user } = c.get("auth");
  const body = await readJsonBody(c.req);

  const schema = z.object({
    business_name: z.string().max(100).optional(),
    bio: z.string().max(600).optional(),
    years_exp: z.number().int().min(0).max(50).optional(),
    avg_eta_min: z.number().int().min(1).max(120).optional(),
  });

  const data = schema.parse(body);

  const provider = await prisma.$transaction(async (tx) => {
    const changed = await tx.provider_profile.updateMany({ where: { user_id: user.id }, data });
    if (changed.count !== 1) throw AppError.notFound("Perfil de proveedor");
    return tx.provider_profile.findUniqueOrThrow({ where: { user_id: user.id } });
  });

  return c.json(ok(provider));
});

// ── PATCH /api/v1/provider/availability ──
// Cambiar disponibilidad del proveedor
providerRoutes.patch("/availability", requireAuth, requireVerifiedEmail, async (c) => {
  const { user } = c.get("auth");
  const body = await readJsonBody(c.req);

  const schema = z.object({
    is_available: z.boolean(),
  });

  const data = schema.parse(body);

  const provider = await prisma.provider_profile.findUnique({
    where: { user_id: user.id },
  });

  if (!provider) {
    throw AppError.notFound("Perfil de proveedor");
  }

  if (provider.verification_status !== "verified") {
    throw AppError.forbidden("Solo proveedores verificados pueden cambiar disponibilidad");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.provider_profile.updateMany({
      where: { user_id: user.id, verification_status: "verified" },
      data: { is_available: data.is_available, available_since: data.is_available ? new Date() : null },
    });
    if (changed.count !== 1) throw AppError.forbidden("Tu perfil cambió. Recarga antes de cambiar disponibilidad.");
    return tx.provider_profile.findUniqueOrThrow({ where: { user_id: user.id } });
  });

  return c.json(ok({ is_available: updated.is_available }));
});

// ── GET /api/v1/provider/inbox ──
// Solicitudes compatibles disponibles para el proveedor
providerRoutes.get("/inbox", requireAuth, requireVerifiedEmail, async (c) => {
  const { user } = c.get("auth");
  const { page: pageNum, limit, skip } = parsePaging(c.req.query());

  const provider = await prisma.provider_profile.findUnique({
    where: { user_id: user.id },
    include: {
      provider_service: {
        select: { category_id: true },
      },
      provider_zone: {
        select: { zone_id: true },
      },
    },
  });

  if (!provider) {
    throw AppError.notFound("Perfil de proveedor");
  }

  if (provider.verification_status !== "verified") {
    throw AppError.forbidden("Solo proveedores verificados pueden ver solicitudes");
  }

  const categoryIds = provider.provider_service.map((s) => s.category_id);
  const zoneIds = provider.provider_zone.map((z) => z.zone_id);

  const where = {
    status: "searching" as const,
    customer_id: { not: user.id },
    category_id: { in: categoryIds },
    zone_id: { in: zoneIds },
  };

  const [requests, total] = await Promise.all([
    prisma.service_request.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: "desc" },
      include: {
        category: true,
        zone: true,
        customer: {
          select: { id: true, name: true },
        },
        request_photo: {
          orderBy: { sort: "asc" },
        },
      },
    }),
    prisma.service_request.count({ where }),
  ]);

  return c.json(page(requests, pageMeta(pageNum, limit, total)));
});

// ── POST /api/v1/requests/:id/claim ──
// Reclamar una solicitud (claim atómico)
providerRoutes.post("/requests/:id/claim", requireAuth, requireVerifiedEmail, async (c) => {
  const { user } = c.get("auth");
  const requestId = c.req.param("id");
  const body = await readJsonBody(c.req);

  const schema = z.object({
    eta_min: z.number().int().min(5).max(120),
  });

  const data = schema.parse(body);

  // Rate limiting
  await consume(prisma, LIMITS.claim, user.id);

  // Claim atómico (implementado en claimRequest.ts)
  const result = await claimRequest(prisma, {
    requestId,
    providerUserId: user.id,
    etaMin: data.eta_min,
  });

  return c.json(ok(result));
});

// ── POST /api/v1/requests/:id/status ──
// Actualizar estado del trabajo (solo proveedor asignado)
providerRoutes.post("/requests/:id/status", requireAuth, requireVerifiedEmail, async (c) => {
  const { user } = c.get("auth");
  const requestId = c.req.param("id");
  const body = await readJsonBody(c.req);

  const schema = z.object({
    status: z.enum(["on_the_way", "arrived", "in_progress", "completed"]),
    note: z.string().max(500).optional(),
  });

  const data = schema.parse(body);

  const request = await prisma.service_request.findUnique({
    where: { id: requestId },
  });

  if (!request) throw AppError.notFound("Solicitud");

  // Verificar que el proveedor está asignado
  const provider = await prisma.provider_profile.findUnique({
    where: { user_id: user.id },
  });

  if (!provider || request.provider_id !== provider.id) {
    throw AppError.forbidden("No estás asignado a esta solicitud");
  }

  // Validar transición de estado
  const validTransitions: Record<string, string[]> = {
    accepted: ["on_the_way"],
    on_the_way: ["arrived"],
    arrived: ["in_progress"],
    in_progress: ["completed"],
  };

  const allowed = validTransitions[request.status] || [];
  if (!allowed.includes(data.status)) {
    throw AppError.invalidTransition(request.status, data.status);
  }

  // Actualizar estado en transacción
  await prisma.$transaction(async (tx) => {
    await transitionRequest(tx, {
      id: requestId, from: request.status, to: data.status, where: { provider_id: provider.id },
      data: { completed_at: data.status === "completed" ? new Date() : undefined },
    });

    await tx.request_status_history.create({
      data: {
        id: ulid(),
        request_id: requestId,
        from_status: request.status,
        to_status: data.status as any,
        actor_id: user.id,
        actor_kind: "provider",
        note: data.note || null,
      },
    });

    // Notificación al cliente
    const notificationKind = {
      on_the_way: "provider_on_the_way",
      arrived: "provider_arrived",
      in_progress: "service_started",
      completed: "service_completed",
    }[data.status];

    await tx.notification.create({
      data: {
        id: ulid(),
        user_id: request.customer_id,
        kind: notificationKind,
        title: {
          on_the_way: "Tu profesional está en camino",
          arrived: "Tu profesional ha llegado",
          in_progress: "El servicio ha comenzado",
          completed: "Servicio completado",
        }[data.status],
        body: data.note || "Actualización de tu solicitud",
        meta: { requestId, code: request.code },
      },
    });
  });

  return c.json(ok({ message: "Estado actualizado" }));
});

// ── GET /api/v1/provider/active-job ──
// Obtener el trabajo activo actual del proveedor
providerRoutes.get("/active-job", requireAuth, requireVerifiedEmail, async (c) => {
  const { user } = c.get("auth");

  const provider = await prisma.provider_profile.findUnique({
    where: { user_id: user.id },
  });

  if (!provider) {
    throw AppError.notFound("Perfil de proveedor");
  }

  // Buscar trabajo activo (estados intermedios)
  const activeJob = await prisma.service_request.findFirst({
    where: {
      provider_id: provider.id,
      status: { in: ["accepted", "on_the_way", "arrived", "in_progress"] },
    },
    include: {
      customer: {
        select: { id: true, name: true, email: true },
      },
      category: true,
      zone: true,
      address: true,
      request_photo: {
        orderBy: { sort: "asc" },
      },
    },
  });

  // Si no hay trabajo activo, devolver null en data
  return c.json(ok({ job: activeJob }));
});

// ── GET /api/v1/provider/earnings ──
// Estadísticas de ingresos del proveedor
providerRoutes.get("/earnings", requireAuth, requireVerifiedEmail, async (c) => {
  const { user } = c.get("auth");
  const range = c.req.query("range") || "week";

  const provider = await prisma.provider_profile.findUnique({
    where: { user_id: user.id },
  });

  if (!provider) {
    throw AppError.notFound("Perfil de proveedor");
  }

  const now = new Date();
  let startDate: Date;

  if (range === "week") {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (range === "month") {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else {
    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  const [completedCount, earnings] = await Promise.all([
    prisma.service_request.count({
      where: {
        provider_id: provider.id,
        status: { in: ["completed", "confirmed", "reviewed"] },
        completed_at: { gte: startDate },
      },
    }),
    prisma.transaction_ledger.aggregate({
      where: {
        provider_id: provider.id,
        created_at: { gte: startDate },
      },
      _sum: {
        amount: true,
      },
    }),
  ]);

  return c.json(ok({
    range,
    completedCount,
    earnings: earnings._sum.amount?.toNumber() || 0,
  }));
});
