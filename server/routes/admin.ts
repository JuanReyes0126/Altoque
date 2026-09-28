/**
 * ALTOQUE · Endpoints de administración (F6)
 *
 * Panel administrativo con RBAC:
 * - Dashboard con métricas
 * - Gestión de usuarios
 * - Gestión de proveedores (aprobación/verificación)
 * - Gestión de solicitudes
 * - Gestión de categorías
 * - Auditoría
 */
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../database/prisma.js";
import { requireAuth, requireVerifiedEmail, requirePermission, type AuthEnv } from "../middleware/auth.js";
import { ok, page, pageMeta, parsePaging } from "../lib/envelope.js";
import { AppError } from "../lib/errors.js";
import { ulid } from "../lib/ids.js";
import { audit } from "../lib/audit.js";

export const adminRoutes = new Hono<AuthEnv>();

// ── GET /api/v1/admin/metrics ──
// Dashboard con métricas generales
adminRoutes.get("/metrics", requireAuth, requireVerifiedEmail, requirePermission("users.read"), async (c) => {
  const [
    totalUsers,
    totalProviders,
    verifiedProviders,
    totalRequests,
    activeRequests,
    completedRequests,
    pendingProviders,
    openDisputes,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.provider_profile.count(),
    prisma.provider_profile.count({ where: { verification_status: "verified" } }),
    prisma.service_request.count(),
    prisma.service_request.count({ where: { status: { in: ["searching", "accepted", "on_the_way", "arrived", "in_progress"] } } }),
    prisma.service_request.count({ where: { status: { in: ["completed", "confirmed", "reviewed"] } } }),
    prisma.provider_profile.count({ where: { verification_status: "pending_verification" } }),
    prisma.dispute.count({ where: { status: "open" } }),
  ]);

  const avgRating = await prisma.review.aggregate({
    _avg: { rating: true },
  });

  return c.json(ok({
    users: totalUsers,
    providers: totalProviders,
    providersVerified: verifiedProviders,
    requestsTotal: totalRequests,
    requestsActive: activeRequests,
    requestsCompleted: completedRequests,
    pendingProviders,
    openDisputes,
    avgRating: avgRating._avg.rating || 0,
  }));
});

// ── GET /api/v1/admin/users ──
// Listar usuarios con filtros y paginación
adminRoutes.get("/users", requireAuth, requireVerifiedEmail, requirePermission("users.read"), async (c) => {
  const { page: pageNum, limit, skip } = parsePaging(c.req.query());
  const role = c.req.query("role");
  const status = c.req.query("status");
  const search = c.req.query("q");

  const where: any = {};
  if (role) where.role = role;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return c.json(page(users, pageMeta(pageNum, limit, total)));
});

// ── POST /api/v1/admin/users/:id/suspend ──
// Suspender usuario
adminRoutes.post("/users/:id/suspend", requireAuth, requireVerifiedEmail, requirePermission("users.suspend"), async (c) => {
  const { user: admin } = c.get("auth");
  const userId = c.req.param("id");
  const body = await c.req.json();

  const schema = z.object({
    reason: z.string().max(500).optional(),
  });

  const data = schema.parse(body);

  const user = await prisma.user.update({
    where: { id: userId },
     { status: "suspended" },
  });

  await audit(prisma, {
    id: admin.id,
    name: admin.name,
    adminRole: c.get("adminRole") || "admin",
  }, {
    action: "USER_SUSPENDED",
    entityType: "user",
    entityId: userId,
    metadata: { reason: data.reason },
  });

  return c.json(ok({ message: "Usuario suspendido" }));
});

// ── POST /api/v1/admin/users/:id/block ──
// Bloquear usuario
adminRoutes.post("/users/:id/block", requireAuth, requireVerifiedEmail, requirePermission("users.block"), async (c) => {
  const { user: admin } = c.get("auth");
  const userId = c.req.param("id");
  const body = await c.req.json();

  const schema = z.object({
    reason: z.string().max(500).optional(),
  });

  const data = schema.parse(body);

  const user = await prisma.user.update({
    where: { id: userId },
     { status: "blocked" },
  });

  await audit(prisma, {
    id: admin.id,
    name: admin.name,
    adminRole: c.get("adminRole") || "admin",
  }, {
    action: "USER_BLOCKED",
    entityType: "user",
    entityId: userId,
    metadata: { reason: data.reason },
  });

  return c.json(ok({ message: "Usuario bloqueado" }));
});

// ── GET /api/v1/admin/providers ──
// Listar proveedores con filtros
adminRoutes.get("/providers", requireAuth, requireVerifiedEmail, requirePermission("providers.verify"), async (c) => {
  const { page: pageNum, limit, skip } = parsePaging(c.req.query());
  const status = c.req.query("status");

  const where: any = {};
  if (status) where.verification_status = status;

  const [providers, total] = await Promise.all([
    prisma.provider_profile.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: "desc" },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        provider_service: {
          include: { category: true },
        },
        provider_zone: {
          include: { zone: true },
        },
      },
    }),
    prisma.provider_profile.count({ where }),
  ]);

  return c.json(page(providers, pageMeta(pageNum, limit, total)));
});

// ── POST /api/v1/admin/providers/:id/approve ──
// Aprobar proveedor
adminRoutes.post("/providers/:id/approve", requireAuth, requireVerifiedEmail, requirePermission("providers.verify"), async (c) => {
  const { user: admin } = c.get("auth");
  const providerId = c.req.param("id");

  const provider = await prisma.provider_profile.update({
    where: { id: providerId },
     {
      verification_status: "verified",
    },
    include: { user: true },
  });

  // Actualizar rol del usuario a provider
  await prisma.user.update({
    where: { id: provider.user_id },
     { role: "provider" },
  });

  await audit(prisma, {
    id: admin.id,
    name: admin.name,
    adminRole: c.get("adminRole") || "admin",
  }, {
    action: "PROVIDER_APPROVED",
    entityType: "provider",
    entityId: providerId,
  });

  await prisma.provider_verification_history.create({
     {
      id: ulid(),
      provider_id: providerId,
      from_status: "pending_verification",
      to_status: "verified",
      actor_id: admin.id,
      reason: "Aprobado por administrador",
    },
  });

  return c.json(ok({ message: "Proveedor aprobado" }));
});

// ── POST /api/v1/admin/providers/:id/reject ──
// Rechazar proveedor
adminRoutes.post("/providers/:id/reject", requireAuth, requireVerifiedEmail, requirePermission("providers.verify"), async (c) => {
  const { user: admin } = c.get("auth");
  const providerId = c.req.param("id");
  const body = await c.req.json();

  const schema = z.object({
    reason: z.string().max(500),
  });

  const data = schema.parse(body);

  const provider = await prisma.provider_profile.update({
    where: { id: providerId },
     {
      verification_status: "rejected",
    },
  });

  await audit(prisma, {
    id: admin.id,
    name: admin.name,
    adminRole: c.get("adminRole") || "admin",
  }, {
    action: "PROVIDER_REJECTED",
    entityType: "provider",
    entityId: providerId,
    metadata: { reason: data.reason },
  });

  await prisma.provider_verification_history.create({
     {
      id: ulid(),
      provider_id: providerId,
      from_status: "pending_verification",
      to_status: "rejected",
      actor_id: admin.id,
      reason: data.reason,
    },
  });

  return c.json(ok({ message: "Proveedor rechazado" }));
});

// ── GET /api/v1/admin/requests ──
// Listar todas las solicitudes
adminRoutes.get("/requests", requireAuth, requireVerifiedEmail, requirePermission("requests.read"), async (c) => {
  const { page: pageNum, limit, skip } = parsePaging(c.req.query());
  const status = c.req.query("status");

  const where: any = {};
  if (status) where.status = status;

  const [requests, total] = await Promise.all([
    prisma.service_request.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: "desc" },
      include: {
        customer: {
          select: { id: true, name: true, email: true },
        },
        provider: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        category: true,
        zone: true,
      },
    }),
    prisma.service_request.count({ where }),
  ]);

  return c.json(page(requests, pageMeta(pageNum, limit, total)));
});

// ── GET /api/v1/admin/requests/:id/timeline ──
// Timeline completo de una solicitud
adminRoutes.get("/requests/:id/timeline", requireAuth, requireVerifiedEmail, requirePermission("requests.read"), async (c) => {
  const requestId = c.req.param("id");

  const request = await prisma.service_request.findUnique({
    where: { id: requestId },
    include: {
      request_status_history: {
        orderBy: { at: "asc" },
        include: {
          actor: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  });

  if (!request) throw AppError.notFound("Solicitud");

  return c.json(ok(request));
});

// ── GET /api/v1/admin/audit ──
// Logs de auditoría
adminRoutes.get("/audit", requireAuth, requireVerifiedEmail, requirePermission("audit.export"), async (c) => {
  const { page: pageNum, limit, skip } = parsePaging(c.req.query());
  const action = c.req.query("action");
  const actorId = c.req.query("actor");

  const where: any = {};
  if (action) where.action = action;
  if (actorId) where.actor_id = actorId;

  const [logs, total] = await Promise.all([
    prisma.admin_audit_log.findMany({
      where,
      skip,
      take: limit,
      orderBy: { at: "desc" },
      include: {
        actor: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.admin_audit_log.count({ where }),
  ]);

  return c.json(page(logs, pageMeta(pageNum, limit, total)));
});
