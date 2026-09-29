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

export const providerPublicRoutes = new Hono();

// ── GET /api/v1/providers ──
// Lista pública de proveedores verificados
providerPublicRoutes.get("/", async (c) => {
  const { page: pageNum, limit, skip } = parsePaging(c.req.query());
  const categoryId = c.req.query("category");
  const zoneId = c.req.query("zone");
  const available = c.req.query("available");
  const sort = c.req.query("sort") || "created_at";

  // Construir filtro
  const where: any = {
    verification_status: "verified",
  };

  if (categoryId) {
    where.provider_service = {
      some: { category_id: categoryId },
    };
  }

  if (zoneId) {
    where.provider_zone = {
      some: { zone_id: zoneId },
    };
  }

  if (available !== undefined) {
    where.is_available = available === "true";
  }

  // Ordenamiento (solo por campos que existen en el schema)
  const orderBy: any = {
    created_at: "desc",
  };

  try {
    const [providers, total] = await Promise.all([
      prisma.provider_profile.findMany({
        where,
        skip,
        take: limit,
        orderBy,
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
            },
          },
        },
      }),
      prisma.provider_profile.count({ where }),
    ]);

    // Transformar datos para respuesta pública
    const publicProviders = providers.map((p) => {
      // Calcular rating promedio
      const ratings = p.review.map((r) => r.rating);
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : 0;

      return {
        id: p.id,
        name: p.user.name,
        image: p.user.image,
        business_name: p.business_name,
        bio: p.bio,
        years_exp: p.years_exp,
        rating: Math.round(avgRating * 10) / 10,
        reviews_count: p.review.length,
        is_available: p.is_available,
        avg_eta_min: p.avg_eta_min,
        categories: p.provider_service.map((ps) => ({
          id: ps.category.id,
          name: ps.category.name,
          icon: ps.category.icon,
        })),
        zones: p.provider_zone.map((pz) => ({
          id: pz.zone.id,
          name: pz.zone.name,
        })),
        founder_months_free: p.founder_months_free,
        created_at: p.created_at,
      };
    });

    // Si ordenamos por reviews o rating, hacerlo después de calcular
    if (sort === "reviews") {
      publicProviders.sort((a, b) => b.reviews_count - a.reviews_count);
    } else if (sort === "rating") {
      publicProviders.sort((a, b) => b.rating - a.rating);
    }

    return c.json(page(publicProviders, pageMeta(pageNum, limit, total)));
  } catch (error) {
    console.error("Error fetching providers:", error);
    throw new AppError("INTERNAL_ERROR", "Error al obtener proveedores", 500);
  }
});

// ── GET /api/v1/providers/available ──
// Lista de proveedores disponibles ahora (para "disponibles ahora" en landing)
// NOTA: Debe ir ANTES de /:id para evitar que "available" sea capturado como :id
providerPublicRoutes.get("/available", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") || "10"), 50);

  try {
    const providers = await prisma.provider_profile.findMany({
      where: {
        verification_status: "verified",
        is_available: true,
      },
      take: limit,
      orderBy: {
        created_at: "desc",
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
          take: 3, // Solo primeras 3 categorías
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
          take: 5, // Solo primeras 5 zonas
        },
        review: {
          select: {
            rating: true,
          },
        },
      },
    });

    // Transformar datos
    const availableProviders = providers.map((p) => {
      const ratings = p.review.map((r) => r.rating);
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : 0;

      return {
        id: p.id,
        name: p.user.name,
        image: p.user.image,
        business_name: p.business_name,
        rating: Math.round(avgRating * 10) / 10,
        reviews_count: p.review.length,
        avg_eta_min: p.avg_eta_min,
        categories: p.provider_service.map((ps) => ({
          id: ps.category.id,
          name: ps.category.name,
          icon: ps.category.icon,
        })),
        zones: p.provider_zone.map((pz) => ({
          id: pz.zone.id,
          name: pz.zone.name,
        })),
      };
    });

    // Ordenar por rating
    availableProviders.sort((a, b) => b.rating - a.rating);

    return c.json(ok(availableProviders));
  } catch (error) {
    console.error("Error fetching available providers:", error);
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

    // Calcular rating promedio de todas las reviews
    const allReviews = await prisma.review.findMany({
      where: { provider_id: provider.id },
      select: { rating: true },
    });

    const ratings = allReviews.map((r) => r.rating);
    const avgRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : 0;

    // Transformar para respuesta pública
    const publicProvider = {
      id: provider.id,
      name: provider.user.name,
      image: provider.user.image,
      business_name: provider.business_name,
      bio: provider.bio,
      years_exp: provider.years_exp,
      rating: Math.round(avgRating * 10) / 10,
      reviews_count: allReviews.length,
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
    console.error("Error fetching provider:", error);
    throw new AppError("INTERNAL_ERROR", "Error al obtener proveedor", 500);
  }
});

// ── GET /api/v1/providers/available ──
// Lista de proveedores disponibles ahora (para "disponibles ahora" en landing)
providerPublicRoutes.get("/available", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") || "10"), 50);

  try {
    const providers = await prisma.provider_profile.findMany({
      where: {
        verification_status: "verified",
        is_available: true,
      },
      take: limit,
      orderBy: {
        created_at: "desc",
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
          take: 3, // Solo primeras 3 categorías
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
          take: 5, // Solo primeras 5 zonas
        },
        review: {
          select: {
            rating: true,
          },
        },
      },
    });

    // Transformar datos
    const availableProviders = providers.map((p) => {
      const ratings = p.review.map((r) => r.rating);
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : 0;

      return {
        id: p.id,
        name: p.user.name,
        image: p.user.image,
        business_name: p.business_name,
        rating: Math.round(avgRating * 10) / 10,
        reviews_count: p.review.length,
        avg_eta_min: p.avg_eta_min,
        categories: p.provider_service.map((ps) => ({
          id: ps.category.id,
          name: ps.category.name,
          icon: ps.category.icon,
        })),
        zones: p.provider_zone.map((pz) => ({
          id: pz.zone.id,
          name: pz.zone.name,
        })),
      };
    });

    // Ordenar por rating
    availableProviders.sort((a, b) => b.rating - a.rating);

    return c.json(ok(availableProviders));
  } catch (error) {
    console.error("Error fetching available providers:", error);
    throw new AppError("INTERNAL_ERROR", "Error al obtener proveedores disponibles", 500);
  }
});
