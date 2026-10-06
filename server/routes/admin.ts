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
import { AccountStatus, ProviderVerificationStatus, RequestStatus, UserRole } from "@prisma/client";
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
  const role = z.nativeEnum(UserRole).optional().parse(c.req.query("role"));
  const status = z.nativeEnum(AccountStatus).optional().parse(c.req.query("status"));
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
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
  const body = await c.req.json().catch(() => { throw AppError.validation(); });

  const schema = z.object({
    reason: z.string().max(500).optional(),
  });

  const data = schema.parse(body);

  await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: userId }, select: { role: true, admin_profile: { select: { user_id: true } } } });
    if (!target) throw AppError.notFound("Usuario");
    // Los endpoints genéricos no gestionan administradores ni el propio acceso.
    // Esto protege jerarquía y último super_admin incluso ante concurrencia.
    if (userId === admin.id || target.role === "admin" || target.admin_profile) throw AppError.forbidden("Las cuentas administrativas requieren una operación separada de gestión de administradores");
    if ((await tx.user.updateMany({ where: { id: userId, role: { not: "admin" }, admin_profile: { is: null } }, data: { status: "suspended" } })).count !== 1) throw AppError.conflict("La cuenta cambió; recarga antes de continuar");
    await audit(tx, { id: admin.id, name: admin.name, adminRole: c.get("adminRole")! }, {
      action: "USER_SUSPENDED", entityType: "user", entityId: userId, metadata: { reason: data.reason },
    });
  });

  return c.json(ok({ message: "Usuario suspendido" }));
});

// ── POST /api/v1/admin/users/:id/block ──
// Bloquear usuario
adminRoutes.post("/users/:id/block", requireAuth, requireVerifiedEmail, requirePermission("users.block"), async (c) => {
  const { user: admin } = c.get("auth");
  const userId = c.req.param("id");
  const body = await c.req.json().catch(() => { throw AppError.validation(); });

  const schema = z.object({
    reason: z.string().max(500).optional(),
  });

  const data = schema.parse(body);

  await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: userId }, select: { role: true, admin_profile: { select: { user_id: true } } } });
    if (!target) throw AppError.notFound("Usuario");
    if (userId === admin.id || target.role === "admin" || target.admin_profile) throw AppError.forbidden("Las cuentas administrativas requieren una operación separada de gestión de administradores");
    if ((await tx.user.updateMany({ where: { id: userId, role: { not: "admin" }, admin_profile: { is: null } }, data: { status: "blocked" } })).count !== 1) throw AppError.conflict("La cuenta cambió; recarga antes de continuar");
    await audit(tx, { id: admin.id, name: admin.name, adminRole: c.get("adminRole")! }, {
      action: "USER_BLOCKED", entityType: "user", entityId: userId, metadata: { reason: data.reason },
    });
  });

  return c.json(ok({ message: "Usuario bloqueado" }));
});

// ── GET /api/v1/admin/providers ──
// Listar proveedores con filtros
adminRoutes.get("/providers", requireAuth, requireVerifiedEmail, requirePermission("providers.verify"), async (c) => {
  const { page: pageNum, limit, skip } = parsePaging(c.req.query());
  const status = z.nativeEnum(ProviderVerificationStatus).optional().parse(c.req.query("status"));

  const where: any = {};
  if (status) where.verification_status = status;

  const [providers, total] = await Promise.all([
    prisma.provider_profile.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
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

  await prisma.$transaction(async (tx) => {
    const provider = await tx.provider_profile.findUnique({ where: { id: providerId }, select: { user_id: true, verification_status: true } });
    if (!provider) throw AppError.notFound("Proveedor");
    if (provider.verification_status === "verified") return; // Repetición idempotente.
    if (provider.verification_status !== "pending_verification") throw AppError.conflict("El proveedor no está pendiente de verificación");
    const updated = await tx.provider_profile.updateMany({ where: { id: providerId, verification_status: "pending_verification" }, data: { verification_status: "verified" } });
    if (updated.count !== 1) {
      if ((await tx.provider_profile.findUnique({ where: { id: providerId }, select: { verification_status: true } }))?.verification_status === "verified") return;
      throw AppError.conflict("El estado del proveedor cambió; recarga antes de continuar");
    }
    // El modo profesional es una capacidad: nunca elimina privilegios admin.
    await tx.user.updateMany({ where: { id: provider.user_id, role: { not: "admin" } }, data: { role: "provider" } });
    await audit(tx, { id: admin.id, name: admin.name, adminRole: c.get("adminRole")! }, {
      action: "PROVIDER_APPROVED", entityType: "provider", entityId: providerId,
    });
    await tx.provider_verification_history.create({ data: {
      id: ulid(), provider_id: providerId, from_status: provider.verification_status,
      to_status: "verified", actor_id: admin.id, reason: "Aprobado por administrador",
    } });
  });

  return c.json(ok({ message: "Proveedor aprobado" }));
});

// ── POST /api/v1/admin/providers/:id/reject ──
// Rechazar proveedor
adminRoutes.post("/providers/:id/reject", requireAuth, requireVerifiedEmail, requirePermission("providers.verify"), async (c) => {
  const { user: admin } = c.get("auth");
  const providerId = c.req.param("id");
  const body = await c.req.json().catch(() => { throw AppError.validation(); });

  const schema = z.object({
    reason: z.string().trim().min(1).max(500),
  });

  const data = schema.parse(body);

  await prisma.$transaction(async (tx) => {
    const provider = await tx.provider_profile.findUnique({ where: { id: providerId }, select: { verification_status: true } });
    if (!provider) throw AppError.notFound("Proveedor");
    if (provider.verification_status === "rejected") return;
    if (provider.verification_status !== "pending_verification") throw AppError.conflict("El proveedor no está pendiente de verificación");
    const updated = await tx.provider_profile.updateMany({ where: { id: providerId, verification_status: "pending_verification" }, data: { verification_status: "rejected", is_available: false } });
    if (updated.count !== 1) {
      if ((await tx.provider_profile.findUnique({ where: { id: providerId }, select: { verification_status: true } }))?.verification_status === "rejected") return;
      throw AppError.conflict("El estado del proveedor cambió; recarga antes de continuar");
    }
    await audit(tx, { id: admin.id, name: admin.name, adminRole: c.get("adminRole")! }, {
      action: "PROVIDER_REJECTED", entityType: "provider", entityId: providerId, metadata: { reason: data.reason },
    });
    await tx.provider_verification_history.create({ data: {
      id: ulid(), provider_id: providerId, from_status: provider.verification_status,
      to_status: "rejected", actor_id: admin.id, reason: data.reason,
    } });
  });

  return c.json(ok({ message: "Proveedor rechazado" }));
});

// ── GET /api/v1/admin/requests ──
// Listar todas las solicitudes
adminRoutes.get("/requests", requireAuth, requireVerifiedEmail, requirePermission("requests.read"), async (c) => {
  const { page: pageNum, limit, skip } = parsePaging(c.req.query());
  const status = z.nativeEnum(RequestStatus).optional().parse(c.req.query("status"));

  const where: any = {};
  if (status) where.status = status;

  const [requests, total] = await Promise.all([
    prisma.service_request.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
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
      orderBy: [{ at: "desc" }, { id: "desc" }],
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
