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
  const rnd = randomBytes(10); // 80 bits
  let rand = "";
  // 80 bits = 16 caracteres base32
  for (let i = 0; i < 16; i++) {
    const bitPos = i * 5;
    const byteIndex = Math.floor(bitPos / 8);
    const bitOffset = bitPos % 8;
    
    let value;
    if (bitOffset <= 3) {
      // Los 5 bits caben en un byte
      value = (rnd[byteIndex] >> (3 - bitOffset)) & 31;
    } else {
      // Los 5 bits cruzan dos bytes
      value = ((rnd[byteIndex] << (bitOffset - 3)) | (rnd[byteIndex + 1] >> (11 - bitOffset))) & 31;
    }
    
    rand += CROCKFORD[value];
  }
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

/** Código de referido para providers: 96 bits criptográficos, sin truncar. */
export function referralCode(): string {
  return `AT-${randomBytes(12).toString("hex").toUpperCase()}`;
}
