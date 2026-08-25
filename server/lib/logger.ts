/**
 * ALTOQUE · Logger estructurado y sanitizado (F1.5)
 *
 * Minimización estricta — NUNCA se registran: contraseñas, cookies,
 * session tokens, verification/reset tokens, OTPs, contenido de
 * documentos, direcciones completas ni coordenadas.
 * El audit log administrativo conserva lo necesario para investigación
 * (server/lib/audit.ts) — es un canal distinto y privilegiado.
 */
export interface LogEntry {
  ts: string;
  level: "info" | "warn" | "error";
  msg: string;
  requestId?: string;
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  userId?: string; // opaco: id técnico, jamás email/teléfono
  [k: string]: unknown;
}

const REDACT_KEYS = new Set([
  "password", "token", "cookie", "authorization", "secret", "otp",
  "accesstoken", "refreshtoken", "idtoken", "sessiontoken", "apikey",
]);

export function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (REDACT_KEYS.has(k.toLowerCase())) {
      out[k] = "[REDACTED]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = redact(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function write(level: LogEntry["level"], msg: string, ctx?: Record<string, unknown>) {
  const entry: LogEntry = { ts: new Date().toISOString(), level, msg, ...(ctx ? redact(ctx) : {}) };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (msg: string, ctx?: Record<string, unknown>) => write("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => write("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => write("error", msg, ctx),
};
