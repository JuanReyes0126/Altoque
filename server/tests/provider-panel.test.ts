import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProviderAvailabilityControl, ProviderInboxState } from "../../src/features/provider/ProviderPanelStates";
import { ProviderProfileSetup } from "../../src/features/provider/ProviderProfileSetup";

const noOp = () => {};
const inbox = (props: Partial<Parameters<typeof ProviderInboxState>[0]> = {}) => renderToStaticMarkup(createElement(ProviderInboxState, {
  verificationStatus: "verified", available: true, status: "success", error: null, count: 0, onRetry: noOp, ...props,
}));

describe("Panel profesional · respuestas vacías y errores", () => {
  it("un inbox exitoso vacío muestra empty state y conserva el estado online", () => {
    const html = inbox();
    expect(html).toContain("No hay solicitudes disponibles por ahora");
    expect(html).toContain("Sigues en línea");
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("Reintentar");
  });

  it("no representa una carga pendiente como una colección vacía", () => {
    for (const status of ["idle", "loading"] as const) {
      const html = inbox({ status });
      expect(html).toContain("Cargando solicitudes");
      expect(html).not.toContain("No hay solicitudes disponibles");
    }
  });

  it("un error real tiene alerta y reintento aunque no haya solicitudes", () => {
    const html = inbox({ status: "error", error: "No pudimos conectar con Altoque." });
    expect(html).toContain('role="alert"');
    expect(html).toContain("No pudimos conectar con Altoque.");
    expect(html).toContain("Reintentar");
    expect(html).not.toContain("No hay solicitudes disponibles");
  });

  it("el perfil pendiente explica la aprobación sin convertirla en un error de inbox", () => {
    const html = inbox({ verificationStatus: "pending_verification", available: false, status: "idle" });
    expect(html).toContain("Tu perfil está pendiente de verificación");
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("No pudimos cargar");
  });

  it("fuera de línea muestra el estado correspondiente sin simular solicitudes", () => {
    const html = inbox({ available: false, status: "idle" });
    expect(html).toContain("Estás fuera de línea");
    expect(html).not.toContain("No hay solicitudes disponibles");
  });

  it("la colección no vacía presenta las solicitudes recibidas", () => {
    expect(inbox({ count: 1, children: createElement("p", null, "Solicitud real") })).toContain("Solicitud real");
  });
});

describe("Panel profesional · control de disponibilidad", () => {
  it("permite ponerse online sin depender de solicitudes", () => {
    const html = renderToStaticMarkup(createElement(ProviderAvailabilityControl, { available: false, verified: true, busy: false, onChange: noOp }));
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).not.toContain('disabled=""');
  });

  it("representa la disponibilidad persistida después de volver a cargar el perfil", () => {
    const html = renderToStaticMarkup(createElement(ProviderAvailabilityControl, { available: true, verified: true, busy: false, onChange: noOp }));
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("Recibiendo solicitudes cerca de ti");
  });

  it("bloquea cambios simultáneos mientras guarda", () => {
    const html = renderToStaticMarkup(createElement(ProviderAvailabilityControl, { available: false, verified: true, busy: true, onChange: noOp }));
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Guardando disponibilidad");
  });

  it("mantiene el guard profesional para un perfil no aprobado", () => {
    const html = renderToStaticMarkup(createElement(ProviderAvailabilityControl, { available: false, verified: false, busy: false, onChange: noOp }));
    expect(html).toContain('disabled=""');
    expect(html).toContain("Disponible cuando tu perfil esté verificado");
  });
});

describe("Panel profesional · cuenta sin perfil", () => {
  it("ofrece completar el perfil actual y carga el catálogo sin registrar otra cuenta", () => {
    const html = renderToStaticMarkup(createElement(ProviderProfileSetup, { onCreated: noOp, onBack: noOp }));
    expect(html).toContain("Completa tu perfil profesional");
    expect(html).toContain("Usaremos tu cuenta actual");
    expect(html).toContain("Cargando servicios y zonas");
    expect(html).not.toContain('type="password"');
    expect(html).not.toContain('type="email"');
  });
});
