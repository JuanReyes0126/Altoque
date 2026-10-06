/**
 * ALTOQUE · Endpoints de proveedores públicos (F2)
 *
 * Provee datos públicos de proveedores verificados para la landing y
 * búsqueda de clientes.
 *
 * Seguridad:
 * - Solo proveedores con verification_status = 'verified'
 * - No expone datos privados (email, teléfono, etc.)
 * - Solo información pública necesaria para el cliente
 */
import { Hono } from "hono";
import { prisma } from "../database/prisma.js";
import { ok, page, pageMeta, parsePaging } from "../lib/envelope.js";
import { AppError } from "../lib/errors.js";
import { publicDirectory } from "../providers/public-directory.js";

export const providerPublicRoutes = new Hono();

// ── GET /api/v1/providers ──
providerPublicRoutes.get("/", async (c) => {
  const { page: pageNum, limit, skip } = parsePaging(c.req.query());
  const category = c.req.query("category") || undefined;
  const zone = c.req.query("zone") || undefined;
  const availability = c.req.query("available");
  try {
    const { providers, total } = await publicDirectory({
      category, zone, available: availability === undefined ? undefined : availability === "true",
      sort: c.req.query("sort") || "created_at", limit, skip,
    });
    const data = providers.map((p) => ({
      id: p.id, name: p.user.name, image: p.user.image, business_name: p.business_name,
      bio: p.bio, years_exp: p.years_exp, rating: p.rating, reviews_count: p.reviews_count,
      is_available: p.is_available, avg_eta_min: p.avg_eta_min,
      categories: p.provider_service.map((item) => item.category),
      zones: p.provider_zone.map((item) => item.zone),
      founder_months_free: p.founder_months_free, created_at: p.created_at,
    }));
    return c.json(page(data, pageMeta(pageNum, limit, total)));
  } catch {
    throw new AppError("INTERNAL_ERROR", "Error al obtener proveedores", 500);
  }
});

// ── GET /api/v1/providers/available ──
// Antes de /:id; ranking global incluso cuando limit es pequeño.
providerPublicRoutes.get("/available", async (c) => {
  const { limit } = parsePaging(c.req.query(), 10, 50);
  try {
    const { providers } = await publicDirectory({ available: true, sort: "rating", limit, skip: 0, compact: true });
    return c.json(ok(providers.map((p) => ({
      id: p.id, name: p.user.name, image: p.user.image, business_name: p.business_name,
      rating: p.rating, reviews_count: p.reviews_count, avg_eta_min: p.avg_eta_min,
      categories: p.provider_service.map((item) => item.category),
      zones: p.provider_zone.map((item) => item.zone),
    }))));
  } catch {
    throw new AppError("INTERNAL_ERROR", "Error al obtener proveedores disponibles", 500);
  }
});

// ── GET /api/v1/providers/:id ──
// Detalle público de un proveedor específico
providerPublicRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const provider = await prisma.provider_profile.findUnique({
      where: {
        id,
        verification_status: "verified",
        user: { status: "active", emailVerified: true },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        provider_service: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                icon: true,
              },
            },
          },
        },
        provider_zone: {
          include: {
            zone: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        review: {
          select: {
            rating: true,
            comment: true,
            created_at: true,
            reviewer: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            created_at: "desc",
          },
          take: 10, // Últimas 10 reviews
        },
      },
    });

    if (!provider) {
      throw AppError.notFound("Proveedor");
    }

    // PostgreSQL devuelve un único agregado, sin transferir todo el historial.
    const ratingSummary = await prisma.review.aggregate({
      where: { provider_id: provider.id },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const avgRating = ratingSummary._avg.rating ?? 0;

    // Transformar para respuesta pública
    const publicProvider = {
      id: provider.id,
      name: provider.user.name,
      image: provider.user.image,
      business_name: provider.business_name,
      bio: provider.bio,
      years_exp: provider.years_exp,
      rating: Math.round(avgRating * 10) / 10,
      reviews_count: ratingSummary._count._all,
      is_available: provider.is_available,
      avg_eta_min: provider.avg_eta_min,
      categories: provider.provider_service.map((ps) => ({
        id: ps.category.id,
        name: ps.category.name,
        icon: ps.category.icon,
      })),
      zones: provider.provider_zone.map((pz) => ({
        id: pz.zone.id,
        name: pz.zone.name,
      })),
      founder_months_free: provider.founder_months_free,
      recent_reviews: provider.review.map((r) => ({
        rating: r.rating,
        comment: r.comment,
        reviewer_name: r.reviewer.name,
        created_at: r.created_at,
      })),
      created_at: provider.created_at,
    };

    return c.json(ok(publicProvider));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("INTERNAL_ERROR", "Error al obtener proveedor", 500);
  }
});
