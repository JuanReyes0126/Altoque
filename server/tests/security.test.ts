/**
 * ALTOQUE · Tests de seguridad a nivel HTTP (F1.6)
 *
 * No requieren BD viva (usan los valores dummy del setup): el rechazo
 * por Origen y la ausencia de sesión se evalúan ANTES de tocar la base.
 *
 * Cobertura pedida:
 *  - Origin externo en mutables → 403 (protección CSRF/Origen)
 *  - manipular "role" en headers/localStorage no produce ningún efecto
 *  - sin sesión → 401 en endpoints protegidos
 *  - healthz no revela configuración interna
 */
import { describe, expect, it } from "vitest";
import { app } from "../index";

const TRUSTED = "http://localhost:3000";

describe("Protección de Origen (CSRF)", () => {
  it("rechaza mutables desde un Origen externo", async () => {
    const res = await app.request("/api/v1/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example.com" },
      body: JSON.stringify({ name: "X", email: "x@x.do", password: "password123" }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("FORBIDDEN");
  });

  it("acepta mutables desde el Origen confiable (no 403 de origen)", async () => {
    const res = await app.request("/api/v1/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: TRUSTED },
      body: JSON.stringify({}),
    });
    // La ruta real de Better Auth valida el cuerpo antes de consultar BD.
    // Un 404 también ocultaría un error de montaje, por eso exigir 400.
    expect(res.status).toBe(400);
  });

  it("los GET no exigen Origen", async () => {
    const res = await app.request("/api/v1/healthz", { headers: { origin: "https://evil.example.com" } });
    expect(res.status).not.toBe(403);
  });
});

describe("Autorización · la sesión es la única fuente", () => {
  it("GET /me sin sesión → 401 (aunque se intenten inyectar roles)", async () => {
    const res = await app.request("/api/v1/me", {
      headers: {
        // intento de escalada vía headers — el servidor los ignora
        "x-role": "admin",
        "x-admin-role": "super_admin",
      },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("UNAUTHENTICATED");
  });
});

describe("Healthz · sin fuga de información", () => {
  it("responde sin URL de BD, secretos ni versiones", async () => {
    const res = await app.request("/api/v1/healthz");
    expect([200, 503]).toContain(res.status);
    const body = await res.json();
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/postgresql:\/\//i);
    expect(text).not.toMatch(/secret/i);
    expect(text).not.toMatch(/password/i);
    expect((body as { service?: string }).service).toBe("altoque-api");
  });
});

describe("Errores · formato consistente", () => {
  it("404 con envelope { error: { code, message } }", async () => {
    const res = await app.request("/api/v1/no-existe");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    expect(body.error?.code).toBe("NOT_FOUND");
    expect(body.error?.message).toBeTruthy();
  });
});

describe("Cache del API · respuestas privadas y errores", () => {
  it.each([
    ["/api/v1/auth/get-session", 200],
    ["/api/v1/me", 401],
    ["/api/v1/no-existe", 404],
  ] as const)("GET %s siempre devuelve no-store", async (path, status) => {
    const response = await app.request(path);
    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
