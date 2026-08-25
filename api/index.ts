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
// Node ESM no permite imports de directorio ("../server") ni sin extensión:
// se apunta al entrypoint explícito con extensión .js (TS lo resuelve a
// server/index.ts y Vercel emite server/index.js).
import { app } from "../server/index.js";

export default handle(app);
