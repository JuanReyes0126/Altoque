/** Correo/SSO/Better Auth con fixtures y adapter en memoria; nunca DB ni correo externo. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter, type MemoryDB } from "better-auth/adapters/memory";
import { verificationDeliveryURL, verificationRequest } from "../auth/verification-link.js";
import { AppError } from "../lib/errors.js";
import { app } from "../index.js";

const boundary = vi.hoisted(() => ({ handler: vi.fn() }));
vi.mock("../auth/auth.js", () => ({ auth: { handler: boundary.handler } }));

const origin = "http://localhost:3000";
const path = "/api/v1/auth/verify-email";
const marker = "private-verification-fixture";

/** Fases observadas: SSO quita `token`, conserva alias/callback y añade su JWT. */
function observedSSOReturn(value: string): string {
  const url = new URL(value);
  url.searchParams.delete("token");
  url.searchParams.set("_vercel_jwt", "private-sso-fixture");
  return url.toString();
}

function observedSSOCleanup(value: string): string {
  const url = new URL(value);
  url.searchParams.delete("_vercel_jwt");
  return url.toString();
}

describe("Enlaces de verificación · compatibilidad y ambigüedad", () => {
  it("cambia únicamente el nombre de transporte y conserva JWT/callback en la frontera", () => {
    const original = `${origin}${path}?token=${marker}&callbackURL=${encodeURIComponent(`${origin}/#/app`)}&fixture=1`;
    const delivered = new URL(verificationDeliveryURL(original));
    expect(delivered.searchParams.has("token")).toBe(false);
    expect(delivered.searchParams.get("verification_token") === marker).toBe(true);
    const request = new Request(delivered, { headers: { Cookie: "fixture-cookie=fixture-value" } });
    const normalized = verificationRequest(request);
    const canonical = new URL(normalized.url);
    expect(canonical.searchParams.get("token") === marker).toBe(true);
    expect(canonical.searchParams.get("callbackURL") === `${origin}/#/app`).toBe(true);
    expect(canonical.searchParams.get("fixture")).toBe("1");
    expect(canonical.searchParams.has("verification_token")).toBe(false);
    expect(normalized.headers.get("cookie") === request.headers.get("cookie")).toBe(true);
    expect(normalized.method).toBe("GET");
    expect(normalized.body === null && request.bodyUsed === false).toBe(true);
  });

  it.each([
    `${path}?token=${marker}&callbackURL=%2F`,
    `${path}?token=one&token=two`,
    path,
    `${path}/?verification_token=${marker}`,
    `/api/v1/auth/reset-password?verification_token=${marker}`,
  ])("GET ajeno al alias exacto conserva el mismo Request (%s)", (route) => {
    const request = new Request(`${origin}${route}`);
    expect(verificationRequest(request) === request).toBe(true);
  });

  it("POST conserva el mismo Request y su body sin lectura previa", async () => {
    const request = new Request(`${origin}${path}?verification_token=${marker}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fixture: true }),
    });
    expect(verificationRequest(request) === request).toBe(true);
    expect(request.bodyUsed).toBe(false);
    expect((await request.json()).fixture).toBe(true);
  });

  it.each([
    `${path}?verification_token=${marker}&token=${marker}`,
    `${path}?verification_token=${marker}&verification_token=${marker}`,
    `${path}?verification_token=`,
    `${path}?verification_token=%20%20`,
  ])("alias ambiguo/vacío falla con 400 sin reflejar valores (%s)", (route) => {
    let error: unknown;
    try { verificationRequest(new Request(`${origin}${route}`)); } catch (failure) { error = failure; }
    expect(error instanceof AppError).toBe(true);
    expect((error as AppError).status).toBe(400);
    expect(JSON.stringify(error).includes(marker)).toBe(false);
    expect(String(error).includes(marker)).toBe(false);
  });

  it.each([
    "private-malformed-fixture",
    `${origin}${path}?token=`,
    `${origin}${path}?token=one&token=two`,
    `${origin}${path}?token=${marker}&verification_token=${marker}`,
    `${origin}/other?token=${marker}`,
  ])("URL de entrega inválida falla sin reflejar el enlace (%s)", (value) => {
    let error: unknown;
    try { verificationDeliveryURL(value); } catch (failure) { error = failure; }
    expect(error instanceof AppError).toBe(true);
    expect(String(error).includes(value)).toBe(false);
  });
});

describe("Frontera HTTP · SSO observado y Better Auth real", () => {
  beforeEach(() => {
    boundary.handler.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it.each([
    `verification_token=${marker}&token=${marker}`,
    `verification_token=${marker}&verification_token=${marker}`,
    "verification_token=",
  ])("rechaza %s antes de invocar Better Auth y sin secretos en respuesta/logs", async (query) => {
    const response = await app.request(`${path}?${query}`);
    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body.includes(marker)).toBe(false);
    expect(boundary.handler).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.log).mock.calls).includes(marker)).toBe(false);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls).includes(marker)).toBe(false);
  });

  it("reproduce token perdido en SSO y verifica con alias sin sustituir JWT/sesión de Better Auth", async () => {
    const database: MemoryDB = { user: [], account: [], session: [], verification: [] };
    let originalURL = "";
    const auth = betterAuth({
      baseURL: origin, basePath: "/api/v1/auth", trustedOrigins: [origin],
      secret: "test-only-verification-link-secret-at-least-32-chars", database: memoryAdapter(database),
      logger: { disabled: true },
      emailAndPassword: { enabled: true, requireEmailVerification: true },
      emailVerification: { autoSignInAfterVerification: true, sendVerificationEmail: async ({ url }) => { originalURL = url; } },
    });
    boundary.handler.mockImplementation((request: Request) => auth.handler(request));
    const signup = await app.request("/api/v1/auth/sign-up/email", {
      method: "POST", headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ name: "E2E fixture", email: "verification-link@example.invalid", password: "TestFixturePassword123!", callbackURL: `${origin}/` }),
    });
    expect(signup.status).toBe(200);
    expect(database.user[0].emailVerified).toBe(false);
    expect(database.session.length).toBe(0);
    const originalToken = new URL(originalURL).searchParams.get("token");
    expect(Boolean(originalToken)).toBe(true);

    const brokenSSO = observedSSOCleanup(observedSSOReturn(originalURL));
    expect(new URL(brokenSSO).searchParams.has("token")).toBe(false);
    const failed = await app.request(brokenSSO);
    expect(failed.status).toBe(400);
    expect(database.user[0].emailVerified).toBe(false);
    expect(database.session.length).toBe(0);

    const deliveryURL = verificationDeliveryURL(originalURL);
    const ssoReturn = observedSSOReturn(deliveryURL);
    expect(new URL(ssoReturn).searchParams.get("verification_token") === originalToken).toBe(true);
    const safeSSO = observedSSOCleanup(ssoReturn);
    const verified = await app.request(safeSSO);
    expect(verified.status).toBe(302);
    expect(verified.headers.get("location") === `${origin}/`).toBe(true);
    expect(database.user[0].emailVerified).toBe(true);
    expect(database.session.length).toBe(1);
    expect(verified.headers.getSetCookie().some((cookie) => cookie.includes("session_token="))).toBe(true);
    const forwarded = boundary.handler.mock.calls.at(-1)?.[0] as Request;
    expect(new URL(forwarded.url).searchParams.get("token") === originalToken).toBe(true);
    expect(new URL(forwarded.url).searchParams.has("verification_token")).toBe(false);
    const recorded = JSON.stringify([...vi.mocked(console.log).mock.calls, ...vi.mocked(console.error).mock.calls]);
    expect(Boolean(originalToken) && !recorded.includes(originalToken!)).toBe(true);
    expect(recorded.includes("private-sso-fixture")).toBe(false);
  });

  it("alias no autoriza tokens inválidos: Better Auth sigue rechazando sin crear sesiones", async () => {
    const database: MemoryDB = { user: [], account: [], session: [], verification: [] };
    const auth = betterAuth({
      baseURL: origin, basePath: "/api/v1/auth", trustedOrigins: [origin],
      secret: "test-only-invalid-link-secret-at-least-32-chars", database: memoryAdapter(database), logger: { disabled: true },
    });
    boundary.handler.mockImplementation((request: Request) => auth.handler(request));
    const response = await app.request(`${path}?verification_token=${marker}`);
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("INVALID_TOKEN");
    expect(database.user.length === 0 && database.session.length === 0).toBe(true);
  });
});
