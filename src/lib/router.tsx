/* ════════════════════════════════════════════════════════════════
   ALTOQUE · Enrutamiento (src/lib/router)
   Rutas, mapa View→path y guards por rol.
   IMPORTANTE: los guards son SOLO UX. La autorización real vive en
   /server (sesión + rol + permiso por endpoint) a partir de F1.
   ════════════════════════════════════════════════════════════════ */
import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useApp } from "./state";
import type { Role, Tab, View } from "../types";

export const PATHS = {
  home: "/",
  providerLanding: "/proveedores",
  app: "/app",
  pro: "/pro",
  admin: "/admin",
} as const;

export const tabPath = (t: Tab): string =>
  ({ home: "/app", explore: "/app/explorar", jobs: "/app/solicitudes", favs: "/app/favoritos", me: "/app/perfil" })[t];

/** Convierte una View interna en su ruta real (usada por `go` en todas las pantallas). */
export const viewToPath = (v: View): string => {
  switch (v.t) {
    case "home": return "/app";
    case "explore": return "/app/explorar";
    case "results": return `/app/servicios/${v.catId}`;
    case "pro": return `/app/profesional/${v.id}`;
    case "request": {
      const q = new URLSearchParams();
      if (v.catId) q.set("cat", v.catId);
      if (v.proId) q.set("pro", v.proId);
      const s = q.toString();
      return `/app/solicitar${s ? "?" + s : ""}`;
    }
    case "track": return `/app/solicitud/${v.jobId}`;
  }
};

export const roleHome = (role: Role): string =>
  role === "provider" ? PATHS.pro : role === "admin" ? PATHS.admin : PATHS.app;

/**
 * Guard de ruta por rol.
 * Sin sesión → landing pública (F1: redirigirá a /auth/login).
 * Rol equivocado → el home del rol propio (nunca una pantalla ajena).
 */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactElement }) {
  const { session } = useApp();
  if (!session) return <Navigate to={PATHS.home} replace />;
  if (!roles.includes(session.role)) return <Navigate to={roleHome(session.role)} replace />;
  return children;
}
