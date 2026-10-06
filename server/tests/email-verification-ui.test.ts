import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmailVerificationPanel, resendButtonLabel, verificationErrorMessage } from "../../src/features/landing/EmailVerification";
import { ApiHttpError } from "../../src/lib/http";

const props = { email: "fixture@example.invalid", sent: false, error: null, busy: false, cooldown: 0, accepted: false, onResend: () => {}, onContinue: () => {} };

describe("Verificación · UI honesta", () => {
  it("un envío fallido permite reenviar y no afirma envío exitoso", () => {
    const html = renderToStaticMarkup(createElement(EmailVerificationPanel, { ...props, error: "No pudimos enviar el correo de verificación." }));
    expect(html).toContain("Tu cuenta espera verificación");
    expect(html).toContain('role="alert"');
    expect(html).toContain("Reenviar correo");
    expect(html).not.toContain("Revisa también la carpeta de spam");
    expect(html).not.toContain("fue creada");
    expect(html).not.toContain("enviado correctamente");
    expect(html).not.toContain("Function Logs");
  });

  it("un registro aceptado explica verificación sin revelar existencia de cuenta", () => {
    const html = renderToStaticMarkup(createElement(EmailVerificationPanel, { ...props, sent: true }));
    expect(html).toContain("Revisa tu correo");
    expect(html).toContain("Si el correo");
    expect(html).toContain("cuenta pendiente");
    expect(html).not.toContain("fue creada");
  });

  it("reenvío aceptado usa mensaje condicional y limita doble click", () => {
    const html = renderToStaticMarkup(createElement(EmailVerificationPanel, { ...props, accepted: true, cooldown: 60 }));
    expect(html).toContain('role="status"');
    expect(html).toContain("Si tu correo sigue pendiente");
    expect(html).toContain("Reenviar en 1 min");
    expect(html).toContain("disabled");
  });

  it("errores internos de correo no se muestran al usuario", () => {
    const failure = new ApiHttpError(503, "EMAIL_DELIVERY_FAILED", "provider-private-detail");
    expect(verificationErrorMessage(failure)).not.toContain("provider-private-detail");
    expect(verificationErrorMessage(new ApiHttpError(429, "RATE_LIMITED", "private-detail"))).toContain("Espera unos minutos");
    expect(resendButtonLabel(true, 0)).toBe("Enviando…");
    expect(resendButtonLabel(false, 15)).toBe("Reenviar en 15 s");
  });
});
