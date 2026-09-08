import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../database/prisma.js";
import { requireAuth, requireVerifiedEmail, type AuthEnv } from "../middleware/auth.js";
import { ok } from "../lib/envelope.js";
import { nextRequestCode, ulid } from "../lib/ids.js";

export const requestRoutes = new Hono<AuthEnv>();

const createRequestSchema = z.object({
  categoryId: z.string().min(1),
  zoneId: z.string().min(1),
  description: z.string().trim().min(1).max(2000),
  when: z.enum(["now", "later", "quote"]),
  scheduledAt: z.string().datetime().optional(),
});

requestRoutes.post(
  "/requests",
  requireAuth,
  requireVerifiedEmail,
  async (c) => {
    const { user } = c.get("auth");
    const body = createRequestSchema.parse(await c.req.json());

    const whenType =
      body.when === "later"
        ? "scheduled"
        : body.when;

    const scheduledAt =
      body.when === "later" && body.scheduledAt
        ? new Date(body.scheduledAt)
        : null;

    const request = await prisma.$transaction(async (tx) => {
      const code = await nextRequestCode(tx);

      return tx.service_request.create({
        data: {
          id: ulid(),
          code,
          customer_id: user.id,
          category_id: body.categoryId,
          zone_id: body.zoneId,
          description: body.description,
          when_type: whenType,
          scheduled_at: scheduledAt,
          status: "searching",
        },
        select: {
          id: true,
          code: true,
          status: true,
          created_at: true,
        },
      });
    });

    return c.json(ok({ request }), 201);
  },
);
