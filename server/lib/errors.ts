/**
 * ALTOQUE · Errores centralizados (F1.5)
 * Un único tipo de error de negocio + handler en server/index.ts.
 * Nunca se filtra el stack ni el detalle interno al cliente.
 */
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "EMAIL_NOT_VERIFIED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "REQUEST_ALREADY_CLAIMED"
  | "INVALID_STATE_TRANSITION"
  | "RATE_LIMITED"
  | "FILE_TOO_LARGE"
  | "FILE_TYPE_NOT_ALLOWED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  static validation(details?: unknown) {
    return new AppError("VALIDATION_ERROR", "Datos inválidos", 400, details);
  }
  static unauthenticated() {
    return new AppError("UNAUTHENTICATED", "Sesión requerida", 401);
  }
  static forbidden(msg = "Sin permisos para esta operación") {
    return new AppError("FORBIDDEN", msg, 403);
  }
  static emailNotVerified() {
    return new AppError("EMAIL_NOT_VERIFIED", "Verifica tu correo antes de continuar", 403);
  }
  static notFound(entity = "Recurso") {
    return new AppError("NOT_FOUND", `${entity} no encontrado`, 404);
  }
  static conflict(msg: string) {
    return new AppError("CONFLICT", msg, 409);
  }
  static alreadyClaimed() {
    return new AppError("REQUEST_ALREADY_CLAIMED", "Otro profesional ya tomó esta solicitud", 409);
  }
  static invalidTransition(from: string, to: string) {
    return new AppError("INVALID_STATE_TRANSITION", `Transición no permitida: ${from} → ${to}`, 409);
  }
  static rateLimited() {
    return new AppError("RATE_LIMITED", "Demasiadas solicitudes. Intenta en unos minutos.", 429);
  }
}
