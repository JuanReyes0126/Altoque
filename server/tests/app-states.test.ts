import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminDataState } from "../../src/features/admin/AdminDataState";
import { AuthLoadError } from "../../src/components/AppStates";

const props = { loading: false, error: "", empty: true, label: "usuarios", onRetry: () => {} };
describe("Estados explícitos · admin y bootstrap", () => {
  it("una respuesta administrativa vacía exitosa muestra vacío sin error", () => {
    const html = renderToStaticMarkup(createElement(AdminDataState, props));
    expect(html).toContain("No hay usuarios para mostrar");
    expect(html).not.toContain('role="alert"');
  });
  it("un fallo administrativo no se convierte en tabla vacía", () => {
    const html = renderToStaticMarkup(createElement(AdminDataState, { ...props, error: "Fallo del API" }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Reintentar");
    expect(html).not.toContain("No hay usuarios");
    expect(renderToStaticMarkup(createElement(AdminDataState, { ...props, loading: true }))).toContain("Cargando usuarios");
  });
  it("un error de bootstrap permite reintentar y no informa una sesión cerrada", () => {
    const html = renderToStaticMarkup(createElement(AuthLoadError, { onRetry: () => {} }));
    expect(html).toContain("No pudimos comprobar tu sesión");
    expect(html).toContain("Reintentar");
    expect(html).not.toContain("sesión cerrada");
  });
});
