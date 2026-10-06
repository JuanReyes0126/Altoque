/** UI profesional: API interceptada, sin navegador remoto, base de datos ni correo. */
import { createElement } from "react";
import { act, create, type ReactTestRenderer, type TestRendererOptions } from "react-test-renderer";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProApp } from "../../src/features/provider/ProApp";
import { ProviderAvailabilityControl } from "../../src/features/provider/ProviderPanelStates";
import { ProviderProfileSetup } from "../../src/features/provider/ProviderProfileSetup";
import { ToastProvider } from "../../src/components/Toast";

const calls = vi.hoisted(() => ({ profile: vi.fn(), inbox: vi.fn(), active: vi.fn(), availability: vi.fn(), earnings: vi.fn(), claim: vi.fn(), createProfile: vi.fn(), categories: vi.fn(), zones: vi.fn() }));
vi.mock("../../src/lib/api", () => ({
  api: {
    categories: { list: calls.categories },
    providers: { getMe: calls.profile, getInbox: calls.inbox, getActiveJob: calls.active, setAvailability: calls.availability, getEarnings: calls.earnings, claim: calls.claim, create: calls.createProfile },
    disputes: { list: async () => ({ data: [] }) },
  },
  authApi: { signOut: vi.fn() },
}));
vi.mock("../../src/lib/profile-api", () => ({ profileApi: { zones: calls.zones } }));
vi.mock("../../src/lib/state", async (original) => ({ ...await original<typeof import("../../src/lib/state")>(), useApp: () => ({ session: { name: "Profesional de prueba", role: "provider" } }) }));

const renderers: ReactTestRenderer[] = [];
const category = { id: "category-fixture", name: "Servicio de prueba", icon: "wrench" };
const profile = (available = false) => ({ id: "provider-fixture", is_available: available, verification_status: "verified", user: { name: "Profesional de prueba", image: null }, provider_service: [], provider_zone: [] });
const emptyInbox = { data: [], meta: { page: 1, limit: 20, total: 0, pages: 1 } };
const request = { id: "request-fixture", category, zone: { name: "Zona de prueba" }, customer: { name: "Cliente de prueba" }, description: "Descripción real de la fixture" };
function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(text).join(" ");
  return value && typeof value === "object" && "children" in value ? text(value.children) : "";
}
const screen = (renderer: ReactTestRenderer) => text(renderer.toJSON()).replace(/\s+/g, " ").trim();
const action = (renderer: ReactTestRenderer, label: string) => renderer.root.findAllByType("button").find((button) => button.props["aria-label"] === label || text(button.children) === label)!;
async function mount(element: ReturnType<typeof createElement>, options?: TestRendererOptions) {
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(element, options); });
  renderers.push(renderer);
  return renderer;
}
const panel = () => createElement(ToastProvider, { children: createElement(MemoryRouter, null, createElement(ProApp)) });
async function click(renderer: ReactTestRenderer, label: string) { await act(async () => { action(renderer, label).props.onClick(); }); }

beforeEach(() => {
  vi.resetAllMocks();
  calls.profile.mockResolvedValue(profile());
  calls.inbox.mockResolvedValue(emptyInbox);
  calls.active.mockResolvedValue({ data: { job: null } });
  calls.availability.mockImplementation((is_available: boolean) => Promise.resolve({ is_available }));
  calls.earnings.mockResolvedValue({ completedCount: 0, earnings: 0 });
  calls.categories.mockResolvedValue([category]);
  calls.zones.mockResolvedValue([{ id: "zone-fixture", name: "Zona de prueba", municipality: "Municipio de prueba" }]);
  calls.createProfile.mockResolvedValue(profile());
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
});
afterEach(async () => {
  await act(async () => { for (const renderer of renderers.splice(0)) renderer.unmount(); });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("UI profesional · controles reales y privacidad visual", () => {
  it("el switch tiene descripción propia y mantiene estado controlado durante el guardado", async () => {
    const change = vi.fn();
    const props = { available: false, verified: true, busy: false, onChange: change };
    const renderer = await mount(createElement(ProviderAvailabilityControl, props));
    const control = () => renderer.root.findByProps({ role: "switch" });
    expect(control().props["aria-label"]).toBe("Disponibilidad");
    const description = renderer.root.findByProps({ id: control().props["aria-describedby"] });
    expect(text(description.children)).toContain("Activa tu disponibilidad");
    await act(async () => { control().props.onClick(); });
    expect(change).toHaveBeenCalledExactlyOnceWith(true);
    await act(async () => { renderer.update(createElement(ProviderAvailabilityControl, { ...props, busy: true })); });
    expect(control().props["aria-checked"]).toBe(false);
    expect(control().props.disabled).toBe(true);
    expect(control().props["aria-busy"]).toBe(true);
    await act(async () => { renderer.update(createElement(ProviderAvailabilityControl, { ...props, available: true })); });
    expect(control().props["aria-checked"]).toBe(true);
    expect(control().props.disabled).toBe(false);
    await act(async () => { control().props.onClick(); });
    expect(change).toHaveBeenLastCalledWith(false);
  });

  it("las descripciones de dos switches no comparten identificadores", () => {
    const props = { available: false, verified: true, busy: false, onChange: vi.fn() };
    const html = renderToStaticMarkup(createElement("div", null, createElement(ProviderAvailabilityControl, props), createElement(ProviderAvailabilityControl, props)));
    const ids = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every((id) => html.includes(`id="${id}"`))).toBe(true);
  });

  it("ponerse online con cero solicitudes conserva el vacío normal y todas las vistas", async () => {
    const renderer = await mount(panel());
    expect(calls.inbox).not.toHaveBeenCalled();
    await act(async () => { renderer.root.findByProps({ role: "switch" }).props.onClick(); });
    expect(calls.availability).toHaveBeenCalledExactlyOnceWith(true);
    expect(calls.inbox).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(screen(renderer)).toContain("No hay solicitudes disponibles por ahora");
    expect(screen(renderer)).not.toContain("Te avisaremos");
    expect(renderer.root.findAllByProps({ role: "alert" })).toHaveLength(0);
    expect(action(renderer, "Inicio").props["aria-current"]).toBe("page");
    await click(renderer, "Actividad");
    expect(action(renderer, "Actividad").props["aria-current"]).toBe("page");
    expect(screen(renderer)).toContain("Servicios esta semana");
    await click(renderer, "Perfil");
    expect(screen(renderer)).toContain("Servicios y cobertura");
    expect(screen(renderer)).toContain("Volver al modo cliente");
    expect(screen(renderer)).toContain("Cerrar sesión");
    expect(renderer.root.findByProps({ role: "switch" }).props["aria-checked"]).toBe(true);
  });

  it("un panel conectado sin foto real muestra iniciales y nunca una foto demo", async () => {
    const renderer = await mount(panel());
    expect(renderer.root.findAllByType("img")).toHaveLength(0);
    expect(screen(renderer)).toContain("PD");
    await click(renderer, "Perfil");
    expect(renderer.root.findAllByType("img")).toHaveLength(0);
  });

  it("un perfil sin user conserva el nombre real de la sesión y sus iniciales en ambas vistas", async () => {
    calls.profile.mockResolvedValue({ id: "provider-fixture", is_available: false, verification_status: "verified", provider_service: [], provider_zone: [] });
    const renderer = await mount(panel());
    expect(text(renderer.root.findByType("h1").children)).toBe("Profesional de prueba");
    expect(renderer.root.findAllByProps({ "aria-label": "Avatar de Profesional de prueba" })).toHaveLength(1);
    expect(screen(renderer)).toContain("PD");
    await click(renderer, "Perfil");
    expect(renderer.root.findAllByType("h3").some((heading) => text(heading.children) === "Profesional de prueba")).toBe(true);
    expect(renderer.root.findAllByProps({ "aria-label": "Avatar de Profesional de prueba" })).toHaveLength(2);
    expect(screen(renderer)).not.toContain("Avatar de Proveedor");
    expect(renderer.root.findAllByType("img")).toHaveLength(0);
  });

  it("la foto del API puede fallar y conserva el avatar con iniciales", async () => {
    const image = "https://images.example.test/real-provider-fixture.png";
    calls.profile.mockResolvedValue({ ...profile(), user: { name: "Profesional de prueba", image } });
    const renderer = await mount(panel());
    const photo = renderer.root.findByType("img");
    expect(photo.props.src).toBe(image);
    expect(photo.props.referrerPolicy).toBe("no-referrer");
    await act(async () => { photo.props.onError(); });
    expect(renderer.root.findAllByType("img")).toHaveLength(0);
    expect(screen(renderer)).toContain("PD");
  });

  it("la selección de ETA conserva opciones reales y no acepta hasta elegir una", async () => {
    calls.profile.mockResolvedValue(profile(true));
    calls.inbox.mockResolvedValue({ data: [request], meta: { page: 1, limit: 20, total: 1, pages: 1 } });
    calls.claim.mockResolvedValue(undefined);
    const renderer = await mount(panel());
    expect(screen(renderer)).toContain("Por confirmar");
    await click(renderer, "Aceptar");
    const dialog = renderer.root.findByProps({ role: "dialog" });
    expect(String(dialog.props["aria-modal"])).toBe("true");
    expect(renderer.root.findByProps({ id: dialog.props["aria-labelledby"] })).toBeDefined();
    expect(renderer.root.findByProps({ id: dialog.props["aria-describedby"] })).toBeDefined();
    expect(calls.claim).not.toHaveBeenCalled();
    await click(renderer, "Estimar llegada en 15 minutos");
    expect(calls.claim).toHaveBeenCalledExactlyOnceWith(request.id, 15);
    expect(renderer.root.findAllByProps({ role: "dialog" })).toHaveLength(0);
  });

  it("mantiene el foco dentro del diálogo cuando aceptar deshabilita los controles de ETA", async () => {
    calls.profile.mockResolvedValue(profile(true));
    calls.inbox.mockResolvedValue({ data: [request], meta: { page: 1, limit: 20, total: 1, pages: 1 } });
    let complete!: () => void;
    calls.claim.mockReturnValue(new Promise<void>((resolve) => { complete = resolve; }));
    type FocusNode = { readonly disabled?: boolean; isConnected: boolean; focus: () => void };
    const documentState: { activeElement: FocusNode | null } = { activeElement: null };
    const previous: FocusNode = { isConnected: true, focus: vi.fn(() => { documentState.activeElement = previous; }) };
    documentState.activeElement = previous;
    vi.stubGlobal("document", documentState);
    const nodes = new Map<string, FocusNode>();
    let renderer!: ReactTestRenderer;
    let noControls = false;
    const node = (label: string): FocusNode => {
      if (!nodes.has(label)) nodes.set(label, {
        isConnected: true,
        get disabled() { return Boolean(action(renderer, label).props.disabled); },
        focus() { documentState.activeElement = nodes.get(label)!; },
      });
      return nodes.get(label)!;
    };
    const enabledButtons = () => noControls ? [] : renderer.root.findByProps({ role: "dialog" }).findAllByType("button")
      .filter((button) => !button.props.disabled)
      .map((button) => node(button.props["aria-label"] || text(button.children)));
    const dialogNode = {
      isConnected: true,
      focus: vi.fn(() => { documentState.activeElement = dialogNode; }),
      contains: (element: FocusNode | null) => element === dialogNode || [...nodes.values()].includes(element!),
      querySelector: () => enabledButtons()[0] ?? null,
      querySelectorAll: enabledButtons,
    };
    renderer = await mount(panel(), { createNodeMock: (element) => element.props.role === "dialog" ? dialogNode : null });
    await click(renderer, "Aceptar");
    expect(documentState.activeElement).toBe(node("Estimar llegada en 10 minutos"));
    const tab = (shiftKey = false) => {
      const preventDefault = vi.fn();
      renderer.root.findByProps({ role: "dialog" }).props.onKeyDown({ key: "Tab", shiftKey, preventDefault });
      expect(preventDefault).toHaveBeenCalledOnce();
    };
    documentState.activeElement = previous;
    tab();
    expect(documentState.activeElement).toBe(node("Estimar llegada en 10 minutos"));
    documentState.activeElement = previous;
    tab(true);
    expect(documentState.activeElement).toBe(node("Cancelar"));

    node("Estimar llegada en 15 minutos").focus();
    await click(renderer, "Estimar llegada en 15 minutos");
    expect(calls.claim).toHaveBeenCalledExactlyOnceWith(request.id, 15);
    expect(renderer.root.findByProps({ role: "dialog" }).props["aria-busy"]).toBe(true);
    expect(node("Estimar llegada en 15 minutos").disabled).toBe(true);
    expect(documentState.activeElement).toBe(dialogNode);
    tab();
    expect(documentState.activeElement).toBe(node("Cancelar"));
    documentState.activeElement = node("Estimar llegada en 15 minutos");
    tab(true);
    expect(documentState.activeElement).toBe(node("Cancelar"));
    documentState.activeElement = node("Estimar llegada en 15 minutos");
    tab();
    expect(documentState.activeElement).toBe(node("Cancelar"));
    noControls = true;
    tab();
    expect(documentState.activeElement).toBe(dialogNode);
    tab(true);
    expect(documentState.activeElement).toBe(dialogNode);
    noControls = false;

    await act(async () => { renderer.root.findByProps({ role: "dialog" }).props.onKeyDown({ key: "Escape", preventDefault: vi.fn() }); });
    expect(renderer.root.findAllByProps({ role: "dialog" })).toHaveLength(0);
    expect(documentState.activeElement).toBe(previous);
    await act(async () => { complete(); });
    expect(calls.claim).toHaveBeenCalledOnce();
  });

  it("el esquema de zona no presenta GPS ni recorrido animado ficticio", async () => {
    calls.active.mockResolvedValue({ data: { job: { ...request, status: "on_the_way", address: { line: "Dirección propia de la fixture" } } } });
    const renderer = await mount(panel());
    expect(screen(renderer)).toContain("Esquema de zona · sin seguimiento GPS");
    expect(screen(renderer)).toContain("Dirección propia de la fixture");
    expect(screen(renderer)).toContain("Llegada sin confirmar");
    expect(renderer.root.findAllByType("animateMotion")).toHaveLength(0);
    expect(renderer.root.findAllByType("img")).toHaveLength(0);
  });

  it("un perfil rechazado no se describe como pendiente de revisión", async () => {
    calls.profile.mockResolvedValue({ ...profile(), verification_status: "rejected" });
    const renderer = await mount(panel());
    await click(renderer, "Perfil");
    expect(screen(renderer)).toContain("Perfil no aprobado");
    expect(screen(renderer)).not.toContain("Tu perfil está siendo revisado");
    expect(renderer.root.findByProps({ role: "switch" }).props.disabled).toBe(true);
  });

  it("un servicio completado conserva su sección y disputa sin ofrecer una transición inexistente", async () => {
    calls.active.mockResolvedValue({ data: { job: { ...request, status: "completed", eta_min: 15, price_estimate: "1500", address: { line: "Dirección de la fixture" } } } });
    const renderer = await mount(panel());
    expect(action(renderer, "Esperando confirmación del cliente").props.disabled).toBe(true);
    expect(renderer.root.findByProps({ role: "progressbar" }).props["aria-valuenow"]).toBe(4);
    expect(screen(renderer)).toContain("Trabajo en curso");
    expect(screen(renderer)).toContain("Abrir disputa sobre este servicio");
    expect(screen(renderer)).not.toContain("Completar servicio");
  });
});

describe("UI profesional · alta persistente con controles nativos", () => {
  it("conserva selecciones, payload y guard del formulario durante el envío", async () => {
    let finish!: () => void;
    calls.createProfile.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    const created = vi.fn();
    const renderer = await mount(createElement(ProviderProfileSetup, { onCreated: created, onBack: vi.fn() }));
    const form = () => renderer.root.findByType("form");
    const submit = () => renderer.root.findAllByType("button").find((button) => button.props.type === "submit")!;
    expect(submit().props.disabled).toBe(true);
    for (const checkbox of renderer.root.findAllByType("input").filter((input) => input.props.type === "checkbox")) {
      await act(async () => { checkbox.props.onChange({ target: { checked: true } }); });
    }
    expect(submit().props.disabled).toBe(false);
    expect(screen(renderer)).toContain("1 servicio seleccionado");
    expect(screen(renderer)).toContain("1 zona seleccionada");
    await act(async () => { void form().props.onSubmit({ preventDefault: vi.fn() }); });
    expect(calls.createProfile).toHaveBeenCalledExactlyOnceWith({ bio: "", category_ids: [category.id], zone_ids: ["zone-fixture"] });
    expect(form().props["aria-busy"]).toBe(true);
    expect(submit().props.disabled).toBe(true);
    expect(renderer.root.findAllByType("fieldset").every((fieldset) => fieldset.props.disabled)).toBe(true);
    await act(async () => { await form().props.onSubmit({ preventDefault: vi.fn() }); });
    expect(calls.createProfile).toHaveBeenCalledOnce();
    await act(async () => { finish(); });
    expect(created).toHaveBeenCalledOnce();
  });
});
