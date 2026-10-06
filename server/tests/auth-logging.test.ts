import { afterEach, describe, expect, it, vi } from "vitest";
import { authLogger } from "../auth/logger.js";
import { diagEnabled, stage, withDiag } from "../lib/diag.js";

describe("Logs auth y diagnósticos · minimización", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("el logger de Better Auth nunca propaga mensajes ni payloads del adapter", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    const marker = "sensitive-fixture-value";
    authLogger.log?.("error", marker, new Error(marker), { token: marker, password: marker });
    expect(output).toHaveBeenCalledOnce();
    const recorded = JSON.stringify(output.mock.calls);
    expect(recorded.includes(marker)).toBe(false);
    expect(recorded.includes("better_auth_event") && recorded.includes("Error")).toBe(true);
  });

  it("Production desactiva diagnóstico aunque ALTOQUE_DIAG esté habilitado", () => {
    const output = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubEnv("ALTOQUE_DIAG", "1");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(diagEnabled()).toBe(false);
    stage("should-not-log");
    expect(output).not.toHaveBeenCalled();
    vi.stubEnv("VERCEL_ENV", "");
    expect(diagEnabled()).toBe(false);
  });

  it("Preview permite diagnóstico y registra solo tipo de error", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("ALTOQUE_DIAG", "1");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(diagEnabled()).toBe(true);
    const marker = "sensitive-fixture-value";
    let failed = false;
    try { await withDiag("fixture", async () => { throw new Error(marker); }); }
    catch { failed = true; }
    expect(failed).toBe(true);
    expect(JSON.stringify(output.mock.calls).includes(marker)).toBe(false);
    expect(JSON.stringify(output.mock.calls).includes("errorType")).toBe(true);
  });
});
