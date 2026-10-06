import { AppError } from "./errors.js";

/** Solo la sintaxis JSON inválida es un error de validación; leer el body puede fallar por otras causas. */
export async function readJsonBody(request: { text(): Promise<string> }): Promise<unknown> {
  const text = await request.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw AppError.validation([{ path: "body", message: "El cuerpo debe contener JSON válido" }]);
    }
    throw error;
  }
}
