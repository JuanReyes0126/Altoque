/**
 * ALTOQUE · Audit log administrativo (v1.1 §14 + Addendum)
 *
 * Append-only. TODA operación sensible pasa por aquí — es imposible
 * actuar sin registrar. El payload se sanitiza: jamás incluye
 * contraseñas, tokens ni contenido de documentos.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import type { Tx } from "../database/prisma.js";
import { ulid } from "./ids.js";
import type { AdminRole } from "./permissions.js";

export type AuditAction =
  | "PROVIDER_APPROVED"
  | "PROVIDER_REJECTED"
  | "PROVIDER_SUSPENDED"
  | "USER_SUSPENDED"
  | "USER_BLOCKED"
  | "USER_REACTIVATED"
  | "DISPUTE_RESOLVED"
  | "REQUEST_MODIFIED"
  | "REQUEST_FORCE_CANCELLED"
  | "CATEGORY_CREATED"
  | "CATEGORY_UPDATED"
  | "ADMIN_ROLE_CHANGED"
  | "DOCUMENT_REVIEWED"
  | "SETTINGS_CHANGED";

export interface AuditActor {
  id: string;
  name: string;
  adminRole: AdminRole;
}

export interface AuditInput {
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

const FORBIDDEN_METADATA_KEYS = ["password", "token", "secret", "otp", "cookie", "blob_key"];

export function sanitizeAuditMetadata(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (FORBIDDEN_METADATA_KEYS.some((key) => k.toLowerCase().replace(/[_-]/g, "").includes(key.replace(/[_-]/g, "")))) continue;
    const cleanValue = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(cleanValue);
      if (value && typeof value === "object") return sanitizeAuditMetadata(value as Record<string, unknown>);
      return value;
    };
    out[k] = cleanValue(v);
  }
  return out;
}

/**
 * Escribe el audit log. Puede participar de una transacción existente
 * (p. ej. aprobar proveedor + auditoría en el mismo COMMIT) o correr
 * sola. Fallar a escribir la auditoría NO debe silenciar la acción:
 * se relanza el error (mejor abortar la transacción que actuar sin rastro).
 */
export async function audit(db: PrismaClient | Tx, actor: AuditActor, input: AuditInput): Promise<void> {
  await db.admin_audit_log.create({
    data: {
      id: ulid(),
      actor_id: actor.id,
      actor_name: actor.name,
      actor_admin_role: actor.adminRole,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      metadata: (sanitizeAuditMetadata(input.metadata) as any) ?? Prisma.JsonNull,
      ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
    },
  });
}
