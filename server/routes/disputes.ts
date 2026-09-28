/**
 * ALTOQUE · Endpoints de disputas (F5)
 *
 * Gestión de disputas entre cliente y proveedor:
 * - Crear disputa (cliente o proveedor)
 * - Consultar disputas propias
 * - Resolver disputa (admin)
 * - Historial de disputas
 */
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../database/prisma.js";
import { requireAuth, requireVerifiedEmail, requirePermission, type AuthEnv } from "../middleware/auth.js";
import { ok, page, pageMeta, parsePaging } from "../lib/envelope.js";
import { AppError } from "../lib/errors.js";
import { ulid } from "../lib/ids.js";
import { audit } from "../lib/audit.js";

export const disputeRoutes = new Hono<AuthEnv>();

// ── POST /api/v1/disputes ──
// Crear disputa (cliente o proveedor de una solicitud)
disputeRoutes.post("/", requireAuth, requireVerifiedEmail, async (c) => {
  const { user } = c.get("auth");
  const body = await c.req.json();

  const schema = z.object({
    request_id: z.string(),
    reason: z.string().min(10).max(2000),
  });

  const data = schema.parse(body);

  // Verificar que la solicitud existe
  const request = await prisma.service_request.findUnique({
    where: { id: data.request_id },
    include: { review: true },
  });

  if (!request) {
    throw AppError.notFound("Solicitud");
  }

  // Verificar ownership (cliente o proveedor de la solicitud)
  const isCustomer = request.customer_id === user.id;
  const provider = await prisma.provider_profile.findUnique({
    where: { user_id: user.id },
  });
  const isProvider = provider && request.provider_id === provider.id;

  if (!isCustomer && !isProvider) {
    throw AppError.forbidden("No tienes permiso para disputar esta solicitud");
  }

  // Verificar que no exista ya una disputa abierta para esta solicitud
  const existingDispute = await prisma.dispute.findFirst({
    where: {
      request_id: data.request_id,
      status: "open",
    },
  });

  if (existingDispute) {
    throw AppError.conflict("Ya existe una disputa abierta para esta solicitud");
  }

  // Verificar que la solicitud esté en estado válido para disputa
  const validStatuses = ["completed", "confirmed", "reviewed"];
  if (!validStatuses.includes(request.status)) {
    throw AppError.conflict("Solo se pueden disputar solicitudes completadas, confirmadas o revisadas");
  }

  // Crear disputa
  const dispute = await prisma.dispute.create({
     {
      id: ulid(),
      request_id: data.request_id,
      opened_by: user.id,
      reason: data.reason,
      status: "open",
    },
    include: {
      request: {
        include: {
          customer: { select: { id: true, name: true, email: true } },
          provider: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  });

  // Notificar al admin (crear notificación para todos los admins)
  const admins = await prisma.user.findMany({
    where: { role: "admin" },
    select: { id: true },
  });

  if (admins.length > 0) {
    await prisma.notification.createMany({
       {
        data: admins.map((admin) => ({
          id: ulid(),
          user_id: admin.id,
          kind: "dispute_opened",
          title: "Nueva disputa abierta",
          body: `Se ha abierto una disputa para la solicitud ${request.code}`,
          meta: { disputeId: dispute.id, requestId: request.id },
        })),
      },
    });
  }

  return c.json(ok(dispute), 201);
});

// ── GET /api/v1/disputes ──
// Listar disputas propias (cliente o proveedor)
disputeRoutes.get("/", requireAuth, requireVerifiedEmail, async (c) => {
  const { user } = c.get("auth");
  const { page: pageNum, limit, skip } = parsePaging(c.req.query());

  // Obtener provider si existe
  const provider = await prisma.provider_profile.findUnique({
    where: { user_id: user.id },
  });

  // Disputas donde el usuario es cliente o proveedor
  const where = {
    OR: [
      { opened_by: user.id },
      { resolved_by: user.id },
      { request: { customer_id: user.id } },
      ...(provider ? [{ request: { provider_id: provider.id } }] : []),
    ],
  };

  const [disputes, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: "desc" },
      include: {
        request: {
          include: {
            customer: { select: { id: true, name: true, email: true } },
            provider: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
            category: true,
          },
        },
        opener: { select: { id: true, name: true, email: true } },
        resolver: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.dispute.count({ where }),
  ]);

  return c.json(page(disputes, pageMeta(pageNum, limit, total)));
});

// ── GET /api/v1/disputes/:id ──
// Obtener disputa específica (con validación de acceso)
disputeRoutes.get("/:id", requireAuth, requireVerifiedEmail, async (c) => {
  const { user } = c.get("auth");
  const disputeId = c.req.param("id");

  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      request: {
        include: {
          customer: { select: { id: true, name: true, email: true } },
          provider: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          category: true,
          zone: true,
          review: true,
        },
      },
      opener: { select: { id: true, name: true, email: true } },
      resolver: { select: { id: true, name: true, email: true } },
    },
  });

  if (!dispute) {
    throw AppError.notFound("Disputa");
  }

  // Verificar acceso (partes involucradas o admin)
  const isOpener = dispute.opened_by === user.id;
  const isCustomer = dispute.request.customer_id === user.id;
  const provider = await prisma.provider_profile.findUnique({
    where: { user_id: user.id },
  });
  const isProvider = provider && dispute.request.provider_id === provider.id;
  const isAdmin = user.role === "admin";

  if (!isOpener && !isCustomer && !isProvider && !isAdmin) {
    throw AppError.forbidden("No tienes permiso para ver esta disputa");
  }

  return c.json(ok(dispute));
});

// ── POST /api/v1/disputes/:id/resolve ──
// Resolver disputa (solo admin con permiso disputes.resolve)
disputeRoutes.post("/:id/resolve", requireAuth, requireVerifiedEmail, requirePermission("disputes.resolve"), async (c) => {
  const { user: admin } = c.get("auth");
  const disputeId = c.req.param("id");
  const body = await c.req.json();

  const schema = z.object({
    status: z.enum(["resolved_customer", "resolved_provider"]),
    resolution: z.string().min(10).max(2000),
  });

  const data = schema.parse(body);

  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
  });

  if (!dispute) {
    throw AppError.notFound("Disputa");
  }

  if (dispute.status !== "open") {
    throw AppError.conflict("Esta disputa ya fue resuelta");
  }

  // Resolver disputa
  const resolved = await prisma.dispute.update({
    where: { id: disputeId },
     {
      status: data.status,
      resolved_by: admin.id,
      resolution: data.resolution,
    },
    include: {
      request: true,
    },
  });

  // Auditoría
  await audit(prisma, {
    id: admin.id,
    name: admin.name,
    adminRole: c.get("adminRole") || "moderator",
  }, {
    action: "DISPUTE_RESOLVED",
    entityType: "dispute",
    entityId: disputeId,
    meta { status: data.status, resolution: data.resolution },
  });

  // Notificar a las partes
  const request = await prisma.service_request.findUnique({
    where: { id: dispute.request_id },
    include: {
      provider: { include: { user: true } },
    },
  });

  if (request) {
    const notifications = [
      {
        id: ulid(),
        user_id: request.customer_id,
        kind: "dispute_resolved",
        title: "Disputa resuelta",
        body: `La disputa fue resuelta a favor de ${data.status === "resolved_customer" ? "tu solicitud" : "el proveedor"}.`,
        meta: { disputeId, status: data.status },
      },
      {
        id: ulid(),
        user_id: request.provider.user_id,
        kind: "dispute_resolved",
        title: "Disputa resuelta",
        body: `La disputa fue resuelta a favor de ${data.status === "resolved_provider" ? "tu trabajo" : "el cliente"}.`,
        meta: { disputeId, status: data.status },
      },
    ];

    await prisma.notification.createMany({  notifications });
  }

  return c.json(ok(resolved));
});

// ── GET /api/v1/admin/disputes ──
// Listar todas las disputas (admin)
disputeRoutes.get("/admin/all", requireAuth, requireVerifiedEmail, requirePermission("disputes.resolve"), async (c) => {
  const { page: pageNum, limit, skip } = parsePaging(c.req.query());
  const status = c.req.query("status");

  const where: any = {};
  if (status) where.status = status;

  const [disputes, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: "desc" },
      include: {
        request: {
          include: {
            customer: { select: { id: true, name: true, email: true } },
            provider: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
            category: true,
          },
        },
        opener: { select: { id: true, name: true, email: true } },
        resolver: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.dispute.count({ where }),
  ]);

  return c.json(page(disputes, pageMeta(pageNum, limit, total)));
});
