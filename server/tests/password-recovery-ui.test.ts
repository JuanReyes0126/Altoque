import { afterEach, describe, expect, it, vi } from "vitest";
import { recoveryError, takeResetLink } from "../../src/features/landing/PasswordRecovery";
import { authApi } from "../../src/lib/api";
import { ApiHttpError } from "../../src/lib/http";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Recuperación · contrato UI/Better Auth", () => {
  it("retira el token de reset del URL manteniendo ruta y query inocuos", () => {
    const replace = vi.fn();
    expect(takeResetLink({ pathname: "/", search: "?flow=password-reset&token=fixture-reset&lang=es", hash: "#/recuperar-contrasena" }, replace)).toEqual({ token: "fixture-reset", invalid: false });
    expect(replace).toHaveBeenCalledWith("/?lang=es#/recuperar-contrasena");
    expect(replace.mock.calls[0][0]).not.toContain("token");
  });

  it("no consume enlaces de verificación como reset y conserva INVALID_TOKEN", () => {
    const replace = vi.fn();
    expect(takeResetLink({ pathname: "/", search: "?token=fixture-verification", hash: "#/" }, replace)).toEqual({ token: "", invalid: false });
    expect(replace).not.toHaveBeenCalled();
    expect(takeResetLink({ pathname: "/", search: "?flow=password-reset&error=INVALID_TOKEN", hash: "#/recuperar-contrasena" }, replace).invalid).toBe(true);
  });

  it("solicitud usa callback dinámico y el reset descarta la respuesta", async () => {
    vi.stubGlobal("window", { location: { origin: "https://fixture-preview.example.invalid" } });
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response('{"status":true}', { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await authApi.requestPasswordReset("fixture@example.invalid")).toBeUndefined();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).redirectTo).toBe("https://fixture-preview.example.invalid/?flow=password-reset#/recuperar-contrasena");
    expect(await authApi.resetPassword("fixture-reset", "FixturePassword123!")).toBeUndefined();
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual(["/api/v1/auth/request-password-reset", "/api/v1/auth/reset-password"]);
    expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(["POST", "POST"]);
  });

  it("rechazo de correo no simula aceptación", async () => {
    vi.stubGlobal("window", { location: { origin: "https://fixture-preview.example.invalid" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"code":"EMAIL_DELIVERY_FAILED","message":"delivery-private-detail"}', { status: 503 })));
    await expect(authApi.requestPasswordReset("fixture@example.invalid")).rejects.toMatchObject({ code: "EMAIL_DELIVERY_FAILED", status: 503 });
    expect(recoveryError(new ApiHttpError(503, "EMAIL_DELIVERY_FAILED", "delivery-private-detail"))).not.toContain("private-detail");
    expect(recoveryError(new ApiHttpError(400, "INVALID_TOKEN", "internal"))).toContain("Solicita uno nuevo");
  });
});
