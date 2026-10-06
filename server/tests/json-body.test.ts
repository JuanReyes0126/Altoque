/** A20: la sintaxis inválida es 400; fallos de lectura o del servidor conservan su causa. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../lib/errors.js";
import { readJsonBody } from "../lib/json.js";

describe("A20 · lectura JSON común", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(["", " \n\t", "{", '{"value":1,}', "{'value':1}", '"unterminated'])
    ("rechaza JSON inválido con un error de validación: %j", async (body) => {
      await expect(readJsonBody({ text: async () => body })).rejects.toMatchObject({
        name: "AppError", status: 400, code: "VALIDATION_ERROR",
        details: [{ path: "body", message: "El cuerpo debe contener JSON válido" }],
      });
    });

  it.each([
    { body: '{"value":1}', value: { value: 1 } },
    { body: "[1,2]", value: [1, 2] },
    { body: "null", value: null },
    { body: "false", value: false },
    { body: "0", value: 0 },
    { body: '"value"', value: "value" },
  ])("deja la validación semántica a cada ruta: $body", async ({ body, value }) => {
    await expect(readJsonBody({ text: async () => body })).resolves.toEqual(value);
  });

  it.each([new TypeError("BODY_READ_FAILURE"), new SyntaxError("BODY_READ_FAILURE")])
    ("no clasifica un fallo de lectura como JSON inválido: %s", async (error) => {
      await expect(readJsonBody({ text: async () => { throw error; } })).rejects.toBe(error);
    });

  it("no convierte otros errores de parseo en 400", async () => {
    const error = new TypeError("PARSER_INTERNAL_FAILURE");
    vi.spyOn(JSON, "parse").mockImplementationOnce(() => { throw error; });
    await expect(readJsonBody({ text: async () => "{}" })).rejects.toBe(error);
  });

  it("el error público no conserva el body ni el detalle de SyntaxError", async () => {
    const marker = "a20-private-body-fixture";
    const error = await readJsonBody({ text: async () => `{"note":"${marker}",` })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AppError);
    expect(JSON.stringify(error)).not.toContain(marker);
    expect((error as AppError).message).toBe("Datos inválidos");
    expect(error).not.toHaveProperty("cause");
  });
});
