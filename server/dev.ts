/**
 * ALTOQUE · Runner local del API (F1)
 *
 *   npx tsx watch server/dev.ts
 *
 * Corre el API en http://localhost:8787. El frontend (Vite, :3000)
 * apunta aquí en desarrollo local mediante VITE_API_URL (se conecta
 * en F2; en producción todo comparte origen y no hay CORS).
 */
import { serve } from "@hono/node-server";
import { app } from "./index.js";
import { log } from "./lib/logger.js";

const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port }, (info) => {
  log.info("altoque api escuchando", { url: `http://localhost:${info.port}`, api: "/api/v1" });
});
