/**
 * ALTOQUE · Vercel Function (F1.7 — F1.8 fix)
 *
 * vercel.json reescribe /api/v1/* → /api (esta función). El frontend y
 * el API comparten origen, así las cookies HttpOnly/SameSite=Lax y el
 * chequeo de Origen funcionan sin CORS (v1.1 §18).
 *
 * Runtime Node (no Edge): el PrismaClient estándar lo requiere.
 *
 * FIX (F1.8): se usa el adaptador OFICIAL `hono/vercel` (patrón
 * Web-standard). Su `handle` es la identidad `(app) => (req) =>
 * app.fetch(req)`: exporta el fetch de Hono como `(Request) => Response`.
 * Bajo este patrón el runtime de Vercel entrega el Request con el cuerpo
 * YA buferado, a diferencia de `@hono/node-server/vercel`, que construye
 * un stream vivo sobre el socket y provocaba que `request.json()` quedara
 * esperando un EOF que nunca llegaba (FUNCTION_INVOCATION_TIMEOUT).
 *
 * Node ESM no permite imports de directorio ("../server") ni sin extensión:
 * se apunta al entrypoint explícito con extensión .js (TS lo resuelve a
 * server/index.ts y Vercel emite server/index.js).
 */
import { handle } from "hono/vercel";
import { app } from "../server/index.js";

export default handle(app);
