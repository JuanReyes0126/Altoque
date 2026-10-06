import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../src/lib/api";
import { ApiHttpError } from "../../src/lib/http";

afterEach(() => { vi.unstubAllGlobals(); });

describe("Transporte HTTP del panel profesional", () => {
  it("un inbox 200 vacío resuelve con datos vacíos", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [], meta: { total: 0 } }), { status: 200 })));
    await expect(api.providers.getInbox()).resolves.toMatchObject({ data: [], meta: { total: 0 } });
  });

  it("un fallo de API permanece como error con status y código originales", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "Perfil pendiente" } }), { status: 403 })));
    await expect(api.providers.getInbox()).rejects.toMatchObject({ name: "ApiHttpError", status: 403, code: "FORBIDDEN" });
  });

  it("un fallo de conexión no se convierte en inbox vacío", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(api.providers.getInbox()).rejects.toBeInstanceOf(ApiHttpError);
  });

  it("disponibilidad usa PATCH y devuelve el valor confirmado por el servidor", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { is_available: true } }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await expect(api.providers.setAvailability(true)).resolves.toEqual({ is_available: true });
    expect(fetch).toHaveBeenCalledWith("/api/v1/provider/availability", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ is_available: true }), credentials: "include" }));
  });

  it("claim y transición de estado usan las rutas profesionales montadas", async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ data: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await api.providers.claim("request-one", 15);
    await api.providers.updateStatus("request-one", "on_the_way");
    expect(fetch).toHaveBeenNthCalledWith(1, "/api/v1/provider/requests/request-one/claim", expect.objectContaining({ method: "POST" }));
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/v1/provider/requests/request-one/status", expect.objectContaining({ method: "POST" }));
  });

  it("getMe y active-job conservan las respuestas persistidas del backend", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: "provider-one", is_available: true } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { job: null } }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await expect(api.providers.getMe()).resolves.toMatchObject({ id: "provider-one", is_available: true });
    await expect(api.providers.getActiveJob()).resolves.toEqual({ data: { job: null } });
  });
});
