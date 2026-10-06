import { afterEach, describe, expect, it, vi } from "vitest";
import { authApi } from "../../src/lib/api";
import { endCurrentSession } from "../../src/lib/session-actions";
import { clearSession, getState, setSession, toggleFav } from "../../src/lib/state";

const user = { id: "fixture-user", name: "Fixture", email: "fixture@example.invalid", role: "customer" as const, status: "active", emailVerified: true };
afterEach(() => { vi.restoreAllMocks(); clearSession(); });

describe("Logout confirmado y limpieza de estado privado", () => {
  it("fallo real de logout conserva sesión y preferencias para reintentar", async () => {
    setSession(user); toggleFav("opaque-provider");
    vi.spyOn(authApi, "signOut").mockRejectedValue(new Error("logout-failed"));
    await expect(endCurrentSession()).rejects.toThrow("logout-failed");
    expect(getState().session?.id).toBe(user.id);
    expect(getState().favorites).toEqual(["opaque-provider"]);
  });
  it("logout exitoso limpia la sesión y el estado privado", async () => {
    setSession(user); toggleFav("opaque-provider");
    vi.spyOn(authApi, "signOut").mockResolvedValue(undefined);
    await endCurrentSession();
    expect(getState().session).toBeNull();
    expect(getState().favorites).toEqual([]);
    expect(getState().proAvailable).toBe(false);
  });
  it("cambiar de cuenta no transfiere favoritos ni disponibilidad", () => {
    setSession(user); toggleFav("opaque-provider");
    setSession({ ...user, id: "another-user" });
    expect(getState().favorites).toEqual([]);
    expect(getState().jobs).toEqual([]);
  });
});

describe("Bootstrap · ausencia de sesión frente a API fallida", () => {
  it("un null exitoso no consulta el perfil privado", async () => {
    const { loadCurrentSession } = await import("../../src/lib/session-actions");
    vi.spyOn(authApi, "getSession").mockResolvedValue(null);
    const me = vi.spyOn(authApi, "me");
    expect(await loadCurrentSession()).toBeNull();
    expect(me).not.toHaveBeenCalled();
  });
  it("un fallo de sesión o perfil se propaga, en lugar de simular logout", async () => {
    const { loadCurrentSession } = await import("../../src/lib/session-actions");
    setSession(user);
    const session = vi.spyOn(authApi, "getSession").mockRejectedValue(new Error("SESSION_API_UNAVAILABLE"));
    await expect(loadCurrentSession()).rejects.toThrow("SESSION_API_UNAVAILABLE");
    expect(getState().session?.id).toBe(user.id);
    session.mockResolvedValue(user);
    vi.spyOn(authApi, "me").mockRejectedValue(new Error("PROFILE_API_UNAVAILABLE"));
    await expect(loadCurrentSession()).rejects.toThrow("PROFILE_API_UNAVAILABLE");
  });
  it("el perfil privado sigue siendo la fuente de los datos restaurados", async () => {
    const { loadCurrentSession } = await import("../../src/lib/session-actions");
    vi.spyOn(authApi, "getSession").mockResolvedValue(user);
    vi.spyOn(authApi, "me").mockResolvedValue({ ...user, name: "Perfil actualizado" });
    expect((await loadCurrentSession())?.name).toBe("Perfil actualizado");
  });
});
