import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../src/lib/api";
import { AdminPageView, AdminPagination } from "../../src/features/admin/AdminPagination";
import { ADMIN_PAGE_LIMIT, boundedAdminPage, startAdminPageRequest, validateAdminPage, type AdminPage, type AdminPageMeta } from "../../src/features/admin/admin-pagination";

const meta: AdminPageMeta = { page: 2, limit: 20, total: 43, pages: 3 };
const props = { page: 2, meta, rowCount: 20, loading: false, error: "", label: "usuarios", onPage: () => {} };
const button = (html: string, label: string) => html.match(new RegExp(`<button[^>]*>${label}</button>`))?.[0] ?? "";

afterEach(() => vi.unstubAllGlobals());

describe("A18 · navegación y estados administrativos", () => {
  it("muestra rango real, total y páginas con anterior y siguiente habilitados", () => {
    const html = renderToStaticMarkup(createElement(AdminPagination, props));
    expect(html).toContain("21–40 de 43 · Página 2 de 3");
    expect(html).toContain('aria-label="Páginas de usuarios"');
    expect(button(html, "Anterior")).not.toContain("disabled");
    expect(button(html, "Siguiente")).not.toContain("disabled");
  });

  it("primera, última y página única respetan los límites sin ocultar controles", () => {
    const first = renderToStaticMarkup(createElement(AdminPagination, { ...props, page: 1, meta: { ...meta, page: 1 } }));
    expect(button(first, "Anterior")).toContain("disabled");
    expect(button(first, "Siguiente")).not.toContain("disabled");
    const last = renderToStaticMarkup(createElement(AdminPagination, { ...props, page: 3, rowCount: 3, meta: { ...meta, page: 3 } }));
    expect(last).toContain("41–43 de 43 · Página 3 de 3");
    expect(button(last, "Siguiente")).toContain("disabled");
    const only = renderToStaticMarkup(createElement(AdminPagination, { ...props, page: 1, rowCount: 1, meta: { page: 1, limit: 20, total: 1, pages: 1 } }));
    expect(button(only, "Anterior")).toContain("disabled");
    expect(button(only, "Siguiente")).toContain("disabled");
    expect(boundedAdminPage(-1, 3)).toBe(1);
    expect(boundedAdminPage(100, 3)).toBe(3);
  });

  it("carga oculta filas y rango anteriores, desactiva navegación y anuncia carga", () => {
    const html = renderToStaticMarkup(createElement(AdminPageView, { ...props, loading: true, onRetry: () => {}, children: "FILA ANTERIOR" }));
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Cargando usuarios");
    expect(html).not.toContain("FILA ANTERIOR");
    expect(html).not.toContain("21–40");
    expect(button(html, "Anterior")).toContain("disabled");
    expect(button(html, "Siguiente")).toContain("disabled");
  });

  it("error ofrece retry y volver a una página anterior, sin tabla ni vacío falso", () => {
    const html = renderToStaticMarkup(createElement(AdminPageView, { ...props, error: "Fallo de carga", onRetry: () => {}, children: "FILA ANTERIOR" }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Reintentar");
    expect(button(html, "Anterior")).not.toContain("disabled");
    expect(html).not.toContain("No hay usuarios");
    expect(html).not.toContain("FILA ANTERIOR");
    expect(html).not.toContain("21–40");
  });

  it("colección vacía exitosa conserva un estado limpio y 0 de 0", () => {
    const html = renderToStaticMarkup(createElement(AdminPageView, { ...props, page: 1, rowCount: 0, meta: { page: 1, limit: 20, total: 0, pages: 1 }, onRetry: () => {}, children: "FILA" }));
    expect(html).toContain("No hay usuarios para mostrar");
    expect(html).toContain("0–0 de 0 · Página 1 de 1");
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("FILA");
  });

  it("una mutación pendiente bloquea ambos controles de página", () => {
    const html = renderToStaticMarkup(createElement(AdminPagination, { ...props, disabled: true }));
    expect(button(html, "Anterior")).toContain("disabled");
    expect(button(html, "Siguiente")).toContain("disabled");
  });
});

describe("A18 · consultas limitadas y respuestas obsoletas", () => {
  const page = (pageNumber = 1, total = 43): AdminPage<{ id: string }> => ({
    data: [{ id: `row-${pageNumber}` }], meta: { page: pageNumber, limit: 20, total, pages: Math.max(1, Math.ceil(total / 20)) },
  });
  const callbacks = () => ({ onSuccess: vi.fn(), onOutOfRange: vi.fn(), onError: vi.fn() });

  it("consultar y reintentar solicita exclusivamente la página elegida con límite 20", async () => {
    const load = vi.fn().mockResolvedValue(page(2));
    const handlers = callbacks();
    await startAdminPageRequest(load, 2, handlers).finished;
    await startAdminPageRequest(load, 2, handlers).finished;
    expect(load.mock.calls).toEqual([[{ page: 2, limit: ADMIN_PAGE_LIMIT }], [{ page: 2, limit: ADMIN_PAGE_LIMIT }]]);
    expect(handlers.onSuccess).toHaveBeenCalledTimes(2);
  });

  it("una página desaparecida pide volver a la última válida sin publicar un vacío falso", async () => {
    const handlers = callbacks();
    const load = vi.fn().mockResolvedValue({ ...page(3, 21), data: [] });
    await startAdminPageRequest(load, 3, handlers).finished;
    expect(handlers.onOutOfRange).toHaveBeenCalledWith(2);
    expect(handlers.onSuccess).not.toHaveBeenCalled();
    expect(handlers.onError).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("una colección que se vacía vuelve a página 1", async () => {
    const handlers = callbacks();
    await startAdminPageRequest(async () => ({ ...page(2, 0), data: [] }), 2, handlers).finished;
    expect(handlers.onOutOfRange).toHaveBeenCalledWith(1);
  });

  it("una respuesta lenta cancelada no reemplaza la página nueva ni fuerza otro salto", async () => {
    let resolveOld!: (value: AdminPage<{ id: string }>) => void;
    const oldHandlers = callbacks(); const currentHandlers = callbacks();
    const old = startAdminPageRequest(() => new Promise<AdminPage<{ id: string }>>((resolve) => { resolveOld = resolve; }), 3, oldHandlers);
    old.cancel();
    await startAdminPageRequest(async () => page(2), 2, currentHandlers).finished;
    resolveOld({ ...page(3, 0), data: [] });
    await old.finished;
    expect(currentHandlers.onSuccess).toHaveBeenCalledWith(page(2));
    expect(oldHandlers.onSuccess).not.toHaveBeenCalled();
    expect(oldHandlers.onOutOfRange).not.toHaveBeenCalled();
    expect(oldHandlers.onError).not.toHaveBeenCalled();
  });

  it("un error cancelado no se presenta después de navegar o desmontar", async () => {
    let rejectOld!: (error: Error) => void;
    const handlers = callbacks();
    const old = startAdminPageRequest(() => new Promise<AdminPage<{ id: string }>>((_, reject) => { rejectOld = reject; }), 1, handlers);
    old.cancel(); rejectOld(new Error("TEST_OFFLINE_FAILURE")); await old.finished;
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it("el error de API o un contrato inválido no se transforma en éxito vacío", async () => {
    const handlers = callbacks();
    await startAdminPageRequest(async () => { throw new Error("TEST_API_FAILURE"); }, 1, handlers).finished;
    await startAdminPageRequest(async () => ({ data: [], meta: undefined! }), 1, handlers).finished;
    expect(handlers.onError).toHaveBeenCalledTimes(2);
    expect(handlers.onSuccess).not.toHaveBeenCalled();
    expect(() => validateAdminPage(page(2), 1)).toThrow("INVALID_ADMIN_PAGE");
    expect(() => validateAdminPage({ ...page(), meta: { ...page().meta, limit: 1000 } }, 1)).toThrow("INVALID_ADMIN_PAGE");
    expect(() => validateAdminPage(page(1, 0), 1)).toThrow("INVALID_ADMIN_PAGE");
  });

  it("rechaza filas por encima del total disponible en la última página", async () => {
    const handlers = callbacks();
    const last = { ...page(3, 43), data: [{ id: "one" }, { id: "two" }, { id: "three" }] };
    expect(validateAdminPage(last, 3)).toEqual(last);
    await startAdminPageRequest(async () => ({ ...last, data: [...last.data, { id: "extra" }] }), 3, handlers).finished;
    expect(handlers.onError).toHaveBeenCalledOnce();
    expect(handlers.onSuccess).not.toHaveBeenCalled();
    expect(handlers.onOutOfRange).not.toHaveBeenCalled();
  });
});

describe("A18 · transporte de las cinco listas administrativas", () => {
  it.each([
    ["users", api.admin.getUsers, "/api/v1/admin/users"],
    ["providers", api.admin.getProviders, "/api/v1/admin/providers"],
    ["requests", api.admin.getRequests, "/api/v1/admin/requests"],
    ["disputes", api.admin.getDisputes, "/api/v1/disputes/admin/all"],
    ["audit", api.admin.getAuditLogs, "/api/v1/admin/audit"],
  ] as const)("%s envía page/limit y conserva metadata del servidor", async (_, list, path) => {
    const response = { data: [{ id: "server-id" }], meta };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await expect(list({ page: 2, limit: 20 })).resolves.toEqual(response);
    expect(fetch).toHaveBeenCalledWith(`${path}?page=2&limit=20`, expect.objectContaining({ method: "GET", credentials: "include" }));
  });
});
