/**
 * ALTOQUE · Vercel Function (F1.7)
 *
 * vercel.json reescribe /api/v1/* → /api (esta función). El frontend y
 * el API comparten origen, así las cookies HttpOnly/SameSite=Lax y el
 * chequeo de Origen funcionan sin CORS (v1.1 §18).
 *
 * Runtime Node (no Edge): el PrismaClient estándar lo requiere.
 */
import { handle } from "@hono/node-server/vercel";
import { app } from "../server";

export default handle(app);
