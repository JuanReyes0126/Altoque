/**
 * ALTOQUE · Claim atómico de solicitudes (v1.1 §12 + Addendum §2)
 *
 * BEGIN
 *   conditional UPDATE service_request  (status='searching' AND provider_id IS NULL)
 *   ├─ 0 filas  → ROLLBACK implícito (nada se tocó) → 409 REQUEST_ALREADY_CLAIMED
 *   └─ 1 fila   → INSERT request_status_history
 *                 INSERT notification (cliente)
 * COMMIT
 *
 * Todo dentro de UN `$transaction` interactivo — soportado porque el
 * runtime usa el PrismaClient estándar contra el pooler de Neon en modo
 * transacción (Addendum §2), no el driver HTTP.
 *
 * El cuerpo transaccional (`claimRequestInTx`) está separado para que
 * el test de atomicidad pueda inyectar fallos y verificar el ROLLBACK.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import type { Tx } from "../database/prisma.js";
import { AppError } from "../lib/errors.js";
import { ulid } from "../lib/ids.js";

export interface ClaimArgs {
  requestId: string;
  /** provider_profile.id — FK de service_request.provider_id */
  providerProfileId: string;
  /** user.id del provider — actor en el history */
  actorUserId: string;
  etaMin: number;
}

export interface ClaimResult {
  requestId: string;
  code: string;
  status: "accepted";
}

export async function claimRequestInTx(tx: PrismaClient | Tx, args: ClaimArgs): Promise<ClaimResult> {
  const { requestId, providerProfileId, actorUserId, etaMin } = args;

  // UPDATE condicional: la única "puerta" de asignación.
  const claimed = await tx.service_request.updateMany({
    where: { id: requestId, status: "searching", provider_id: null, customer_id: { not: actorUserId } },
    data: { status: "accepted", provider_id: providerProfileId, eta_min: etaMin },
  });
  if (claimed.count === 0) {
    // Otro provider ganó la carrera, o la solicitud ya no está searching.
    throw AppError.alreadyClaimed();
  }

  const req = await tx.service_request.findUniqueOrThrow({
    where: { id: requestId },
    select: { customer_id: true, code: true },
  });

  // Append-only, en la MISMA transacción.
  await tx.request_status_history.create({
    data: {
      id: ulid(),
      request_id: requestId,
      from_status: "searching",
      to_status: "accepted",
      actor_id: actorUserId,
      actor_kind: "provider",
      note: `ETA ${etaMin} min`,
    },
  });

  // Notificación al cliente, en la MISMA transacción.
  await tx.notification.create({
    data: {
      id: ulid(),
      user_id: req.customer_id,
      kind: "request_accepted",
      title: "¡Tu profesional aceptó!",
      body: "Tu solicitud fue aceptada. Sigue el estado en tiempo real.",
      meta: { requestId, code: req.code, etaMin },
    },
  });

  return { requestId, code: req.code, status: "accepted" };
}

/**
 * Claim completo con validaciones y bloqueos de elegibilidad en la misma transacción:
 *  - el provider existe y está VERIFIED (unverified no puede reclamar)
 *  - la solicitud existe, pertenece a otro cliente y coincide con categoría/zona
 * La autorización final la da la fila: quien no cumpla el WHERE del
 * UPDATE no gana, aunque dos requests lleguen en el mismo milisegundo.
 */
export async function claimRequest(db: PrismaClient, input: { requestId: string; providerUserId: string; etaMin: number }): Promise<ClaimResult> {
  // La disponibilidad expresa recepción de solicitudes; no cambia la capacidad
  // de aceptar una ya visible. Categoría, zona y aprobación sí son requisitos.
  try {
    return await db.$transaction(async (tx) => {
      // Orden profile → user → service → zone, compatible con aprobación admin.
      // FOR SHARE, no KEY SHARE: UPDATE/DELETE de elegibilidad espera al COMMIT.
      const [provider] = await tx.$queryRaw<{ id: string; verification_status: string }[]>`
        SELECT id, verification_status FROM provider_profile WHERE user_id = ${input.providerUserId} FOR SHARE
      `;
      if (!provider) throw AppError.forbidden("Perfil de proveedor no encontrado");
      if (provider.verification_status !== "verified") {
        throw AppError.forbidden("Solo los proveedores verificados pueden aceptar solicitudes");
      }
      const [actor] = await tx.$queryRaw<{ status: string; emailVerified: boolean }[]>`
        SELECT status, "emailVerified" FROM "user" WHERE id = ${input.providerUserId} FOR SHARE
      `;
      if (!actor || actor.status !== "active" || !actor.emailVerified) {
        throw AppError.forbidden("La cuenta no puede aceptar solicitudes");
      }

      const req = await tx.service_request.findUnique({
        where: { id: input.requestId },
        select: { id: true, category_id: true, zone_id: true, customer_id: true },
      });
      if (!req) throw AppError.notFound("Solicitud");
      if (req.customer_id === input.providerUserId) throw AppError.forbidden("No puedes aceptar tu propia solicitud");

      const offers = await tx.$queryRaw<{ provider_id: string }[]>`
        SELECT provider_id FROM provider_service
        WHERE provider_id = ${provider.id} AND category_id = ${req.category_id} FOR SHARE
      `;
      if (!offers.length) throw AppError.forbidden("No ofreces esta categoría");
      const zones = await tx.$queryRaw<{ provider_id: string }[]>`
        SELECT provider_id FROM provider_zone
        WHERE provider_id = ${provider.id} AND zone_id = ${req.zone_id} FOR SHARE
      `;
      if (!zones.length) throw AppError.forbidden("No trabajas en esta zona");

      return claimRequestInTx(tx, {
        requestId: input.requestId, providerProfileId: provider.id, actorUserId: input.providerUserId, etaMin: input.etaMin,
      });
    });
  } catch (error) {
    const target = error instanceof Prisma.PrismaClientKnownRequestError ? error.meta?.target : undefined;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" &&
      ((Array.isArray(target) && target.length === 1 && target[0] === "provider_id") || target === "service_request_provider_active_unique")) {
      throw AppError.conflict("Ya tienes un trabajo activo. Complétalo antes de aceptar otro.");
    }
    throw error;
  }
}
