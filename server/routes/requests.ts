/**
 * ALTOQUE · Endpoints de solicitudes (F2)
 *
 * Gestión de service_request con seguridad:
 * - requireAuth + requireVerifiedEmail en todos los endpoints
 * - Ownership: el customer_id SIEMPRE viene de la sesión
 * - Estados y transiciones validados
 */
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../database/prisma.js";
import { readPageSnapshot } from "../database/read-page.js";
import { requireAuth, requireVerifiedEmail, type AuthEnv } from "../middleware/auth.js";
import { ok, page, pageMeta, parsePaging } from "../lib/envelope.js";
import { AppError } from "../lib/errors.js";
import { readJsonBody } from "../lib/json.js";
import { ulid, nextRequestCode } from "../lib/ids.js";
import { consume, LIMITS } from "../lib/ratelimit.js";
import { transitionRequest } from "../requests/transitions.js";

export const requestRoutes = new Hono<AuthEnv>();

// ── POST /api/v1/requests ──
// Crear nueva solicitud
requestRoutes.post("/", requireAuth, requireVerifiedEmail, async (c) => {
  const { user } = c.get("auth");
  const body = await readJsonBody(c.req);

  // Validación de entrada
  const schema = z.object({
    category_id: z.string().min(1),
    zone_id: z.string().min(1),
    description: z.string().trim().min(1).max(2000),
    when_type: z.enum(["now", "scheduled", "quote"]),
    scheduled_at: z.string().datetime().optional(),
    address_id: z.string().optional(),
    photos: z.array(z.object({
      blob_key: z.string().min(1).max(512),
      sort: z.number().int().min(0),
    })).max(3).optional(),
  });

  const data = schema.parse(body);

  // Rate limiting
  await consume(prisma, LIMITS.requestCreate, user.id);

  // Validar que la categoría existe y está activa
  const category = await prisma.category.findFirst({
    where: { id: data.category_id, is_active: true },
  });
  if (!category) throw AppError.notFound("Categoría");

  // Validar que la zona existe y está activa
  const zone = await prisma.zone.findFirst({
    where: { id: data.zone_id, is_active: true },
  });
  if (!zone) throw AppError.notFound("Zona");

  // Una dirección nunca concede acceso por conocer su id. También debe
  // pertenecer a la zona de la solicitud para no enviar al pro a otra zona.
  if (data.address_id) {
    const address = await prisma.address.findFirst({
      where: { id: data.address_id, user_id: user.id },
      select: { zone_id: true },
    });
    if (!address) throw AppError.notFound("Dirección");
    if (address.zone_id !== data.zone_id) {
      throw AppError.validation([{ path: "address_id", message: "La dirección pertenece a otra zona" }]);
    }
  }

  // Validar scheduled_at si when_type es "scheduled"
  if (data.when_type === "scheduled") {
    if (!data.scheduled_at) {
      throw AppError.validation([{ path: "scheduled_at", message: "Requerido cuando when_type es 'scheduled'" }]);
    }
    if (new Date(data.scheduled_at).getTime() <= Date.now()) {
      throw AppError.validation([{ path: "scheduled_at", message: "Selecciona una fecha y hora futuras" }]);
    }
  }

  // Crear solicitud en transacción
  const result = await prisma.$transaction(async (tx) => {
    if (data.photos?.length) {
      const keys = [...new Set(data.photos.map((photo) => photo.blob_key))];
      if (keys.length !== data.photos.length) throw AppError.validation([{ path: "photos", message: "No repitas la misma foto" }]);
      const files = await tx.file.findMany({
        where: { blob_key: { in: keys }, owner_id: user.id, purpose: "request_photo", visibility: "private" },
        select: { blob_key: true },
      });
      const owned = new Set(files.map((file) => file.blob_key));
      if (keys.some((key) => !owned.has(key))) {
        throw AppError.validation([{ path: "photos", message: "Las fotos deben proceder de tus propias cargas de solicitud" }]);
      }
    }
    const code = await nextRequestCode(tx);
    const id = ulid();

    const request = await tx.service_request.create({
      data: {
        id,
        code,
        customer_id: user.id,
        category_id: data.category_id,
        zone_id: data.zone_id,
        description: data.description,
        when_type: data.when_type,
        scheduled_at: data.scheduled_at ? new Date(data.scheduled_at) : null,
        address_id: data.address_id || null,
        status: "searching",
        request_photo: data.photos ? {
          create: data.photos.map((p) => ({
            id: ulid(),
            blob_key: p.blob_key,
            sort: p.sort,
          })),
        } : undefined,
        request_status_history: {
          create: {
            id: ulid(),
            from_status: null,
            to_status: "searching",
            actor_id: user.id,
            actor_kind: "customer",
            note: "Solicitud creada",
          },
        },
      },
      include: {
        category: true,
        zone: true,
        request_photo: true,
      },
    });

    return request;
  });

  return c.json(ok(result), 201);
});

// ── GET /api/v1/requests ──
// Listar solicitudes del usuario autenticado
requestRoutes.get("/", requireAuth, requireVerifiedEmail, async (c) => {
  const { user } = c.get("auth");
  const { page: pageNum, limit, skip } = parsePaging(c.req.query());

  const where = { customer_id: user.id };

  const [requests, total] = await readPageSnapshot((tx) => Promise.all([
    tx.service_request.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      include: {
        category: true,
        zone: true,
        provider: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        request_photo: {
          orderBy: { sort: "asc" },
        },
        review: true,
      },
    }),
    tx.service_request.count({ where }),
  ]));

  return c.json(page(requests, pageMeta(pageNum, limit, total)));
});

// ── GET /api/v1/requests/:id ──
// Obtener solicitud específica (con verificación de ownership)
requestRoutes.get("/:id", requireAuth, requireVerifiedEmail, async (c) => {
  const { user } = c.get("auth");
  const id = c.req.param("id");

  const request = await prisma.service_request.findUnique({
    where: { id },
    include: {
      category: true,
      zone: true,
      address: true,
      provider: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          provider_service: {
            include: { category: true },
          },
        },
      },
      request_photo: {
        orderBy: { sort: "asc" },
      },
      request_status_history: {
        orderBy: { at: "asc" },
      },
      review: true,
    },
  });

  if (!request) throw AppError.notFound("Solicitud");

  // Verificar ownership
  if (request.customer_id !== user.id) {
    throw AppError.forbidden("No tienes permiso para ver esta solicitud");
  }

  return c.json(ok(request));
});

// ── POST /api/v1/requests/:id/cancel ──
// Cancelar solicitud (solo si está en estado permitido)
requestRoutes.post("/:id/cancel", requireAuth, requireVerifiedEmail, async (c) => {
  const { user } = c.get("auth");
  const id = c.req.param("id");

  const request = await prisma.service_request.findUnique({
    where: { id },
  });

  if (!request) throw AppError.notFound("Solicitud");

  // Verificar ownership
  if (request.customer_id !== user.id) {
    throw AppError.forbidden("No tienes permiso para cancelar esta solicitud");
  }

  // Validar estado permitido para cancelación
  const allowedStates = ["searching", "accepted"];
  if (!allowedStates.includes(request.status)) {
    throw AppError.invalidTransition(request.status, "cancelled");
  }

  // Cancelar en transacción
  await prisma.$transaction(async (tx) => {
    await transitionRequest(tx, {
      id, from: request.status, to: "cancelled", where: { customer_id: user.id, provider_id: request.provider_id },
      data: { completed_at: new Date() },
    });

    await tx.request_status_history.create({
      data: {
        id: ulid(),
        request_id: id,
        from_status: request.status,
        to_status: "cancelled",
        actor_id: user.id,
        actor_kind: "customer",
        note: "Solicitud cancelada por el cliente",
      },
    });
  });

  return c.json(ok({ message: "Solicitud cancelada" }));
});

// ── POST /api/v1/requests/:id/confirm ──
// Confirmar solicitud completada
requestRoutes.post("/:id/confirm", requireAuth, requireVerifiedEmail, async (c) => {
  const { user } = c.get("auth");
  const id = c.req.param("id");

  const request = await prisma.service_request.findUnique({
    where: { id },
  });

  if (!request) throw AppError.notFound("Solicitud");

  // Verificar ownership
  if (request.customer_id !== user.id) {
    throw AppError.forbidden("No tienes permiso para confirmar esta solicitud");
  }

  // Solo puede confirmarse si está completed
  if (request.status !== "completed") {
    throw AppError.invalidTransition(request.status, "confirmed");
  }

  // Confirmar en transacción
  await prisma.$transaction(async (tx) => {
    await transitionRequest(tx, {
      id, from: "completed", to: "confirmed", where: { customer_id: user.id, provider_id: request.provider_id },
      data: { confirmed_at: new Date() },
    });

    await tx.request_status_history.create({
      data: {
        id: ulid(),
        request_id: id,
        from_status: "completed",
        to_status: "confirmed",
        actor_id: user.id,
        actor_kind: "customer",
        note: "Solicitud confirmada por el cliente",
      },
    });
  });

  return c.json(ok({ message: "Solicitud confirmada" }));
});

// ── POST /api/v1/requests/:id/review ──
// Dejar review (solo si está confirmed)
requestRoutes.post("/:id/review", requireAuth, requireVerifiedEmail, async (c) => {
  const { user } = c.get("auth");
  const id = c.req.param("id");
  const body = await readJsonBody(c.req);

  const schema = z.object({
    rating: z.number().int().min(1).max(5),
    punctuality: z.number().int().min(1).max(5).optional(),
    quality: z.number().int().min(1).max(5).optional(),
    communication: z.number().int().min(1).max(5).optional(),
    comment: z.string().max(1000).optional(),
  });

  const data = schema.parse(body);

  const request = await prisma.service_request.findUnique({
    where: { id },
    include: { review: true },
  });

  if (!request) throw AppError.notFound("Solicitud");

  // Verificar ownership
  if (request.customer_id !== user.id) {
    throw AppError.forbidden("No tienes permiso para revisar esta solicitud");
  }

  // Solo puede revisarse si está confirmed
  if (request.status !== "confirmed") {
    throw AppError.invalidTransition(request.status, "reviewed");
  }

  // Verificar que no haya review previa (UNIQUE constraint)
  if (request.review) {
    throw AppError.conflict("Ya existe una review para esta solicitud");
  }

  // Verificar que haya provider asignado
  if (!request.provider_id) {
    throw AppError.validation("No hay proveedor asignado para revisar");
  }

  // Crear review en transacción
  await prisma.$transaction(async (tx) => {
    await transitionRequest(tx, {
      id, from: "confirmed", to: "reviewed", where: { customer_id: user.id, provider_id: request.provider_id },
    });
    await tx.review.create({
      data: {
        id: ulid(),
        request_id: id,
        reviewer_id: user.id,
        provider_id: request.provider_id!, // Validado arriba (línea 325-327)
        rating: data.rating,
        punctuality: data.punctuality,
        quality: data.quality,
        communication: data.communication,
        comment: data.comment,
      },
    });

    await tx.request_status_history.create({
      data: {
        id: ulid(),
        request_id: id,
        from_status: "confirmed",
        to_status: "reviewed",
        actor_id: user.id,
        actor_kind: "customer",
        note: `Review enviada: ${data.rating} estrellas`,
      },
    });
  });

  return c.json(ok({ message: "Review enviada" }), 201);
});
