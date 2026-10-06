import { afterEach, describe, expect, it, vi } from "vitest";
import { http } from "../../src/lib/http";
import { api } from "../../src/lib/api";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("HTTP del navegador", () => {
  it("envía uploads como multipart con boundary del navegador", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: "photo", blob_key: "owned-photo" } }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const file = new File([new Uint8Array([255, 216, 255])], "photo.jpg", { type: "image/jpeg" });
    expect(await api.uploads.requestPhoto(file)).toEqual({ id: "photo", blob_key: "owned-photo" });
    const options = fetchMock.mock.calls[0][1];
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get("file")).toBe(file);
    expect(options.headers).toBeUndefined();
    expect(options.credentials).toBe("include");
  });

  it("mantiene el cuerpo y content-type de JSON normal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await http("/fixture", { body: { available: false } });
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ "Content-Type": "application/json" });
    expect(fetchMock.mock.calls[0][1].body).toBe('{"available":false}');
  });

  it("HTML exitoso no se interpreta como respuesta vacía exitosa", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>proxy failure</html>", { status: 200 })));
    await expect(http("/fixture")).rejects.toMatchObject({ code: "INVALID_RESPONSE", status: 200 });
  });

  it("errores con null no rompen el parser de errores", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("null", { status: 500 })));
    await expect(http("/fixture")).rejects.toMatchObject({ code: "ERROR", status: 500 });
  });

  it("fallo de red se convierte en error legible sin detalles de transporte", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("transport-private-detail")));
    await expect(http("/fixture")).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 0 });
    await expect(http("/fixture")).rejects.not.toThrow("transport-private-detail");
  });
});
