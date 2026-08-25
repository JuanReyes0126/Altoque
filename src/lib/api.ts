/* ════════════════════════════════════════════════════════════════
   ALTOQUE · Frontera UI ↔ datos (src/lib/api)

   Este módulo es EL ÚNICO punto por el que las pantallas deberían
   hablar con el mundo de los datos.

   F0 (hoy)   : implementaciones mock que delegan en lib/state.
   F2/F3/F4   : cada cuerpo se sustituye por un fetch() al /server
                con la MISMA firma — las pantallas no se tocan.
   Convención : { data, meta:{total,page,pages} } para listas,
                { error:{code,message} } para fallos (F1).
   ════════════════════════════════════════════════════════════════ */
import {
  CATS, PROS, ZONES, acceptIncoming, advanceJob, advanceProJob, catById, createJob, getState,
  proById, prosByCat, rateJob, searchAll, setProAvailable, signIn, signOut, toggleFav, zoneById,
} from "./state";
import type { Cat, Pro, Zone } from "../types";

export interface ProviderFilters { catId?: string; available?: boolean; verified?: boolean; sort?: "rating" | "dist" | "eta" }

export const api = {
  /* ── auth ── F1: POST /auth/login · /auth/register · /auth/logout (JWT httpOnly + refresh) */
  auth: {
    signIn,   // (name, role) → Session
    signOut,  // () → void
  },

  /* ── catálogo ── F2: GET /categories · GET /zones (cacheables, raramente cambian) */
  categories: {
    list: (): Cat[] => CATS,
    get: catById,
  },
  zones: {
    list: (): Zone[] => ZONES,
    get: zoneById,
  },

  /* ── proveedores ── F2: GET /pros?cat&zone&available&verified&sort&page&limit */
  providers: {
    list: (f: ProviderFilters = {}): Pro[] => {
      let list = f.catId ? prosByCat(f.catId) : PROS;
      if (f.available) list = list.filter((p) => p.available);
      if (f.verified) list = list.filter((p) => p.verified.pro);
      const sort = f.sort ?? "rating";
      return [...list].sort((a, b) =>
        sort === "dist" ? a.km - b.km : sort === "eta" ? a.eta - b.eta : b.rating - a.rating || b.reviews - a.reviews,
      );
    },
    get: proById,                       // GET /pros/:id
    search: searchAll,                  // GET /search?q=
    favorites: { toggle: toggleFav },   // POST /favorites/:id · DELETE /favorites/:id
  },

  /* ── solicitudes (cliente) ── F2: POST /requests · GET /requests?scope · POST /requests/:id/{cancel,confirm,review} */
  requests: {
    create: createJob,   // POST /requests  → { id }
    advance: advanceJob, // F2: el servidor empuja estados (SSE) — este helper queda para la demo
    review: rateJob,     // POST /requests/:id/review (UNIQUE(request_id) en BD: 1 review por trabajo)
    byId: (id: string) => getState().jobs.find((j) => j.id === id),
    all: () => getState().jobs,
  },

  /* ── proveedor ── F3: GET /provider/inbox · POST /requests/:id/claim (atómico en BD) */
  provider: {
    inbox: () => getState().inbox,
    claim: acceptIncoming,      // UPDATE ... WHERE status='searching' AND provider_id IS NULL
    advance: advanceProJob,     // POST /requests/:id/status (solo transición válida)
    availability: setProAvailable, // PATCH /provider/availability
    stats: () => getState().proStats,
  },

  /* ── admin ── F4: todo desde PostgreSQL real + audit log obligatorio por mutación */
  admin: {
    // GET /admin/metrics — en F0 devuelve la forma esperada; en F4, datos reales
    metrics: () => ({
      users: 12482, providers: 1204, providersVerified: 968, requestsToday: 342,
      completedToday: 287, pendingProviders: 12, openDisputes: 4, avgRating: 4.82,
    }),
    // GET /admin/audit?action=&actor=&from=&to= — append-only, export solo para SUPER_ADMIN
  },
};
