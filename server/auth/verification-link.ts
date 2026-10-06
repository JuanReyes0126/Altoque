/** Vercel SSO consume `token` al regresar; Better Auth conserva su contrato interno. */
import { AppError } from "../lib/errors.js";

const VERIFICATION_PATH = "/api/v1/auth/verify-email";
const DELIVERY_TOKEN = "verification_token";

function renameParameter(url: URL, from: string, to: string): void {
  url.search = new URLSearchParams([...url.searchParams].map(([key, value]) =>
    [key === from ? to : key, value],
  )).toString();
}

/** Sólo cambia el nombre de transporte; el JWT sigue perteneciendo a Better Auth. */
export function verificationDeliveryURL(value: string): string {
  let url: URL;
  try { url = new URL(value); }
  catch { throw AppError.validation(); }
  const tokens = url.searchParams.getAll("token");
  if ((url.protocol !== "https:" && url.protocol !== "http:")
    || url.pathname !== VERIFICATION_PATH || tokens.length !== 1 || !tokens[0].trim()
    || url.searchParams.has(DELIVERY_TOKEN)) {
    throw AppError.validation();
  }
  renameParameter(url, "token", DELIVERY_TOKEN);
  return url.toString();
}

/** Restaurar el parámetro oficial sólo al llegar a la ruta GET de verificación. */
export function verificationRequest(request: Request): Request {
  if (request.method !== "GET") return request;
  const url = new URL(request.url);
  if (url.pathname !== VERIFICATION_PATH) return request;
  const aliases = url.searchParams.getAll(DELIVERY_TOKEN);
  // Los requests existentes no se reconstruyen ni vuelven a envolver su body.
  if (aliases.length === 0) return request;
  if (aliases.length !== 1 || url.searchParams.has("token") || !aliases[0].trim()) {
    throw AppError.validation();
  }
  renameParameter(url, DELIVERY_TOKEN, "token");
  return new Request(url, request);
}
