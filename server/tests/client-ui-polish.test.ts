import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmptyState, ErrorState, LoadingState } from "../../src/components/ui/feedback";
import { Sheet } from "../../src/components/ui/kit";
import { PublicProviderCard } from "../../src/features/client/Home";
import { RequestSummary, RequestTimeline } from "../../src/features/client/Requests";
import type { PublicProvider } from "../../src/lib/api";

const renderers: ReactTestRenderer[] = [];
async function mount(element: ReactElement) {
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(element); });
  renderers.push(renderer);
  return renderer;
}
afterEach(async () => {
  await act(async () => { for (const renderer of renderers.splice(0)) renderer.unmount(); });
  vi.unstubAllGlobals();
});
const html = (element: ReactElement) => renderToStaticMarkup(element);
const provider: PublicProvider = {
  id: "api-profile", name: "Perfil Auténtico", image: null, business_name: null,
  rating: 0, reviews_count: 0, is_available: false, avg_eta_min: null,
  categories: [], zones: [],
};

describe("Pulido cliente: contenido real, estados y acciones conservadas", () => {
  it("vacío, loading y error mantienen semánticas distintas y retry operativo", async () => {
    const empty = html(createElement(EmptyState, { title: "Sin solicitudes", description: "Crea la primera." }));
    expect(empty).toContain('role="status"');
    expect(empty).not.toContain('role="alert"');
    const loading = html(createElement(LoadingState, { label: "Consultando servicios…" }));
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain('aria-hidden="true"');
    const retry = vi.fn();
    const failure = await mount(createElement(ErrorState, { message: "No se pudo cargar", onRetry: retry }));
    expect(failure.root.findByProps({ role: "alert" })).toBeDefined();
    await act(async () => { failure.root.findByType("button").props.onClick(); });
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("perfiles sin reseñas no inventan rating, ETA, precio ni fotografías", () => {
    const result = html(createElement(PublicProviderCard, { provider, onOpen: vi.fn(), onRequest: vi.fn() }));
    expect(result).toContain("PA");
    expect(result).toContain("Aún sin reseñas");
    expect(result).toContain("Fuera de línea");
    expect(result).not.toMatch(/<img|0\.0 ★|RD\$|\bETA\b|unsplash|assets\/face/);
  });

  it("rating y ambas acciones corresponden exclusivamente al perfil real", async () => {
    const rated = { ...provider, rating: 4.7, reviews_count: 3, is_available: true };
    expect(html(createElement(PublicProviderCard, { provider: rated, onOpen: vi.fn(), onRequest: vi.fn() }))).toContain("4.7 ★ · 3 reseñas");
    const open = vi.fn(), request = vi.fn();
    const card = await mount(createElement(PublicProviderCard, { provider: rated, onOpen: open, onRequest: request }));
    const buttons = card.root.findAllByType("button");
    await act(async () => { buttons[0].props.onClick(); buttons[1].props.onClick(); });
    expect(open).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("una fotografía fallida vuelve a iniciales, conservando la identidad del perfil", async () => {
    const card = await mount(createElement(PublicProviderCard, { provider: { ...provider, image: "/api-profile-image" }, onOpen: vi.fn(), onRequest: vi.fn() }));
    expect(card.root.findByType("img").props.src).toBe("/api-profile-image");
    await act(async () => { card.root.findByType("img").props.onError(); });
    expect(card.root.findAllByType("img")).toHaveLength(0);
    expect(JSON.stringify(card.toJSON())).toContain("PA");
  });

  it("la línea de tiempo no inventa progreso y escapa datos del historial", () => {
    const empty = html(createElement(RequestTimeline, { history: [] }));
    expect(empty).toContain("No hay actualizaciones registradas");
    expect(empty).not.toContain("<time");
    const result = html(createElement(RequestTimeline, { history: [
      { id: "event-1", to_status: "accepted", at: "2026-10-06T13:00:00.000Z" },
      { id: "event-2", to_status: "<script>", at: "invalid" },
    ] }));
    expect(result.match(/<li /g)).toHaveLength(2);
    expect(result).toContain('dateTime="2026-10-06T13:00:00.000Z"');
    expect(result).toContain("Fecha no disponible");
    expect(result).toContain("Estado pendiente de actualización");
    expect(result).not.toContain("Servicio en curso");
    expect(result).not.toContain("<script>");
  });

  it("abrir una solicitud conserva su acción y no interpola HTML del cliente", async () => {
    const open = vi.fn();
    const request = { id: "real-request", code: "UI-TEST", description: "<script>inert</script>", status: "searching" };
    const element = createElement(RequestSummary, { request, onOpen: open });
    expect(html(element)).toContain("&lt;script&gt;inert&lt;/script&gt;");
    expect(html(element)).not.toMatch(/<p(?:\s|>)/);
    const summary = await mount(element);
    await act(async () => { summary.root.findByType("button").props.onClick(); });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("Sheet cerrado no oculta contenido y abierto mantiene etiqueta modal y cierre real", async () => {
    expect(html(createElement(Sheet, { open: false, onClose: vi.fn(), title: "Opciones", children: "Contenido" }))).toBe("");
    const close = vi.fn();
    const modal = await mount(createElement(Sheet, { open: true, onClose: close, title: "Opciones", children: "Contenido" }));
    const dialog = modal.root.findByProps({ role: "dialog" });
    expect(dialog.props["aria-modal"]).toBe("true");
    expect(dialog.props["aria-labelledby"]).toBeTruthy();
    expect(dialog.props.tabIndex).toBe(-1);
    await act(async () => { modal.root.findAllByType("button").find((button) => button.props["aria-label"] === "Cerrar")!.props.onClick(); });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("Sheet contiene ambos sentidos de Tab desde body o un control deshabilitado", async () => {
    let active: FocusNode, controls: FocusNode[], keydown!: (event: { key: string; shiftKey: boolean; preventDefault: () => void }) => void;
    class FocusNode {
      isConnected = true;
      focus() { active = this; }
      getClientRects() { return [{}]; }
      closest() { return null; }
      querySelectorAll() { return controls; }
    }
    const trigger = new FocusNode(), dialog = new FocusNode(), first = new FocusNode(), last = new FocusNode(), disabled = new FocusNode(), outside = new FocusNode();
    active = trigger; controls = [first, last];
    const body = { style: { overflow: "auto" } };
    vi.stubGlobal("HTMLElement", FocusNode);
    vi.stubGlobal("document", {
      body, get activeElement() { return active; },
      addEventListener: (_: string, handler: typeof keydown) => { keydown = handler; },
      removeEventListener: vi.fn(),
    });
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(createElement(Sheet, { open: true, onClose: vi.fn(), title: "Acceso", children: "Formulario" }), {
      createNodeMock: (node) => node.props.role === "dialog" ? dialog : null,
    }); });
    renderers.push(renderer);
    expect(active).toBe(dialog);
    expect(body.style.overflow).toBe("hidden");
    for (const lost of [disabled, outside]) {
      for (const shiftKey of [false, true]) {
        active = lost;
        const preventDefault = vi.fn();
        keydown({ key: "Tab", shiftKey, preventDefault });
        expect(preventDefault).toHaveBeenCalledTimes(1);
        expect(active).toBe(shiftKey ? last : first);
      }
    }
    controls = [];
    active = disabled;
    const preventDefault = vi.fn();
    keydown({ key: "Tab", shiftKey: false, preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(active).toBe(dialog);
    await act(async () => { renderer.unmount(); });
    renderers.splice(renderers.indexOf(renderer), 1);
    expect(active).toBe(trigger);
    expect(body.style.overflow).toBe("auto");
  });
});
