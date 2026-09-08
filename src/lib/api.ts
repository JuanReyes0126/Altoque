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
  proById, prosByCat, rateJob, searchAll, setProAvailable, toggleFav, zoneById,
} from "./state";
import { http } from "./http";
import type { Cat, Pro, Role, Session, Zone } from "../types";

export interface ProviderFilters { catId?: string; available?: boolean; verified?: boolean; sort?: "rating" | "dist" | "eta" }

/* ── F1.8 · autenticación REAL (Better Auth + PostgreSQL) ─────────────
 * La sesión vive en una cookie HttpOnly gestionada por Better Auth.
 * El frontend NUNCA almacena tokens: solo representa lo que responde
 * el servidor. El rol proviene del backend — jamás del navegador.
 */
interface ServerUser {
  id: string;
  name: string;
  email: string;
  role?: string;
  status?: string;
  emailVerified?: boolean;
}
const toSession = (u: ServerUser): Session => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: (u.role === "provider" || u.role === "admin" ? u.role : "customer") as Role,
  status: u.status ?? "active",
  emailVerified: !!u.emailVerified,
});

interface BetterAuthSessionResponse { user: ServerUser; session: unknown }

export const authApi = {
  /** POST /api/v1/auth/sign-up/email — crea el usuario REAL en Neon.
   *  Con requireEmailVerification NO emite sesión: devuelve token de verificación. */
  signUp: (d: { name: string; email: string; password: string; phone?: string }) =>
    http<{ token?: string }>("/api/v1/auth/sign-up/email", { body: d }),

  /** POST /api/v1/auth/sign-in/email — emite la cookie de sesión. */
  signIn: async (d: { email: string; password: string }): Promise<Session> => {
    const res = await http<BetterAuthSessionResponse>("/api/v1/auth/sign-in/email", { body: d });
    return toSession(res.user);
  },

  /** GET /api/v1/auth/get-session — restauración al abrir/recargar la app. */
  getSession: async (): Promise<Session | null> => {
    const res = await http<BetterAuthSessionResponse | null>("/api/v1/auth/get-session");
    return res?.user ? toSession(res.user) : null;
  },

  /** GET /api/v1/me — fuente de verdad del perfil privado básico. */
  me: async (): Promise<Session> => {
    const res = await http<{ data: ServerUser }>("/api/v1/me");
    return toSession(res.data);
  },

  /** POST /api/v1/auth/sign-out — revoca la sesión en el servidor. */
  signOut: () => http<void>("/api/v1/auth/sign-out", { body: {}, noContent: true }),

  /** POST /api/v1/auth/send-verification-email — reenvío del enlace. */
  resendVerification: (email: string) =>
    http<unknown>("/api/v1/auth/send-verification-email", {
      body: { email, callbackURL: `${window.location.origin}/` },
    }),

  /** GET /api/v1/auth/verify-email?token=… — desde el enlace del correo
   *  (autoSignInAfterVerification emite la cookie al verificar). */
  verifyEmail: (token: string) =>
    http<unknown>(`/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`),
};

export const api = {
  /* ── auth real (F1.8) ── */
  auth: authApi,

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
    create: async (d: {
      categoryId: string;
      zoneId: string;
      description: string;
      when: "now" | "later" | "quote";
      scheduledAt?: string;
    }) => {
      const res = await http<{
        data: {
          request: {
            id: string;
            code: string;
            status: string;
            created_at: string;
          };
        };
      }>("/api/v1/requests", { body: d });

      return res.data.request;
    },
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
