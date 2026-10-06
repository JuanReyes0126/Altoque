/** Direcciones privadas. El propietario procede siempre de Better Auth. */
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../database/prisma.js";
import { ok } from "../lib/envelope.js";
import { AppError } from "../lib/errors.js";
import { ulid } from "../lib/ids.js";
import { requireAuth, requireVerifiedEmail, type AuthEnv } from "../middleware/auth.js";

export const addressRoutes = new Hono<AuthEnv>();

// Allow-list: no relaciones de solicitudes, propietario ni coordenadas privadas.
const addressFields = {
  id: true,
  label: true,
  line: true,
  zone_id: true,
  zone: { select: { id: true, name: true, municipality: true } },
} as const;

const addressInput = z.object({
  label: z.string().trim().min(1).max(80),
  line: z.string().trim().min(1).max(500),
  zone_id: z.string().min(1).max(100),
}).strict();
const addressPatch = addressInput.partial().refine((data) => Object.keys(data).length > 0);

async function activeZone(zoneId: string) {
  const zone = await prisma.zone.findFirst({ where: { id: zoneId, is_active: true }, select: { id: true } });
  if (!zone) throw AppError.validation([{ path: "zone_id", message: "Selecciona una zona disponible" }]);
}

addressRoutes.use("*", requireAuth, requireVerifiedEmail, async (c, next) => {
  c.header("Cache-Control", "no-store");
  await next();
});

addressRoutes.get("/", async (c) => {
  const { user } = c.get("auth");
  const addresses = await prisma.address.findMany({
    where: { user_id: user.id },
    select: addressFields,
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
  });
  return c.json(ok(addresses));
});

addressRoutes.get("/:id", async (c) => {
  const { user } = c.get("auth");
  const address = await prisma.address.findFirst({
    where: { id: c.req.param("id"), user_id: user.id },
    select: addressFields,
  });
  if (!address) throw AppError.notFound("Dirección");
  return c.json(ok(address));
});

addressRoutes.post("/", async (c) => {
  const { user } = c.get("auth");
  const input = await c.req.json().catch(() => { throw AppError.validation(); });
  const data = addressInput.parse(input);
  await activeZone(data.zone_id);
  const address = await prisma.address.create({
    data: { id: ulid(), user_id: user.id, ...data },
    select: addressFields,
  });
  return c.json(ok(address), 201);
});

addressRoutes.patch("/:id", async (c) => {
  const { user } = c.get("auth");
  const input = await c.req.json().catch(() => { throw AppError.validation(); });
  const data = addressPatch.parse(input);
  if (data.zone_id !== undefined) await activeZone(data.zone_id);
  const address = await prisma.$transaction(async (tx) => {
    const where = { id: c.req.param("id"), user_id: user.id };
    const updated = await tx.address.updateMany({ where, data });
    if (updated.count !== 1) throw AppError.notFound("Dirección");
    return tx.address.findFirstOrThrow({ where, select: addressFields });
  });
  return c.json(ok(address));
});

addressRoutes.delete("/:id", async (c) => {
  const { user } = c.get("auth");
  const deleted = await prisma.address.deleteMany({
    where: { id: c.req.param("id"), user_id: user.id },
  });
  if (deleted.count !== 1) throw AppError.notFound("Dirección");
  return c.json(ok({ deleted: true }));
});
