/**
 * ALTOQUE · Categorías (F1.4)
 * GET /api/v1/categories — datos públicos (landing + wizard del cliente).
 * Las categorías viven en PostgreSQL y las administra el admin (F4);
 * nada está hardcodeado en el servidor.
 */
import { Hono } from "hono";
import { prisma } from "../database/prisma.js";
import { ok } from "../lib/envelope.js";

export const categoryRoutes = new Hono();

categoryRoutes.get("/categories", async (c) => {
  const cats = await prisma.category.findMany({
    where: { is_active: true },
    orderBy: [{ sort: "asc" }, { name: "asc" }],
    select: { id: true, name: true, icon: true, group_name: true },
  });
  return c.json(ok({ categories: cats }));
});
