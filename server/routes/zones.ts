/** Catálogo real de zonas activas para guardar direcciones. */
import { Hono } from "hono";
import { prisma } from "../database/prisma.js";
import { ok } from "../lib/envelope.js";

export const zoneRoutes = new Hono();

zoneRoutes.get("/zones", async (c) => {
  const zones = await prisma.zone.findMany({
    where: { is_active: true },
    select: { id: true, name: true, municipality: true },
    orderBy: [{ municipality: "asc" }, { name: "asc" }, { id: "asc" }],
  });
  return c.json(ok(zones));
});
