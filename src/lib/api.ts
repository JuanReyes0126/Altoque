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
  CATS, PROS, ZONES, catById, getState,
  proById, prosByCat, searchAll, setProAvailable, toggleFav, zoneById,
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
    list: async (): Promise<Cat[]> => {
      const res = await http<{ data: { categories: Cat[] } }>("/api/v1/categories");
      return res.data.categories;
    },
    get: catById, // fallback local
  },
  zones: {
    list: (): Zone[] => ZONES, // por ahora mock, no hay endpoint
    get: zoneById,
  },

  /* ── catálogo de proveedores ── F2: GET /pros?cat&zone&available&verified&sort&page&limit */
  prospects: {
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

  /* ── solicitudes (cliente) ── F2: POST /requests · GET /requests · GET /requests/:id · POST /requests/:id/{cancel,confirm,review} */
  requests: {
    /** POST /api/v1/requests - Crear nueva solicitud */
    create: async (data: {
      category_id: string;
      zone_id: string;
      description: string;
      when_type: "now" | "scheduled" | "quote";
      scheduled_at?: string;
      address_id?: string;
      photos?: Array<{ blob_key: string; sort: number }>;
    }) => {
      const res = await http<{ data: any }>("/api/v1/requests", { body: data });
      return res.data;
    },

    /** GET /api/v1/requests - Listar solicitudes del usuario */
    list: async (params?: { page?: number; limit?: number }) => {
      const query = new URLSearchParams();
      if (params?.page) query.set("page", String(params.page));
      if (params?.limit) query.set("limit", String(params.limit));
      const qs = query.toString();
      const res = await http<{ data: any[]; meta: any }>(`/api/v1/requests${qs ? "?" + qs : ""}`);
      return res;
    },

    /** GET /api/v1/requests/:id - Obtener solicitud específica */
    getById: async (id: string) => {
      const res = await http<{ data: any }>(`/api/v1/requests/${id}`);
      return res.data;
    },

    /** POST /api/v1/requests/:id/cancel - Cancelar solicitud */
    cancel: async (id: string) => {
      const res = await http<{ data: any }>(`/api/v1/requests/${id}/cancel`, { body: {} });
      return res.data;
    },

    /** POST /api/v1/requests/:id/confirm - Confirmar solicitud completada */
    confirm: async (id: string) => {
      const res = await http<{ data: any }>(`/api/v1/requests/${id}/confirm`, { body: {} });
      return res.data;
    },

    /** POST /api/v1/requests/:id/review - Dejar review */
    review: async (id: string, data: {
      rating: number;
      punctuality?: number;
      quality?: number;
      communication?: number;
      comment?: string;
    }) => {
      const res = await http<{ data: any }>(`/api/v1/requests/${id}/review`, { body: data });
      return res.data;
    },

    /** Helper para compatibilidad con UI existente */
    byId: (id: string) => getState().jobs.find((j) => j.id === id),
    all: () => getState().jobs,
  },

  /* ── uploads ── F2: POST /uploads/request-photo */
  uploads: {
    /** POST /api/v1/uploads/request-photo - Subir foto para solicitud */
    requestPhoto: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await http<{ data: { id: string; blob_key: string } }>("/api/v1/uploads/request-photo", {
        method: "POST",
        body: formData,
      });
      return res.data;
    },
  },

  /* ── proveedor ── F3: endpoints reales */
  providers: {
    /** GET /api/v1/provider/me - Obtener perfil del proveedor */
    getMe: async () => {
      const res = await http<{ data: any }>("/api/v1/provider/me");
      return res.data;
    },

    /** POST /api/v1/provider/me - Crear perfil de proveedor */
    create: async (data: {
      business_name?: string;
      bio?: string;
      years_exp?: number;
      category_ids: string[];
      zone_ids: string[];
    }) => {
      const res = await http<{ data: any }>("/api/v1/provider/me", { body: data });
      return res.data;
    },

    /** PATCH /api/v1/provider/availability - Cambiar disponibilidad */
    setAvailability: async (is_available: boolean) => {
      const res = await http<{ data: any }>("/api/v1/provider/availability", {
        body: { is_available },
      });
      return res.data;
    },

    /** GET /api/v1/provider/inbox - Solicitudes compatibles */
    getInbox: async (params?: { page?: number; limit?: number }) => {
      const query = new URLSearchParams();
      if (params?.page) query.set("page", String(params.page));
      if (params?.limit) query.set("limit", String(params.limit));
      const qs = query.toString();
      const res = await http<{ data: any[]; meta: any }>(`/api/v1/provider/inbox${qs ? "?" + qs : ""}`);
      return res;
    },

    /** POST /api/v1/requests/:id/claim - Reclamar solicitud */
    claim: async (requestId: string, eta_min: number) => {
      const res = await http<{ data: any }>(`/api/v1/requests/${requestId}/claim`, {
        body: { eta_min },
      });
      return res.data;
    },

    /** POST /api/v1/requests/:id/status - Actualizar estado del trabajo */
    updateStatus: async (requestId: string, status: string, note?: string) => {
      const res = await http<{ data: any }>(`/api/v1/requests/${requestId}/status`, {
        body: { status, note },
      });
      return res.data;
    },

    /** GET /api/v1/provider/earnings - Estadísticas de ingresos */
    getEarnings: async (range: "day" | "week" | "month" = "week") => {
      const res = await http<{ data: any }>(`/api/v1/provider/earnings?range=${range}`);
      return res.data;
    },

    /** GET /api/v1/provider/active-job - Trabajo activo actual */
    getActiveJob: async () => {
      const res = await http<{ data: { job: any } }>("/api/v1/provider/active-job");
      return res;
    },
  },

  /* ── admin ── F6: endpoints reales */
  admin: {
    /** GET /api/v1/admin/metrics - Dashboard con métricas reales */
    getMetrics: async () => {
      const res = await http<{ data: any }>("/api/v1/admin/metrics");
      return res.data;
    },

    /** GET /api/v1/admin/users - Listar usuarios */
    getUsers: async (params?: { page?: number; limit?: number; role?: string; status?: string; q?: string }) => {
      const query = new URLSearchParams();
      if (params?.page) query.set("page", String(params.page));
      if (params?.limit) query.set("limit", String(params.limit));
      if (params?.role) query.set("role", params.role);
      if (params?.status) query.set("status", params.status);
      if (params?.q) query.set("q", params.q);
      const qs = query.toString();
      const res = await http<{ data: any[]; meta: any }>(`/api/v1/admin/users${qs ? "?" + qs : ""}`);
      return res;
    },

    /** POST /api/v1/admin/users/:id/suspend - Suspender usuario */
    suspendUser: async (userId: string, reason?: string) => {
      const res = await http<{ data: any }>(`/api/v1/admin/users/${userId}/suspend`, {
        body: { reason },
      });
      return res.data;
    },

    /** POST /api/v1/admin/users/:id/block - Bloquear usuario */
    blockUser: async (userId: string, reason?: string) => {
      const res = await http<{ data: any }>(`/api/v1/admin/users/${userId}/block`, {
        body: { reason },
      });
      return res.data;
    },

    /** GET /api/v1/admin/providers - Listar proveedores */
    getProviders: async (params?: { page?: number; limit?: number; status?: string }) => {
      const query = new URLSearchParams();
      if (params?.page) query.set("page", String(params.page));
      if (params?.limit) query.set("limit", String(params.limit));
      if (params?.status) query.set("status", params.status);
      const qs = query.toString();
      const res = await http<{ data: any[]; meta: any }>(`/api/v1/admin/providers${qs ? "?" + qs : ""}`);
      return res;
    },

    /** POST /api/v1/admin/providers/:id/approve - Aprobar proveedor */
    approveProvider: async (providerId: string) => {
      const res = await http<{ data: any }>(`/api/v1/admin/providers/${providerId}/approve`, {
        body: {},
      });
      return res.data;
    },

    /** POST /api/v1/admin/providers/:id/reject - Rechazar proveedor */
    rejectProvider: async (providerId: string, reason: string) => {
      const res = await http<{ data: any }>(`/api/v1/admin/providers/${providerId}/reject`, {
        body: { reason },
      });
      return res.data;
    },

    /** GET /api/v1/admin/requests - Listar solicitudes */
    getRequests: async (params?: { page?: number; limit?: number; status?: string }) => {
      const query = new URLSearchParams();
      if (params?.page) query.set("page", String(params.page));
      if (params?.limit) query.set("limit", String(params.limit));
      if (params?.status) query.set("status", params.status);
      const qs = query.toString();
      const res = await http<{ data: any[]; meta: any }>(`/api/v1/admin/requests${qs ? "?" + qs : ""}`);
      return res;
    },

    /** GET /api/v1/admin/requests/:id/timeline - Timeline de solicitud */
    getRequestTimeline: async (requestId: string) => {
      const res = await http<{ data: any }>(`/api/v1/admin/requests/${requestId}/timeline`);
      return res.data;
    },

    /** GET /api/v1/admin/disputes - Listar disputas */
    getDisputes: async (params?: { page?: number; limit?: number; status?: string }) => {
      const query = new URLSearchParams();
      if (params?.page) query.set("page", String(params.page));
      if (params?.limit) query.set("limit", String(params.limit));
      if (params?.status) query.set("status", params.status);
      const qs = query.toString();
      const res = await http<{ data: any[]; meta: any }>(`/api/v1/disputes/admin/all${qs ? "?" + qs : ""}`);
      return res;
    },

    /** GET /api/v1/admin/audit - Logs de auditoría */
    getAuditLogs: async (params?: { page?: number; limit?: number; action?: string; actor?: string }) => {
      const query = new URLSearchParams();
      if (params?.page) query.set("page", String(params.page));
      if (params?.limit) query.set("limit", String(params.limit));
      if (params?.action) query.set("action", params.action);
      if (params?.actor) query.set("actor", params.actor);
      const qs = query.toString();
      const res = await http<{ data: any[]; meta: any }>(`/api/v1/admin/audit${qs ? "?" + qs : ""}`);
      return res;
    },

    /** POST /api/v1/disputes/:id/resolve - Resolver disputa */
    resolveDispute: async (disputeId: string, status: "resolved_customer" | "resolved_provider", resolution: string) => {
      const res = await http<{ data: any }>(`/api/v1/disputes/${disputeId}/resolve`, {
        body: { status, resolution },
      });
      return res.data;
    },
  },

  /* ── disputas ── F5: endpoints para cliente/proveedor */
  disputes: {
    /** POST /api/v1/disputes - Crear disputa */
    create: async (requestId: string, reason: string) => {
      const res = await http<{ data: any }>("/api/v1/disputes", {
        body: { request_id: requestId, reason },
      });
      return res.data;
    },

    /** GET /api/v1/disputes - Listar disputas propias */
    list: async (params?: { page?: number; limit?: number }) => {
      const query = new URLSearchParams();
      if (params?.page) query.set("page", String(params.page));
      if (params?.limit) query.set("limit", String(params.limit));
      const qs = query.toString();
      const res = await http<{ data: any[]; meta: any }>(`/api/v1/disputes${qs ? "?" + qs : ""}`);
      return res;
    },

    /** GET /api/v1/disputes/:id - Obtener disputa específica */
    getById: async (id: string) => {
      const res = await http<{ data: any }>(`/api/v1/disputes/${id}`);
      return res.data;
    },
  },
};
