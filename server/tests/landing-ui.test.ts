import { createElement, type ReactElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Landing, LandingCatalog, LandingProviders } from "../../src/features/landing/Landing";
import type { PublicProvider } from "../../src/lib/api";

const calls = vi.hoisted(() => ({
  categories: vi.fn(), directory: vi.fn(), zones: vi.fn(), signin: vi.fn(),
  intent: vi.fn(), session: vi.fn(), scroll: vi.fn(), focus: vi.fn(),
}));
vi.mock("../../src/lib/api", () => ({
  api: { categories: { list: calls.categories }, providersPublic: { list: calls.directory } },
  authApi: { signIn: calls.signin, signUp: vi.fn() },
}));
vi.mock("../../src/lib/profile-api", () => ({ profileApi: { zones: calls.zones } }));
vi.mock("../../src/lib/state", async (original) => ({
  ...await original<typeof import("../../src/lib/state")>(), setIntent: calls.intent, setSession: calls.session,
}));

const category = { id: "real-opaque-category", name: "Electricidad", icon: "plug", group_name: "Hogar" };
const zones = [
  { id: "zone-first", name: "Zona del catálogo", municipality: "Municipio del catálogo" },
  { id: "zone-second", name: "Otra zona del catálogo", municipality: "Municipio del catálogo" },
];
const provider = (name: string): PublicProvider => ({
  id: `profile-${name}`, name, image: null, business_name: null,
  rating: 0, reviews_count: 0, is_available: true, avg_eta_min: null,
  categories: [category], zones: [zones[0]],
});
const page = (profiles: PublicProvider[]) => ({
  data: profiles, meta: { page: 1, limit: 6, total: profiles.length, pages: 1 },
});
const renderers: ReactTestRenderer[] = [];
function text(node: unknown): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(text).join(" ").trim();
  if (node && typeof node === "object" && "children" in node) return text(node.children);
  return "";
}
const screenText = (renderer: ReactTestRenderer) => text(renderer.toJSON());
const button = (renderer: ReactTestRenderer, label: string) => {
  const found = renderer.root.findAllByType("button").find((node) => text(node.children) === label);
  if (!found) throw new Error(`Missing landing button: ${label}`);
  return found;
};
async function mount(element: ReactElement) {
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(element); });
  renderers.push(renderer);
  return renderer;
}
function Location() {
  const location = useLocation();
  return createElement("output", { "aria-label": "Ruta actual" }, location.pathname);
}
const landing = () => createElement(MemoryRouter, null, createElement(Landing), createElement(Location));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetAllMocks();
  calls.categories.mockResolvedValue([category]);
  calls.directory.mockResolvedValue(page([provider("Perfil real del API")]));
  calls.zones.mockResolvedValue(zones);
  calls.signin.mockResolvedValue({ id: "customer-fixture", role: "customer", name: "Cliente de prueba" });
  vi.stubGlobal("window", {
    matchMedia: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    scrollTo: calls.scroll,
  });
});
afterEach(async () => {
  await act(async () => { for (const renderer of renderers.splice(0)) renderer.unmount(); });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Landing: navegación, contenido y estados de UI", () => {
  it("la búsqueda conserva la categoría real al atravesar login y navegación", async () => {
    const renderer = await mount(landing());
    await act(async () => { renderer.root.findByProps({ "aria-label": "Buscar un servicio" }).props.onChange({ target: { value: "  ELECTRI " } }); });
    await act(async () => { renderer.root.findByProps({ role: "search" }).props.onSubmit({ preventDefault: vi.fn() }); });
    expect(screenText(renderer)).toContain("Crea tu cuenta");
    const dialog = renderer.root.findByProps({ role: "dialog" });
    await act(async () => { dialog.findAllByType("button").find((node) => text(node.children) === "Iniciar sesión")!.props.onClick(); });
    await act(async () => {
      renderer.root.findByProps({ "aria-label": "Correo electrónico" }).props.onChange({ target: { value: "fixture@example.invalid" } });
      renderer.root.findByProps({ "aria-label": "Contraseña" }).props.onChange({ target: { value: "FixturePassword123!" } });
    });
    const authForm = renderer.root.findAllByType("form").find((form) => form.findAllByType("input").some((input) => input.props["aria-label"] === "Correo electrónico"))!;
    await act(async () => { await authForm.props.onSubmit({ preventDefault: vi.fn() }); });
    expect(calls.signin).toHaveBeenCalledExactlyOnceWith({ email: "fixture@example.invalid", password: "FixturePassword123!" });
    expect(calls.intent).toHaveBeenCalledWith({ t: "results", catId: category.id });
    expect(text(renderer.root.findByProps({ "aria-label": "Ruta actual" }).children)).toBe(`/app/servicios/${category.id}`);
  });

  it("las categorías y ambas acciones de cada profesional mantienen sus IDs reales", async () => {
    const pick = vi.fn(), retry = vi.fn();
    const catalog = await mount(createElement(LandingCatalog, { categories: [category], loading: false, error: "", onRetry: retry, onPick: pick }));
    await act(async () => { catalog.root.findByType("button").props.onClick(); });
    expect(pick).toHaveBeenLastCalledWith({ t: "results", catId: category.id });
    const profile = provider("Perfil de prueba");
    const directory = await mount(createElement(LandingProviders, { providers: [profile], loading: false, error: "", onRetry: retry, onPick: pick }));
    await act(async () => { button(directory, "Ver perfil").props.onClick(); });
    expect(pick).toHaveBeenLastCalledWith({ t: "pro", id: profile.id });
    await act(async () => { button(directory, "Solicitar servicio").props.onClick(); });
    expect(pick).toHaveBeenLastCalledWith({ t: "request", proId: profile.id });
  });

  it("el directorio filtra por zona sin publicar una respuesta anterior al cambiarla", async () => {
    const stale = deferred<ReturnType<typeof page>>();
    calls.directory.mockResolvedValueOnce(page([provider("Perfil inicial")]))
      .mockReturnValueOnce(stale.promise).mockResolvedValueOnce(page([provider("Perfil vigente")]));
    const renderer = await mount(landing());
    expect(calls.directory).toHaveBeenLastCalledWith({ available: true, sort: "rating", limit: 6 });
    await act(async () => { renderer.root.findByProps({ id: "landing-zone" }).props.onChange({ target: { value: zones[1].id } }); });
    expect(screenText(renderer)).toContain("Cargando profesionales");
    expect(screenText(renderer)).not.toContain("Perfil inicial");
    await act(async () => { renderer.root.findByProps({ id: "landing-zone" }).props.onChange({ target: { value: zones[0].id } }); });
    await act(async () => { stale.resolve(page([provider("Perfil obsoleto")])); });
    expect(calls.directory).toHaveBeenLastCalledWith({ zone: zones[0].id, available: true, sort: "rating", limit: 6 });
    expect(screenText(renderer)).toContain("Perfil vigente");
    expect(screenText(renderer)).not.toContain("Perfil obsoleto");
  });

  it("un error de catálogo conserva el directorio y el reintento recupera las categorías", async () => {
    calls.categories.mockRejectedValueOnce(new Error("offline fixture failure")).mockResolvedValueOnce([category]);
    const renderer = await mount(landing());
    const services = renderer.root.findByProps({ id: "servicios" });
    expect(text(services.children)).toContain("No pudimos cargar los servicios");
    expect(screenText(renderer)).toContain("Perfil real del API");
    await act(async () => { services.findAllByType("button").find((node) => text(node.children) === "Reintentar")!.props.onClick(); });
    expect(text(renderer.root.findByProps({ id: "servicios" }).children)).toContain("Electricidad");
    expect(renderer.root.findAllByProps({ role: "alert" })).toHaveLength(0);
    expect(calls.categories).toHaveBeenCalledTimes(2);
  });

  it("un directorio vacío conserva la creación de solicitudes y no finge un error", async () => {
    calls.directory.mockResolvedValue(page([]));
    const renderer = await mount(landing());
    expect(screenText(renderer)).toContain("No hay resultados disponibles por ahora");
    expect(renderer.root.findAllByProps({ role: "alert" })).toHaveLength(0);
    await act(async () => { button(renderer, "Crear una solicitud").props.onClick(); });
    expect(screenText(renderer)).toContain("Crea tu cuenta");
    expect(calls.signin).not.toHaveBeenCalled();
    expect(calls.intent).not.toHaveBeenCalled();
  });

  it("las preguntas tienen controles nativos y la navegación profesional sigue activa", async () => {
    const renderer = await mount(landing());
    const questions = renderer.root.findAllByType("details");
    expect(questions).toHaveLength(5);
    for (const question of questions) {
      expect(question.findAllByType("summary")).toHaveLength(1);
      expect(text(question.children).length).toBeGreaterThan(40);
    }
    expect(screenText(renderer)).toContain("La dirección exacta no aparece en el directorio público");
    await act(async () => { button(renderer, "Quiero ofrecer servicios").props.onClick(); });
    expect(text(renderer.root.findByProps({ "aria-label": "Ruta actual" }).children)).toBe("/proveedores");
  });

  it("el menú móvil y el salto de contenido no alteran la ruta HashRouter y respetan movimiento reducido", async () => {
    const renderer = await mount(landing());
    vi.stubGlobal("HTMLElement", class {});
    vi.stubGlobal("document", {
      activeElement: null, body: { style: { overflow: "" } },
      getElementById: vi.fn(() => ({ focus: calls.focus, scrollIntoView: calls.scroll })),
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }), scrollTo: calls.scroll });
    await act(async () => { button(renderer, "Ir al contenido principal").props.onClick(); });
    expect(calls.focus).toHaveBeenCalledTimes(1);
    expect(calls.scroll).toHaveBeenLastCalledWith({ behavior: "auto", block: "start" });
    expect(text(renderer.root.findByProps({ "aria-label": "Ruta actual" }).children)).toBe("/");
    const menu = renderer.root.findByProps({ "aria-label": "Abrir menú" });
    expect(menu.props["aria-expanded"]).toBe(false);
    await act(async () => { menu.props.onClick(); });
    expect(renderer.root.findByProps({ "aria-label": "Abrir menú" }).props["aria-expanded"]).toBe(true);
    const dialog = renderer.root.findByProps({ role: "dialog" });
    await act(async () => { dialog.findAllByType("button").find((node) => text(node.children) === "Preguntas")!.props.onClick(); });
    expect(renderer.root.findAllByProps({ role: "dialog" })).toHaveLength(0);
    expect(calls.scroll).toHaveBeenLastCalledWith({ behavior: "auto", block: "start" });
    expect(text(renderer.root.findByProps({ "aria-label": "Ruta actual" }).children)).toBe("/");
  });
});
