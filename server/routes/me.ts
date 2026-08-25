/**
 * ALTOQUE · Perfil de la sesión (F1.4)
 * GET /api/v1/me — proyección segura del usuario autenticado.
 * Serializer con allow-list explícita: jamás salen campos de account
 * (password), tokens ni datos de otras tablas.
 */
import { Hono } from "hono";
import { requireAuth, requireVerifiedEmail, type AuthEnv } from "../middleware/auth";
import { ok } from "../lib/envelope";

export const meRoutes = new Hono<AuthEnv>();

meRoutes.get("/me", requireAuth, requireVerifiedEmail, (c) => {
  const { user } = c.get("auth");
  return c.json(
    ok({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
    }),
  );
});
