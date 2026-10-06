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
  "databaseurl", "directdatabaseurl", "resendapikey", "blobreadwritetoken", "blobprivatereadwritetoken",
  "betterauthsecret", "testdatabaseurl",
]);

/** Better Auth incluye el token de reset como segmento de ruta. */
export function redactLogPath(path: string): string {
  return path
    .replace(/(\/api\/v1\/auth\/reset-password\/)[^/?#\s]+/gi, "$1[REDACTED]")
    .replace(/([?&](?:token|password|secret|api[_-]?key)=)[^&#\s]+/gi, "$1[REDACTED]");
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue);
  if (value instanceof Error) return { name: value.name };
  if (value && typeof value === "object") return redact(value as Record<string, unknown>);
  if (typeof value === "string") {
    return redactLogPath(value)
      .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, "[CONNECTION_URL_REDACTED]")
      .replace(/([?&](?:token|password|secret|api[_-]?key)=)[^&#\s]+/gi, "$1[REDACTED]");
  }
  return value;
}

export function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (REDACT_KEYS.has(k.toLowerCase().replace(/[_-]/g, ""))) {
      out[k] = "[REDACTED]";
    } else out[k] = redactValue(v);
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
