/**
 * ALTOQUE · Identificadores (Addendum §3)
 *
 *  - IDs internos: ULID (26 chars, no secuenciales para el cliente,
 *    ordenables por tiempo para índices). Se generan en la aplicación.
 *  - service_request.code: humano ALT-2026-000001, generado por un
 *    contador atómico en BD (request_code_seq). El código NUNCA concede
 *    acceso: el servidor valida siempre ownership/permisos por id.
 */
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { Tx } from "../database/prisma.js";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** ULID: 48-bit timestamp + 80 bits aleatorios (Crockford base32). */
export function ulid(): string {
  let ts = Date.now();
  let time = "";
  for (let i = 9; i >= 0; i--) {
    time = CROCKFORD[ts % 32] + time;
    ts = Math.floor(ts / 32);
  }
  const rnd = randomBytes(10);
  let rand = "";
  for (const b of rnd) rand += CROCKFORD[b % 32];
  return time + rand;
}

/**
 * Código humano de solicitud. Atómico: UPDATE … RETURNING sobre la fila
 * única del contador. Debe llamarse DENTRO de la transacción que crea
 * la solicitud para que código y registro nazcan juntos.
 */
export async function nextRequestCode(db: PrismaClient | Tx, year = new Date().getFullYear()): Promise<string> {
  const rows = await db.$queryRaw<{ last_value: bigint }[]>`
    UPDATE request_code_seq
       SET last_value = last_value + 1
     WHERE id = 1
    RETURNING last_value
  `;
  if (rows.length === 0) throw new Error("request_code_seq no inicializada (ejecuta el seed)");
  const n = Number(rows[0].last_value);
  return `ALT-${year}-${String(n).padStart(6, "0")}`;
}

/** Código de referido para providers (6 chars, legible). */
export function referralCode(): string {
  const bytes = randomBytes(4);
  return ("AT-" + bytes.toString("hex").slice(0, 6)).toUpperCase();
}
