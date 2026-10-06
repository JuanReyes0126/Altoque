import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogState, PublicProviderCard } from "../../src/features/client/Home";
import { ProviderDetails } from "../../src/features/client/Profile";
import { RequestSummary, requestStatusLabel, terminalRequest } from "../../src/features/client/Requests";
import { RequestWizard, scheduledTime } from "../../src/features/client/RequestWizard";
import { api, type PublicProvider } from "../../src/lib/api";
import { profileApi } from "../../src/lib/profile-api";

const noOp = () => {};
const categoryId = "01JBF5W8K11P2ZA0E9TY4PC8XR";
const zoneId = "40de3591-2824-472b-917a-9be86ad3252e";
const provider: PublicProvider = {
  id: "01JBF5W8K11P2ZA0E9TY4PC8XS", name: "Marina López", image: null, business_name: null,
  rating: 0, reviews_count: 0, avg_eta_min: null,
  categories: [{ id: categoryId, name: "Servicio del catálogo real", icon: "wrench" }],
  zones: [{ id: zoneId, name: "Zona del catálogo real" }],
};

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("Cliente · contratos de catálogo sin fixtures visuales", () => {
  it("la tarjeta admite el DTO compacto disponible sin face, precio, distancia ni status de mock", () => {
    vi.spyOn(api.prospects, "get").mockImplementation(() => { throw new Error("MOCK_MUST_NOT_BE_USED"); });
    const html = renderToStaticMarkup(createElement(PublicProviderCard, { provider, onOpen: noOp, onRequest: noOp }));
    expect(html).toContain("Marina López");
    expect(html).toContain("Servicio del catálogo real");
    expect(html).toContain("Zona del catálogo real");
    expect(html).toContain("Aún sin reseñas");
    expect(html).not.toContain("4.9");
    expect(html).not.toContain("background-image");
    expect(html).not.toContain("Fuera de línea");
  });

  it("el detalle usa datos reales, estados vacíos y no promete asignación directa", () => {
    const html = renderToStaticMarkup(createElement(ProviderDetails, { provider: { ...provider, is_available: false }, onRequest: noOp }));
    expect(html).toContain("Fuera de línea");
    expect(html).toContain("Aún no hay reseñas");
    expect(html).toContain("La asignación se confirma cuando un profesional de tu zona acepta la solicitud.");
    expect(html).not.toContain("RD$");
  });

  it("comentarios y biografía del servidor se representan como texto seguro", () => {
    const html = renderToStaticMarkup(createElement(ProviderDetails, { provider: {
      ...provider, bio: "<script>fixture()</script>", recent_reviews: [{ rating: 4, comment: "<img src=x onerror=fixture()>", reviewer_name: "Cliente real", created_at: "2026-01-01T12:00:00Z" }],
    }, onRequest: noOp }));
    expect(html).toContain("&lt;script&gt;fixture()&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
  });

  it("catálogo vacío es estado vacío, un fallo es alerta y una carga no es ninguno", () => {
    const render = (loading: boolean, error: string) => renderToStaticMarkup(createElement(CatalogState, { loading, error, empty: true, onRetry: noOp, children: "Contenido" }));
    expect(render(false, "")).toContain("No hay resultados disponibles por ahora");
    expect(render(false, "")).not.toContain('role="alert"');
    expect(render(false, "Fallo real")).toContain('role="alert"');
    expect(render(false, "Fallo real")).not.toContain("No hay resultados disponibles");
    expect(render(true, "")).toContain("Cargando servicios");
    expect(render(true, "")).not.toContain("No hay resultados disponibles");
  });

  it("catálogo y zonas conservan identificadores opacos del servidor", async () => {
    const catalog = [{ id: categoryId, name: "Servicio único", icon: "wrench", group_name: "Grupo servidor" }];
    const zones = [{ id: zoneId, name: "Zona única", municipality: "Municipio servidor" }];
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { categories: catalog } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: zones }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await expect(api.categories.list()).resolves.toEqual(catalog);
    await expect(profileApi.zones()).resolves.toEqual(zones);
    expect(fetch).toHaveBeenNthCalledWith(1, "/api/v1/categories", expect.objectContaining({ method: "GET" }));
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/v1/zones", expect.objectContaining({ method: "GET" }));
  });
});

describe("Cliente · solicitudes del backend", () => {
  it.each([
    ["searching", "Buscando profesional", false], ["accepted", "Aceptada", false], ["on_the_way", "En camino", false],
    ["arrived", "Profesional llegó", false], ["in_progress", "Servicio en curso", false],
    ["completed", "Completada · por confirmar", true], ["confirmed", "Confirmada · por valorar", true],
    ["reviewed", "Valorada", true], ["cancelled", "Cancelada", true], ["expired", "Expirada", true],
  ] as const)("%s tiene etiqueta explícita y se agrupa correctamente", (status, label, terminal) => {
    expect(requestStatusLabel(status)).toBe(label);
    expect(terminalRequest(status)).toBe(terminal);
    const html = renderToStaticMarkup(createElement(RequestSummary, {
      request: { id: "opaque-request", code: "ALT-2026-123456", category_id: categoryId, zone_id: zoneId, category: { name: "Categoría servidor" }, zone: { name: "Zona servidor" }, description: "Descripción persistida", status }, onOpen: noOp,
    }));
    expect(html).toContain(label);
    expect(html).toContain("Categoría servidor");
    expect(html).toContain("Zona servidor");
    expect(html).toContain("ALT-2026-123456");
  });

  it("un estado futuro no inventa un servicio completado", () => {
    expect(requestStatusLabel("unknown-future-status")).toBe("Estado pendiente de actualización");
    expect(terminalRequest("unknown-future-status")).toBe(false);
  });

  it("crear conserva category/zone/address/archivo reales y no solicita asignación directa", async () => {
    const payload = {
      category_id: categoryId, zone_id: zoneId, address_id: "01JBF5W8K11P2ZA0E9TY4PC8XT",
      description: "Problema descrito por el cliente", when_type: "scheduled" as const, scheduled_at: "2030-01-01T15:00:00.000Z",
      photos: [{ blob_key: "request-photos/fixture-user/fixture-photo.jpg", sort: 0 }],
    };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: "opaque-request-id", ...payload, status: "searching" } }), { status: 201 }));
    vi.stubGlobal("fetch", fetch);
    await expect(api.requests.create(payload)).resolves.toMatchObject({ id: "opaque-request-id", status: "searching" });
    expect(fetch).toHaveBeenCalledWith("/api/v1/requests", expect.objectContaining({ method: "POST", credentials: "include", body: JSON.stringify(payload) }));
    expect(JSON.parse(fetch.mock.calls[0][1].body)).not.toHaveProperty("provider_id");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).not.toHaveProperty("customer_id");
  });

  it("el wizard empieza cargando el catálogo, sin asumir un slug de los mocks", () => {
    const html = renderToStaticMarkup(createElement(RequestWizard, { catId: categoryId, proId: provider.id, go: noOp }));
    expect(html).toContain("Cargando servicios y zonas");
    expect(html).toContain("no reserva automáticamente un profesional concreto");
    expect(html).not.toContain("Carlos");
    expect(html).not.toContain("Cerros de Gurabo");
  });

  it("la programación distingue fechas inválidas/pasadas de una fecha futura", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
    expect(scheduledTime("invalid")).toBeUndefined();
    expect(scheduledTime("2026-10-05T12:00:00Z")).toBeUndefined();
    expect(scheduledTime("2026-10-07T12:00:00Z")).toBe("2026-10-07T12:00:00.000Z");
  });
});
