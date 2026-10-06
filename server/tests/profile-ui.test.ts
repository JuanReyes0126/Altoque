/** Contratos del navegador y render de estados privados sin DB ni correos. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AddressList } from "../../src/features/client/Addresses";
import { SecurityPage, securityError } from "../../src/features/client/Security";
import { ApiHttpError } from "../../src/lib/http";
import { profileApi } from "../../src/lib/profile-api";
import { authApi } from "../../src/lib/api";

vi.mock("../../src/lib/state", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/state")>();
  return { ...actual, useApp: () => ({ session: { email: "profile-fixture@test.altoque.do", emailVerified: true } }) };
});
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => vi.fn() };
});

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const noAction = () => {};
const listProps = { addresses: [], loading: false, error: "", onRetry: noAction, onEdit: noAction, onDelete: noAction };

describe("Perfil · estados y API offline", () => {
  it("la lista vacía exitosa muestra empty state sin alerta de error", () => {
    const html = renderToStaticMarkup(createElement(AddressList, listProps));
    expect(html).toContain("Aún no tienes direcciones");
    expect(html).not.toContain('role="alert"');
  });

  it("carga y fallo tienen estados distintos con reintento", () => {
    const loading = renderToStaticMarkup(createElement(AddressList, { ...listProps, loading: true }));
    expect(loading).toContain("Cargando direcciones");
    expect(loading).not.toContain("Aún no tienes direcciones");
    const error = renderToStaticMarkup(createElement(AddressList, { ...listProps, error: "No se pudo cargar" }));
    expect(error).toContain('role="alert"');
    expect(error).toContain("Reintentar");
    expect(error).not.toContain("Aún no tienes direcciones");
  });

  it("la lista presenta direcciones reales escapando contenido", () => {
    const html = renderToStaticMarkup(createElement(AddressList, {
      ...listProps,
      addresses: [{ id: "fixture-id", label: "Casa <script>", line: "Calle 1", zone_id: "zone", zone: { id: "zone", name: "Gurabo", municipality: "Santiago" } }],
    }));
    expect(html).toContain("Casa &lt;script&gt;");
    expect(html).toContain("Calle 1");
    expect(html).toContain("Gurabo");
    expect(html).toContain("Editar");
    expect(html).toContain("Eliminar");
    expect(html).not.toContain("Aún no tienes direcciones");
  });

  it("seguridad ofrece contraseña y sesiones reales sin toggles ficticios", () => {
    const html = renderToStaticMarkup(createElement(SecurityPage));
    expect(html).toContain("Correo verificado");
    expect(html).toContain("Cambiar contraseña");
    expect(html.toLowerCase()).toContain('autocomplete="current-password"');
    expect(html.toLowerCase()).toContain('autocomplete="new-password"');
    expect(html).toContain("Cerrar otras sesiones");
    expect(html).not.toContain('type="checkbox"');
  });

  it("direcciones vacías exitosas conservan [] y API real fallida rechaza", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Error interno" } }), { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await profileApi.addresses.list()).toEqual([]);
    await expect(profileApi.addresses.list()).rejects.toMatchObject({ status: 500, code: "INTERNAL_ERROR" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/me/addresses");
    expect(fetchMock.mock.calls[0][1].credentials).toBe("include");
  });

  it("CRUD usa POST/PATCH/DELETE explícitos y codifica ids", async () => {
    const saved = { id: "fixture", label: "Casa", line: "Calle 1", zone_id: "zone", zone: { id: "zone", name: "Zona", municipality: "Ciudad" } };
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ data: saved }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    const input = { label: "Casa", line: "Calle 1", zone_id: "zone" };
    expect(await profileApi.addresses.create(input)).toEqual(saved);
    expect(await profileApi.addresses.update("a/b", input)).toEqual(saved);
    await profileApi.addresses.remove("a/b");
    expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(["POST", "PATCH", "DELETE"]);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual(["/api/v1/me/addresses", "/api/v1/me/addresses/a%2Fb", "/api/v1/me/addresses/a%2Fb"]);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(input);
  });

  it("las zonas provienen del catálogo HTTP real", async () => {
    const zones = [{ id: "zone-db", name: "Zona de la API", municipality: "Ciudad" }];
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: zones }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await profileApi.zones()).toEqual(zones);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/zones");
  });

  it("las operaciones de seguridad usan Better Auth y descartan tokens de respuesta", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "fixture-token", user: { id: "fixture-user" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const input = { currentPassword: "FixtureCurrent123!", newPassword: "FixtureNew123!", revokeOtherSessions: true };
    expect(await authApi.changePassword(input)).toBeUndefined();
    expect(await authApi.revokeOtherSessions()).toBeUndefined();
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual(["/api/v1/auth/change-password", "/api/v1/auth/revoke-other-sessions"]);
    expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(["POST", "POST"]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(input);
  });

  it.each([
    ["INVALID_PASSWORD", 400, "La contraseña actual no es correcta."],
    ["SESSION_NOT_FRESH", 403, "Vuelve a iniciar sesión para realizar esta operación."],
    ["UNAUTHORIZED", 401, "Vuelve a iniciar sesión para realizar esta operación."],
    ["RATE_LIMITED", 429, "Demasiados intentos. Espera unos minutos y vuelve a intentarlo."],
  ])("el error %s se presenta sin detalles internos", (code, status, expected) => {
    expect(securityError(new ApiHttpError(status as number, code as string, "Internal details"))).toBe(expected);
  });

  it("un error inesperado de seguridad no expone detalles internos", () => {
    expect(securityError(new Error("Sensitive database detail"))).toBe("No pudimos completar la operación. Inténtalo nuevamente.");
  });
});
