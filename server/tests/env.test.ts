import { afterEach, describe, expect, it, vi } from "vitest";

describe("Orígenes confiables · alias exacto de Preview", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  async function origins(branchHost: string, deployment = "preview") {
    vi.stubEnv("VERCEL_ENV", deployment);
    vi.stubEnv("VERCEL_BRANCH_URL", branchHost);
    vi.resetModules();
    return (await import("../config/env.js")).trustedOrigins();
  }

  it("acepta solo el hostname exacto del alias Preview", async () => {
    const allowed = await origins("altoque-git-test-project.vercel.app");
    expect(allowed).toContain("https://altoque-git-test-project.vercel.app");
    expect(allowed).not.toContain("https://another-project.vercel.app");
    expect(allowed).not.toContain("https://*.vercel.app");
  });

  it.each(["production", "development"])("no añade alias cuando el entorno es %s", async (deployment) => {
    expect(await origins("altoque-git-test-project.vercel.app", deployment))
      .not.toContain("https://altoque-git-test-project.vercel.app");
  });

  it.each(["https://test.vercel.app", "test.vercel.app/path", "test.vercel.app@evil.example",
    "*.vercel.app", "test.vercel.app.evil.example", "other.example", "test.vercel.app:443", "-test.vercel.app"])(
    "rechaza hostname inválido: %s", async (branchHost) => {
      expect(await origins(branchHost)).toEqual(["http://localhost:3000"]);
    },
  );
});
