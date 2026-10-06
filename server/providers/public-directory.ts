import { Prisma } from "@prisma/client";
import { prisma } from "../database/prisma.js";

interface DirectoryOptions {
  category?: string;
  zone?: string;
  available?: boolean;
  sort: string;
  limit: number;
  skip: number;
  compact?: boolean;
}

interface RankedProvider { id: string; rating: number; reviews_count: number }

/** PostgreSQL calcula el ranking global antes de LIMIT/OFFSET. */
export async function publicDirectory(options: DirectoryOptions) {
  const { category, zone, available, sort, limit, skip, compact } = options;
  const where: Prisma.provider_profileWhereInput = {
    verification_status: "verified",
    user: { status: "active", emailVerified: true },
    ...(category !== undefined ? { provider_service: { some: { category_id: category } } } : {}),
    ...(zone !== undefined ? { provider_zone: { some: { zone_id: zone } } } : {}),
    ...(available !== undefined ? { is_available: available } : {}),
  };
  // Solo fragmentos constantes. Los filtros y límites son parámetros, nunca SQL libre.
  const order = sort === "rating"
    ? Prisma.sql`rating DESC, reviews_count DESC, p.created_at DESC, p.id ASC`
    : sort === "reviews"
      ? Prisma.sql`reviews_count DESC, rating DESC, p.created_at DESC, p.id ASC`
      : Prisma.sql`p.created_at DESC, p.id ASC`;
  const filters = [Prisma.sql`p.verification_status = 'verified'`, Prisma.sql`u.status = 'active'`, Prisma.sql`u."emailVerified" = true`];
  if (category !== undefined) filters.push(Prisma.sql`EXISTS (SELECT 1 FROM provider_service s WHERE s.provider_id = p.id AND s.category_id = ${category})`);
  if (zone !== undefined) filters.push(Prisma.sql`EXISTS (SELECT 1 FROM provider_zone z WHERE z.provider_id = p.id AND z.zone_id = ${zone})`);
  if (available !== undefined) filters.push(Prisma.sql`p.is_available = ${available}`);

  // La página, su metadata y los perfiles pertenecen al mismo snapshot de lectura.
  return prisma.$transaction(async (tx) => {
    const [ranking, total] = await Promise.all([
      tx.$queryRaw<RankedProvider[]>(Prisma.sql`
        SELECT p.id, COALESCE(AVG(r.rating), 0)::double precision AS rating,
          COUNT(r.id)::integer AS reviews_count
        FROM provider_profile p
        JOIN "user" u ON u.id = p.user_id
        LEFT JOIN review r ON r.provider_id = p.id
        WHERE ${Prisma.join(filters, " AND ")}
        GROUP BY p.id, p.created_at
        ORDER BY ${order}
        LIMIT ${limit} OFFSET ${skip}
      `),
      tx.provider_profile.count({ where }),
    ]);
    const profiles = ranking.length ? await tx.provider_profile.findMany({
      where: { ...where, id: { in: ranking.map((row) => row.id) } },
      select: {
        id: true, business_name: true, bio: true, years_exp: true,
        is_available: true, avg_eta_min: true, founder_months_free: true, created_at: true,
        user: { select: { name: true, image: true } },
        provider_service: {
          ...(compact ? { take: 3 } : {}),
          select: { category: { select: { id: true, name: true, icon: true } } },
        },
        provider_zone: {
          ...(compact ? { take: 5 } : {}),
          select: { zone: { select: { id: true, name: true } } },
        },
      },
    }) : [];
    const byId = new Map(profiles.map((profile) => [profile.id, profile]));
    return {
      total,
      // Solo hidrata los IDs ya ordenados/paginados en SQL; no recalcula ni ordena ranking.
      providers: ranking.map((rank) => {
        const profile = byId.get(rank.id);
        if (!profile) throw new Error("PUBLIC_DIRECTORY_SNAPSHOT_MISMATCH");
        return { ...profile, rating: Math.round(rank.rating * 10) / 10, reviews_count: rank.reviews_count };
      }),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
