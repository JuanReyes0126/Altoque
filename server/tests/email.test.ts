import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertEmailConfigured, EMAIL_TIMEOUT_MS, sendEmail, verificationEmail } from "../auth/email.js";

const configuration = vi.hoisted(() => ({
  RESEND_API_KEY: "re_test_key_only", EMAIL_FROM: "Altoque <no-reply@example.com>",
}));
vi.mock("../config/env.js", () => ({ env: () => configuration }));

describe("Correo transaccional · transporte real con fetch simulado", () => {
  const email = { to: "customer@example.com", subject: "Verifica", text: "Enlace privado de prueba" };
  const fetchMock = vi.fn();

  beforeEach(() => {
    configuration.RESEND_API_KEY = "re_test_key_only";
    configuration.EMAIL_FROM = "Altoque <no-reply@example.com>";
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("envía al API oficial y exige un id de aceptación", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: "test-provider-message-id" }));
    await sendEmail(email);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url === "https://api.resend.com/emails").toBe(true);
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization === `Bearer ${configuration.RESEND_API_KEY}`).toBe(true);
    const body = JSON.parse(options.body);
    expect(body.from === configuration.EMAIL_FROM && body.to[0] === email.to && body.text === email.text).toBe(true);
    expect(options.redirect).toBe("error");
  });

  it.each(["RESEND_API_KEY", "EMAIL_FROM"] as const)("sin %s falla antes de conectar", async (key) => {
    configuration[key] = "";
    await expect(sendEmail(email)).rejects.toMatchObject({ code: "EMAIL_NOT_CONFIGURED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["Altoque <no-reply@>", "invalid", "Altoque\r\nInjected <a@example.com>"])("rechaza remitente inválido", (from) => {
    configuration.EMAIL_FROM = from;
    expect(() => assertEmailConfigured()).toThrowError("El servicio de correo todavía no está configurado");
  });

  it.each([401, 403, 429, 500, 503])("rechaza HTTP %s sin exponer respuesta del proveedor", async (status) => {
    fetchMock.mockResolvedValue(Response.json({ message: "raw-private-provider-detail" }, { status }));
    await expect(sendEmail(email)).rejects.toMatchObject({ code: "EMAIL_DELIVERY_FAILED" });
  });

  it.each([{}, { id: "" }, { id: " " }, { id: 7 }, null])("rechaza 2xx sin identificador válido", async (body) => {
    fetchMock.mockResolvedValue(Response.json(body));
    await expect(sendEmail(email)).rejects.toMatchObject({ code: "EMAIL_DELIVERY_FAILED" });
  });

  it("rechaza JSON inválido y errores de red sin filtrar detalles", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not-json"));
    await expect(sendEmail(email)).rejects.toMatchObject({ code: "EMAIL_DELIVERY_FAILED" });
    fetchMock.mockRejectedValueOnce(new Error("private url/token/key"));
    let message = "";
    try { await sendEmail(email); } catch (error) { message = (error as Error).message; }
    expect(message).toBe("No pudimos enviar el correo. Inténtalo de nuevo.");
  });

  it("interrumpe el transporte al agotar el timeout", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));
    const rejected = expect(sendEmail(email)).rejects.toMatchObject({ code: "EMAIL_DELIVERY_FAILED" });
    await vi.advanceTimersByTimeAsync(EMAIL_TIMEOUT_MS);
    await rejected;
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it("no escribe cuerpos, enlaces, emails ni credenciales en ningún console", async () => {
    const logs = ["log", "info", "warn", "error"] as const;
    const spies = logs.map((method) => vi.spyOn(console, method).mockImplementation(() => {}));
    fetchMock.mockResolvedValueOnce(Response.json({ id: "message-id" }));
    await verificationEmail({ user: { name: "Cliente", email: email.to }, url: "https://example.com/verify?token=test-token" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text.includes("1 hora") && !body.text.includes("24 horas")).toBe(true);
    fetchMock.mockRejectedValueOnce(new Error("test-token/private-email"));
    await expect(sendEmail(email)).rejects.toMatchObject({ code: "EMAIL_DELIVERY_FAILED" });
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it("verificación incluye botón profesional, enlace Better Auth escapado y remitente configurado", async () => {
    configuration.EMAIL_FROM = "Altoque <cuentas@another.example>";
    fetchMock.mockResolvedValueOnce(Response.json({ id: "message-id" }));
    const url = "https://preview.example/api/v1/auth/verify-email?token=test-token&callbackURL=%2F";
    await verificationEmail({ user: { name: '<img src="x" onerror="alert(1)">', email: email.to }, url });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.from === configuration.EMAIL_FROM).toBe(true);
    expect(body.html.includes(">Verificar mi correo</a>")).toBe(true);
    expect(body.html.includes("El equipo de Altoque")).toBe(true);
    expect(body.html.includes("&amp;callbackURL=%2F")).toBe(true);
    expect(body.html.includes("&lt;img") && !body.html.includes("<img")).toBe(true);
    expect(body.text.includes(url)).toBe(true);
    expect(body.html.includes("altoquerd.do") || body.html.includes("altoque.do")).toBe(false);
  });
});
