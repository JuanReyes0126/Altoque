/**
 * ALTOQUE · RBAC centralizado (v1.1 §10-11 + Addendum §3)
 *
 * La matriz vive AQUÍ y en ningún otro lugar. El servidor la aplica en
 * cada endpoint (server/middleware/auth.ts). El frontend solo oculta UI.
 *
 * Modelo de doble capacidad:
 *   cuenta (user.role ∈ customer | provider | admin)
 *     ├── capacidad customer: siempre
 *     ├── capacidad provider: gobierna provider_profile.verification_status
 *     └── admin: user.role='admin' + admin_profile.admin_role (la matriz)
 *
 * admin_role es gestionado SOLO por SUPER_ADMIN (acción auditada).
 */
export type AdminRole = "support" | "moderator" | "admin" | "super_admin";

export type Permission =
  // soporte
  | "users.read"
  | "requests.read"
  | "reports.read"
  // moderación
  | "reviews.moderate"
  | "disputes.resolve"
  | "providers.verify"
  // administración
  | "users.suspend"
  | "users.block"
  | "categories.manage"
  | "operation.manage"
  // super admin
  | "admins.manage"
  | "finance.read"
  | "audit.export"
  | "system.configure";

const SUPPORT: Permission[] = ["users.read", "requests.read", "reports.read"];

const MODERATOR: Permission[] = [
  ...SUPPORT,
  "reviews.moderate",
  "disputes.resolve",
  "providers.verify",
];

const ADMIN: Permission[] = [
  ...MODERATOR,
  "users.suspend",
  "users.block",
  "categories.manage",
  "operation.manage",
];

const SUPER_ADMIN: Permission[] = [
  ...ADMIN,
  "admins.manage",
  "finance.read",
  "audit.export",
  "system.configure",
];

export const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, ReadonlySet<Permission>> = {
  support: new Set(SUPPORT),
  moderator: new Set(MODERATOR),
  admin: new Set(ADMIN),
  super_admin: new Set(SUPER_ADMIN),
};

export function hasAdminPermission(role: AdminRole, permission: Permission): boolean {
  return ADMIN_ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/** Operaciones que exigen sesión fresca / reautenticación (v1.1 §9). */
export const SENSITIVE_OPERATIONS: Permission[] = ["users.block", "admins.manage", "system.configure"];
