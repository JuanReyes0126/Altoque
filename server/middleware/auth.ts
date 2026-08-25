/**
 * ALTOQUE · Middleware de autorización (F1.3)
 *
 * requireAuth → requireVerifiedEmail → requireRole → requirePermission
 *
 * La fuente de verdad es SIEMPRE la sesión de Better Auth (cookie
 * HttpOnly) + PostgreSQL. localStorage, guards de frontend, query
 * params o roles en el body NUNCA conceden privilegios (son solo UX).
 */
import { createMiddleware } from "hono/factory";
import { auth } from "../auth/auth";
import { prisma } from "../database/prisma";
import { AppError } from "../lib/errors";
import { hasAdminPermission, type AdminRole, type Permission } from "../lib/permissions";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "customer" | "provider" | "admin";
  status: string;
  emailVerified: boolean;
}

export interface AuthSessionCtx {
  session: { id: string; userId: string; expiresAt: Date };
  user: AuthUser;
}

export type AuthEnv = {
  Variables: {
    auth: AuthSessionCtx;
    adminRole: AdminRole | null;
    requestId: string;
  };
};

/** Sesión válida (Better Auth ya rechaza expiradas y revocadas). */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!result) throw AppError.unauthenticated();

  const user = result.user as unknown as AuthUser;
  if (user.status !== "active") throw AppError.forbidden("Cuenta suspendida o bloqueada");

  c.set("auth", { session: result.session, user } as AuthSessionCtx);
  await next();
});

/** Email verificado obligatorio para operaciones protegidas. */
export const requireVerifiedEmail = createMiddleware<AuthEnv>(async (c, next) => {
  const { user } = c.get("auth");
  if (!user.emailVerified) throw AppError.emailNotVerified();
  await next();
});

/** Rol de cuenta (customer | provider | admin). */
export function requireRole(...roles: Array<AuthUser["role"]>) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const { user } = c.get("auth");
    if (!roles.includes(user.role)) throw AppError.forbidden();
    await next();
  });
}

/**
 * Permiso de la matriz RBAC (solo cuentas admin). Carga admin_profile
 * una sola vez por request. Sin fila admin_profile ⇒ sin permisos,
 * aunque user.role diga 'admin'.
 */
export function requirePermission(permission: Permission) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const { user } = c.get("auth");
    if (user.role !== "admin") throw AppError.forbidden();

    let adminRole = c.get("adminRole");
    if (adminRole === undefined || adminRole === null) {
      const profile = await prisma.admin_profile.findUnique({ where: { user_id: user.id } });
      adminRole = (profile?.admin_role as AdminRole | undefined) ?? null;
      c.set("adminRole", adminRole);
    }
    if (!adminRole || !hasAdminPermission(adminRole, permission)) throw AppError.forbidden();
    await next();
  });
}

/** Propiedad del recurso (anti-IDOR): el id técnico valida, nunca el código público. */
export function assertOwnership(resourceOwnerId: string, userId: string) {
  if (resourceOwnerId !== userId) throw AppError.forbidden();
}
