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
import type { PrismaClient } from "@prisma/client";
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
    where: { id: requestId, status: "searching", provider_id: null },
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
 * Claim completo con validaciones pre-transacción:
 *  - el provider existe y está VERIFIED (unverified no puede reclamar)
 *  - la solicitud existe y está en una categoría que el provider ofrece
 * La autorización final la da la fila: quien no cumpla el WHERE del
 * UPDATE no gana, aunque dos requests lleguen en el mismo milisegundo.
 */
export async function claimRequest(db: PrismaClient, input: { requestId: string; providerUserId: string; etaMin: number }): Promise<ClaimResult> {
  const provider = await db.provider_profile.findUnique({ where: { user_id: input.providerUserId } });
  if (!provider) throw AppError.forbidden("Perfil de proveedor no encontrado");
  if (provider.verification_status !== "verified") {
    throw new AppError("FORBIDDEN", "Solo los proveedores verificados pueden aceptar solicitudes", 403);
  }

  const req = await db.service_request.findUnique({
    where: { id: input.requestId },
    select: { id: true, category_id: true },
  });
  if (!req) throw AppError.notFound("Solicitud");

  const offers = await db.provider_service.findUnique({
    where: { provider_id_category_id: { provider_id: provider.id, category_id: req.category_id } },
  });
  if (!offers) throw AppError.forbidden("No ofreces esta categoría");

  return db.$transaction((tx) =>
    claimRequestInTx(tx, {
      requestId: input.requestId,
      providerProfileId: provider.id,
      actorUserId: input.providerUserId,
      etaMin: input.etaMin,
    }),
  );
}
