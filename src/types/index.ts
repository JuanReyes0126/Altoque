/* ════════════════════════════════════════════════════════════════
   ALTOQUE · Tipos compartidos (src/types)
   Espejo de las entidades futuras de PostgreSQL (F1).
   Durante F0 las pantallas consumen estas formas desde el mock
   (lib/state) — en F2+ vendrán del /server con la misma forma.
   ════════════════════════════════════════════════════════════════ */

/* ── roles y sesión ── */
export type Role = "customer" | "provider" | "admin";
/** RBAC administrativo — preparado desde el día 1 (solo SUPER_ADMIN gestiona roles admin). */
export type AdminRole = "support" | "moderator" | "admin" | "super_admin";

/**
 * Sesión REAL (F1.8): proviene exclusivamente del servidor
 * (GET /api/v1/auth/get-session + GET /api/v1/me). Nunca de localStorage.
 * El rol lo define el backend — el frontend solo lo representa.
 */
export interface Session {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: string;
  emailVerified: boolean;
  adminRole?: AdminRole;
}

/* ── navegación interna del cliente ── */
export type Tab = "home" | "explore" | "jobs" | "favs" | "me";
export type View =
  | { t: "home" } | { t: "explore" } | { t: "results"; catId: string }
  | { t: "pro"; id: string } | { t: "request"; catId?: string; proId?: string }
  | { t: "track"; jobId: string };

/* ── catálogo ── */
export interface Zone { id: string; name: string; km: number }
export interface Cat { id: string; name: string; icon: string; group: string; base: number }

/* ── solicitudes ── */
export type When = "now" | "later" | "quote";
/**
 * F0 (mock): searching | accepted | enroute | arrived | started | done | quoted
 * F1 (BD) : searching | accepted | on_the_way | arrived | in_progress | completed |
 *           confirmed | reviewed | cancelled | expired | disputed
 * El mapeo 1:1 se aplica al conectar el /server (capa de servicio única).
 */
export type JobStatus = "searching" | "accepted" | "enroute" | "arrived" | "started" | "done" | "quoted";

export interface Job {
  id: string; catId: string; problem: string; photos: number[]; when: When; zoneId: string; note: string;
  proId?: string; status: JobStatus; etaMin?: number; etaLeft?: number; scheduledFor?: string;
  rating?: number; reviewText?: string; createdAt: number; manual?: boolean;
}

/* ── proveedores ── */
export interface Review { name: string; rating: number; text: string; date: string; ago: string }

export interface Pro {
  id: string; name: string; cats: string[]; tagline: string; rating: number; reviews: number; jobs: number;
  km: number; eta: number; available: boolean; price: number; years: number; respMin: number;
  face: { f: number; q: number }; tint: string; bio: string; zones: string[]; portfolio: number[];
  verified: { id: boolean; phone: boolean; pro: boolean }; reviewsList: Review[]; founder?: boolean;
}

export interface Incoming {
  id: string; jobId?: string; client: string; clientRating: number; catId: string; zoneId: string; km: number;
  problem: string; photos: number[]; expiresIn: number; price: number;
}

export interface ProJob {
  id: string; jobId?: string; client: string; clientRating: number; catId: string; zoneId: string; km: number;
  problem: string; photos: number[]; status: JobStatus; etaMin: number; price: number;
}

/* ── estado global (F0: mock en memoria · F1: troceado por endpoints reales) ── */
export interface State {
  role: Role; zoneId: string; favorites: string[]; jobs: Job[]; inbox: Incoming[];
  proActive: ProJob | null; proAvailable: boolean; toastMsg: string | null; toastId: number;
  proStats: { today: number; earnings: number; week: number[]; acceptRate: number };
  session: Session | null;
}

/* ── contrato de API (forma de las respuestas del /server en F1+) ── */
export interface Paginated<T> { data: T[]; meta: { total: number; page: number; pages: number } }
export interface ListParams { page?: number; limit?: number; q?: string; sort?: string; dir?: "asc" | "desc" }
export interface ApiError { code: string; message: string }
