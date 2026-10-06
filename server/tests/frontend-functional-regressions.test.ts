import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { MemoryRouter } from "react-router-dom";
import { ResultsView } from "../../src/features/client/Home";
import { ProApp } from "../../src/features/provider/ProApp";
import { DisputeView } from "../../src/features/client/DisputeView";
import { ProDisputeView } from "../../src/features/provider/ProDisputeView";
import { ToastProvider } from "../../src/components/Toast";
import { Landing } from "../../src/features/landing/Landing";
import { ApiHttpError } from "../../src/lib/http";

// API interceptada: estos componentes no conectan a ningún servidor ni base.
const calls = vi.hoisted(() => ({
  categories: vi.fn(), directory: vi.fn(), profile: vi.fn(), inbox: vi.fn(), active: vi.fn(),
  availability: vi.fn(), disputes: vi.fn(), earnings: vi.fn(), signup: vi.fn(), signin: vi.fn(),
}));
vi.mock("../../src/lib/api", () => ({
  authApi: { signOut: vi.fn(), signUp: calls.signup, signIn: calls.signin },
  api: {
    categories: { list: calls.categories },
    providersPublic: { list: calls.directory },
    providers: {
      getMe: calls.profile, getInbox: calls.inbox, getActiveJob: calls.active,
      setAvailability: calls.availability, getEarnings: calls.earnings,
    },
    disputes: { list: calls.disputes },
  },
}));
vi.mock("../../src/lib/profile-api", () => ({
  profileApi: { zones: async () => [{ id: "zone-fixture", name: "Zona de prueba", municipality: "Municipio de prueba" }] },
}));

const renderers: ReactTestRenderer[] = [];
const category = { id: "category-fixture", name: "Servicio de prueba", icon: "wrench", group_name: "Hogar" };
const professional = (id: string) => ({
  id, name: id, image: null, business_name: null, rating: 0, reviews_count: 0,
  avg_eta_min: null, is_available: true, categories: [category], zones: [{ id: "zone-fixture", name: "Zona de prueba" }],
});
const request = (id: string) => ({ id, description: id, category, zone: { name: "Zona de prueba" }, customer: { name: "Cliente de prueba" } });
const inboxPage = (page: number, total: number) => ({
  data: Array.from({ length: Math.max(0, Math.min(20, total - (page - 1) * 20)) }, (_, index) => request(`request-${(page - 1) * 20 + index + 1}`)),
  meta: { page, limit: 20, total, pages: Math.max(1, Math.ceil(total / 20)) },
});
const directoryPage = (page: number, total: number, id = `professional-page-${page}`) => ({
  data: total > (page - 1) * 20 ? [professional(id)] : [],
  meta: { page, limit: 20, total, pages: Math.max(1, Math.ceil(total / 20)) },
});
const dispute = (status: "open" | "resolved_customer" = "open") => ({
  id: "dispute-fixture", request_id: "request-fixture", reason: "Motivo de prueba", status,
  created_at: "2026-10-06T12:00:00.000Z", updated_at: "2026-10-06T12:00:00.000Z",
  ...(status !== "open" ? { resolution: "Resolución de prueba completada", resolver: { name: "Moderador de prueba" } } : {}),
});
const responseWithDispute = (status: "open" | "resolved_customer") => ({ data: [dispute(status)] });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function text(node: unknown): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (node && typeof node === "object" && "children" in node) return text(node.children);
  return "";
}
const screenText = (renderer: ReactTestRenderer) => text(renderer.toJSON());
const button = (renderer: ReactTestRenderer, label: string) => {
  const found = renderer.root.findAllByType("button").find((node) => text(node.children) === label);
  if (!found) throw new Error(`Missing test button: ${label}`);
  return found;
};
async function click(renderer: ReactTestRenderer, label: string) {
  await act(async () => { button(renderer, label).props.onClick(); });
}
async function mount(element: ReactElement) {
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(element); });
  renderers.push(renderer);
  return renderer;
}
const results = () => createElement(ResultsView, { catId: category.id, go: vi.fn() });
const provider = () => createElement(ToastProvider, {
  children: createElement(MemoryRouter, null, createElement(ProApp)),
});
const landing = () => createElement(MemoryRouter, null, createElement(Landing));
const authForm = (renderer: ReactTestRenderer) => renderer.root.findAllByType("form")
  .find((form) => form.findAllByType("input").some((input) => input.props["aria-label"] === "Correo electrónico"))!;
const lastButton = (renderer: ReactTestRenderer, label: string) => renderer.root.findAllByType("button")
  .filter((node) => text(node.children) === label).at(-1)!;
async function enter(renderer: ReactTestRenderer, label: string, value: string) {
  await act(async () => { renderer.root.findByProps({ "aria-label": label }).props.onChange({ target: { value } }); });
}

beforeEach(() => {
  vi.resetAllMocks();
  calls.categories.mockResolvedValue([category]);
  calls.directory.mockImplementation(({ page = 1 }) => Promise.resolve(directoryPage(page, 21)));
  calls.profile.mockResolvedValue({
    id: "provider-fixture", verification_status: "verified", is_available: true,
    user: { name: "Profesional de prueba" }, provider_service: [], provider_zone: [],
  });
  calls.inbox.mockImplementation(({ page = 1 }) => Promise.resolve(inboxPage(page, 21)));
  calls.active.mockResolvedValue({ data: { job: null } });
  calls.availability.mockImplementation((is_available) => Promise.resolve({ is_available }));
  calls.disputes.mockResolvedValue({ data: [] });
  vi.stubGlobal("window", {
    matchMedia: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
});
afterEach(async () => {
  await act(async () => { for (const renderer of renderers.splice(0)) renderer.unmount(); });
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("directorio cliente: navegación y contratos reales de React", () => {
  it("consulta la última página válida cuando el catálogo disminuye", async () => {
    calls.directory.mockResolvedValueOnce(directoryPage(1, 21))
      .mockResolvedValueOnce(directoryPage(2, 20))
      .mockResolvedValueOnce(directoryPage(1, 20, "remaining-professional"));
    const renderer = await mount(results());
    await click(renderer, "Siguiente");

    expect(calls.directory.mock.calls.map(([params]) => params.page)).toEqual([1, 2, 1]);
    expect(calls.directory.mock.calls.every(([params]) => params.limit === 20)).toBe(true);
    expect(screenText(renderer)).toContain("remaining-professional");
    expect(screenText(renderer)).not.toContain("No hay resultados disponibles");
  });

  it("muestra carga, limita navegación y conserva el filtro", async () => {
    const next = deferred<ReturnType<typeof directoryPage>>();
    calls.directory.mockResolvedValueOnce(directoryPage(1, 21)).mockReturnValueOnce(next.promise);
    const renderer = await mount(results());
    expect(button(renderer, "Anterior").props.disabled).toBe(true);
    await click(renderer, "Siguiente");
    expect(screenText(renderer)).toContain("Cargando servicios");
    expect(button(renderer, "Anterior").props.disabled).toBe(true);
    expect(button(renderer, "Siguiente").props.disabled).toBe(true);
    await act(async () => { next.resolve(directoryPage(2, 21)); });
    expect(button(renderer, "Siguiente").props.disabled).toBe(true);
    expect(button(renderer, "Anterior").props.disabled).toBe(false);
    await click(renderer, "Anterior");
    expect(calls.directory.mock.calls.map(([params]) => params.page)).toEqual([1, 2, 1]);
  });

  it("descarta la respuesta de una página anterior al cambiar disponibilidad", async () => {
    const stale = deferred<ReturnType<typeof directoryPage>>();
    calls.directory.mockResolvedValueOnce(directoryPage(1, 21))
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce(directoryPage(1, 1, "filtered-professional"));
    const renderer = await mount(results());
    await click(renderer, "Siguiente");
    await act(async () => {
      renderer.root.findByType("input").props.onChange({ target: { checked: true } });
    });
    await act(async () => { stale.resolve(directoryPage(2, 21, "stale-professional")); });
    expect(screenText(renderer)).toContain("filtered-professional");
    expect(screenText(renderer)).not.toContain("stale-professional");
    expect(calls.directory).toHaveBeenLastCalledWith({ category: category.id, available: true, page: 1, limit: 20 });
  });

  it.each([
    { ...directoryPage(1, 1), meta: { page: 1, total: 1, pages: 0 } },
    { ...directoryPage(1, 1), meta: { page: 2, total: 1, pages: 1 } },
    { ...directoryPage(1, 1), meta: { page: 1, total: 1, pages: Number.NaN } },
  ])("metadata inválida muestra error recuperable", async (response) => {
    calls.directory.mockResolvedValueOnce(response).mockResolvedValueOnce(directoryPage(1, 1));
    const renderer = await mount(results());
    expect(screenText(renderer)).toContain("No pudimos cargar los profesionales");
    expect(screenText(renderer)).not.toContain("No hay resultados disponibles");
    await click(renderer, "Reintentar");
    expect(screenText(renderer)).toContain("professional-page-1");
  });

  it("cero profesionales es vacío normal y conserva creación de solicitud", async () => {
    calls.directory.mockResolvedValue(directoryPage(1, 0));
    const renderer = await mount(results());
    expect(screenText(renderer)).toContain("No hay resultados disponibles por ahora");
    expect(screenText(renderer)).not.toContain("No pudimos cargar");
    expect(button(renderer, "Crear solicitud en tu zona")).toBeDefined();
  });
});

describe("inbox profesional: páginas, estados y dirección privada del trabajo", () => {
  it("navega páginas de 20 sin cargar todo el dataset", async () => {
    const renderer = await mount(provider());
    expect(screenText(renderer)).toContain("request-20");
    expect(screenText(renderer)).not.toContain("request-21");
    expect(button(renderer, "Anterior").props.disabled).toBe(true);
    await click(renderer, "Siguiente");
    expect(screenText(renderer)).toContain("request-21");
    expect(screenText(renderer)).not.toContain("request-20");
    expect(button(renderer, "Siguiente").props.disabled).toBe(true);
    await click(renderer, "Anterior");
    expect(calls.inbox.mock.calls.map(([params]) => params)).toEqual([
      { page: 1, limit: 20 }, { page: 2, limit: 20 }, { page: 1, limit: 20 },
    ]);
  });

  it("mantiene límites desactivados durante la carga de otra página", async () => {
    const next = deferred<ReturnType<typeof inboxPage>>();
    calls.inbox.mockResolvedValueOnce(inboxPage(1, 21)).mockReturnValueOnce(next.promise);
    const renderer = await mount(provider());
    await click(renderer, "Siguiente");
    expect(screenText(renderer)).toContain("Cargando solicitudes");
    expect(button(renderer, "Anterior").props.disabled).toBe(true);
    expect(button(renderer, "Siguiente").props.disabled).toBe(true);
    await act(async () => { next.resolve(inboxPage(2, 21)); });
    expect(screenText(renderer)).toContain("request-21");
  });

  it("polling corrige una página desaparecida sin confundirla con inbox vacío", async () => {
    vi.useFakeTimers();
    calls.inbox.mockResolvedValueOnce(inboxPage(1, 21)).mockResolvedValueOnce(inboxPage(2, 21))
      .mockResolvedValueOnce(inboxPage(2, 20)).mockResolvedValueOnce(inboxPage(1, 20));
    const renderer = await mount(provider());
    await click(renderer, "Siguiente");
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(calls.inbox.mock.calls.map(([params]) => params.page)).toEqual([1, 2, 2, 1]);
    expect(screenText(renderer)).toContain("request-20");
    expect(screenText(renderer)).not.toContain("No hay solicitudes disponibles");
  });

  it("error real conserva reintento y vuelve a la página actual", async () => {
    calls.inbox.mockResolvedValueOnce(inboxPage(1, 21)).mockRejectedValueOnce(new Error("fixture failure"))
      .mockResolvedValueOnce(inboxPage(2, 21));
    const renderer = await mount(provider());
    await click(renderer, "Siguiente");
    expect(screenText(renderer)).toContain("No pudimos cargar las solicitudes");
    expect(screenText(renderer)).not.toContain("request-1");
    await click(renderer, "Reintentar");
    expect(screenText(renderer)).toContain("request-21");
    expect(calls.inbox).toHaveBeenLastCalledWith({ page: 2, limit: 20 });
  });

  it("cero solicitudes conserva el estado Online y sus controles", async () => {
    calls.inbox.mockResolvedValue(inboxPage(1, 0));
    const renderer = await mount(provider());
    expect(screenText(renderer)).toContain("No hay solicitudes disponibles por ahora");
    expect(screenText(renderer)).not.toContain("No pudimos cargar las solicitudes");
    const toggle = renderer.root.findByProps({ role: "switch" });
    expect(toggle.props["aria-checked"]).toBe(true);
    expect(toggle.props.disabled).toBe(false);
    await act(async () => { toggle.props.onClick(); });
    expect(calls.availability).toHaveBeenCalledWith(false);
    expect(renderer.root.findByProps({ role: "switch" }).props["aria-checked"]).toBe(false);
  });

  it("no consulta prematuramente ni publica una respuesta anterior al pasar Offline", async () => {
    const profile = deferred<Record<string, unknown>>();
    calls.profile.mockReturnValueOnce(profile.promise);
    const renderer = await mount(provider());
    expect(calls.inbox).not.toHaveBeenCalled();
    const stale = deferred<ReturnType<typeof inboxPage>>();
    calls.inbox.mockReturnValueOnce(stale.promise);
    await act(async () => {
      profile.resolve({ id: "provider-fixture", verification_status: "verified", is_available: true, user: { name: "Profesional de prueba" } });
    });
    await act(async () => { renderer.root.findByProps({ role: "switch" }).props.onClick(); });
    await act(async () => { stale.resolve(inboxPage(1, 21)); });
    expect(screenText(renderer)).toContain("Estás fuera de línea");
    expect(screenText(renderer)).not.toContain("request-1");
  });

  it("metadata incompleta produce error recuperable, no falso vacío", async () => {
    calls.inbox.mockResolvedValueOnce({ data: [], meta: { page: 1, total: 0, pages: 1 } })
      .mockResolvedValueOnce(inboxPage(1, 0));
    const renderer = await mount(provider());
    expect(screenText(renderer)).toContain("No pudimos cargar las solicitudes");
    await click(renderer, "Reintentar");
    expect(screenText(renderer)).toContain("No hay solicitudes disponibles por ahora");
  });

  it.each(["Calle de prueba, número 123\nReferencia de prueba", null])("muestra dirección existente o límite honesto: %s", async (line) => {
    calls.active.mockResolvedValue({ data: { job: {
      id: "active-fixture", status: "accepted", eta_min: 15, category, zone: { name: "Zona de prueba" },
      description: "Servicio en curso de prueba", customer: { name: "Cliente de prueba", email: "not-rendered@example.invalid" },
      address: line ? { line } : null,
    } } });
    const renderer = await mount(provider());
    expect(screenText(renderer)).toContain("Dirección del servicio");
    expect(screenText(renderer)).toContain(line || "El cliente todavía no proporcionó una dirección exacta");
    expect(screenText(renderer)).not.toContain("not-rendered@example.invalid");
    expect(button(renderer, "Ir hacia el cliente")).toBeDefined();
  });
});

describe("AuthSheet: petición pendiente y accesibilidad sin cambiar el diseño", () => {
  it("registro pendiente impide cerrar, cambiar modo o editar sus credenciales", async () => {
    const pending = deferred<unknown>();
    calls.signup.mockReturnValueOnce(pending.promise);
    const renderer = await mount(landing());
    await click(renderer, "Crear cuenta");
    await enter(renderer, "Nombre completo", "Nombre de prueba");
    await enter(renderer, "Correo electrónico", "fixture@example.invalid");
    await enter(renderer, "Contraseña", "FixturePassword123!");
    await act(async () => { void authForm(renderer).props.onSubmit({ preventDefault: vi.fn() }); });

    expect(renderer.root.findByProps({ "aria-label": "Correo electrónico" }).props.disabled).toBe(true);
    expect(lastButton(renderer, "Iniciar sesión").props.disabled).toBe(true);
    await act(async () => {
      for (const close of renderer.root.findAllByProps({ "aria-label": "Cerrar" })) close.props.onClick();
      lastButton(renderer, "Iniciar sesión").props.onClick();
    });
    await enter(renderer, "Correo electrónico", "changed@example.invalid");
    await enter(renderer, "Contraseña", "ChangedFixturePassword123!");
    expect(screenText(renderer)).toContain("Crea tu cuenta");
    expect(renderer.root.findByProps({ "aria-label": "Correo electrónico" }).props.value).toBe("fixture@example.invalid");
    expect(renderer.root.findByProps({ "aria-label": "Contraseña" }).props.value).toBe("FixturePassword123!");
    expect(calls.signup).toHaveBeenCalledExactlyOnceWith({ name: "Nombre de prueba", email: "fixture@example.invalid", password: "FixturePassword123!" });
    await act(async () => { pending.resolve({ token: null, user: { id: "fixture" } }); });
    expect(screenText(renderer)).toContain("Verifica tu correo");
    expect(screenText(renderer)).toContain("fixture@example.invalid");
    expect(screenText(renderer)).not.toContain("changed@example.invalid");
  });

  it("login rechazado conserva el contexto bloqueado y restaura controles/reintento", async () => {
    const pending = deferred<unknown>();
    calls.signin.mockReturnValueOnce(pending.promise);
    const renderer = await mount(landing());
    await click(renderer, "Iniciar sesión");
    await enter(renderer, "Correo electrónico", "fixture@example.invalid");
    await enter(renderer, "Contraseña", "FixturePassword123!");
    await act(async () => { void authForm(renderer).props.onSubmit({ preventDefault: vi.fn() }); });
    await act(async () => {
      button(renderer, "Registrarme").props.onClick();
      for (const close of renderer.root.findAllByProps({ "aria-label": "Cerrar" })) close.props.onClick();
    });
    expect(screenText(renderer)).toContain("Bienvenido de vuelta");
    expect(renderer.root.findByProps({ "aria-label": "Contraseña" }).props.autoComplete).toBe("current-password");
    await act(async () => { pending.reject(new ApiHttpError(401, "INVALID_EMAIL_OR_PASSWORD", "fixture rejection")); });
    expect(screenText(renderer)).toContain("Correo o contraseña incorrectos");
    expect(renderer.root.findAllByProps({ role: "alert" })).toHaveLength(1);
    expect(renderer.root.findByProps({ "aria-label": "Correo electrónico" }).props.disabled).toBe(false);
    expect(button(renderer, "Registrarme").props.disabled).toBe(false);
    await act(async () => { renderer.root.findAllByProps({ "aria-label": "Cerrar" })[0].props.onClick(); });
    expect(renderer.root.findAllByProps({ "aria-label": "Correo electrónico" })).toHaveLength(0);
  });

  it("campos tienen nombres accesibles y autocomplete del modo correspondiente", async () => {
    const renderer = await mount(landing());
    await click(renderer, "Crear cuenta");
    expect(renderer.root.findByProps({ "aria-label": "Nombre completo" }).props.autoComplete).toBe("name");
    expect(renderer.root.findByProps({ "aria-label": "Correo electrónico" }).props.autoComplete).toBe("email");
    expect(renderer.root.findByProps({ "aria-label": "Teléfono (opcional)" }).props.autoComplete).toBe("tel");
    expect(renderer.root.findByProps({ "aria-label": "Contraseña" }).props.autoComplete).toBe("new-password");
    await act(async () => { lastButton(renderer, "Iniciar sesión").props.onClick(); });
    expect(renderer.root.findByProps({ "aria-label": "Contraseña" }).props.autoComplete).toBe("current-password");
  });
});
