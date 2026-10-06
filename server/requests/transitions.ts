import type { Prisma, RequestStatus } from "@prisma/client";
import type { Tx } from "../database/prisma.js";
import { AppError } from "../lib/errors.js";

/** El estado leído es una precondición del UPDATE, no solo de la validación previa. */
export async function transitionRequest(tx: Tx, input: {
  id: string;
  from: RequestStatus;
  to: RequestStatus;
  where?: Prisma.service_requestWhereInput;
  data?: Prisma.service_requestUpdateManyMutationInput;
}): Promise<void> {
  const changed = await tx.service_request.updateMany({
    where: { ...input.where, id: input.id, status: input.from },
    data: { ...input.data, status: input.to },
  });
  if (changed.count !== 1) throw AppError.conflict("La solicitud cambió mientras la actualizabas. Recarga e inténtalo de nuevo.");
}
