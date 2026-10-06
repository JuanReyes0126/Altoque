/** Admin UI: navegación, semántica accesible y acciones conservadas. Sin red. */
import { createElement } from "react";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminHome } from "../../src/features/admin/AdminHome";
import { PATHS } from "../../src/lib/router";

const mocks = vi.hoisted(() => ({
  admin: {
    getMetrics: vi.fn(), getUsers: vi.fn(), getProviders: vi.fn(), getRequests: vi.fn(),
    getDisputes: vi.fn(), getAuditLogs: vi.fn(), approveProvider: vi.fn(),
    rejectProvider: vi.fn(), resolveDispute: vi.fn(),
  },
  retry: vi.fn(), onPage: vi.fn(), toast: vi.fn(), navigate: vi.fn(), endSession: vi.fn(),
  metrics: {
    users: 12, providers: 3, providersVerified: 2, pendingProviders: 1,
    requestsTotal: 7, requestsActive: 2, requestsCompleted: 4, openDisputes: 1, avgRating: 4.2,
  },
  rows: {
    users: [
      { id: "ui-user-1", name: "Cuenta UI", email: "account@example.invalid", role: "customer", status: "active", emailVerified: true },
      { id: "ui-user-2", name: "Cuenta sin verificar", email: "pending@example.invalid", role: "customer", status: "active", emailVerified: false },
    ],
    providers: [{ id: "ui-provider", user: { name: "Profesional UI" }, verification_status: "pending_verification", provider_service: [], provider_zone: [] }],
    requests: [{ id: "ui-request", code: "E2E-UI", status: "searching", description: "Solicitud de prueba UI", category: { name: "Servicio UI" }, zone: { name: "Zona UI" }, customer: { name: "Cuenta UI" } }],
    disputes: [{ id: "ui-dispute", status: "open", reason: "Motivo de prueba UI", request: { code: "E2E-UI" }, opener: { name: "Cuenta UI" } }],
    audit: [{ id: "ui-audit", at: "2026-10-06T12:00:00.000Z", actor: { name: "Revisor UI" }, action: "PROVIDER_APPROVED", entity_type: "provider", entity_id: "ui-provider" }],
  },
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("../../src/lib/state", () => ({ useApp: () => ({ session: { name: "Revisor UI", role: "admin" } }) }));
vi.mock("../../src/components/Toast", () => ({ useToast: () => ({ showToast: mocks.toast }) }));
vi.mock("../../src/lib/api", () => ({ api: { admin: mocks.admin } }));
vi.mock("../../src/lib/session-actions", () => ({ endCurrentSession: () => mocks.endSession() }));
vi.mock("../../src/lib/use-api-polling", () => ({ useApiPolling: () => ({ data: mocks.metrics, loading: false, error: "", retry: mocks.retry }) }));
vi.mock("../../src/features/admin/use-admin-pagination", () => ({
  useAdminPagination: (load: unknown) => {
    const data = load === mocks.admin.getUsers ? mocks.rows.users
      : load === mocks.admin.getProviders ? mocks.rows.providers
      : load === mocks.admin.getRequests ? mocks.rows.requests
      : load === mocks.admin.getDisputes ? mocks.rows.disputes : mocks.rows.audit;
    return { data, page: 1, meta: { page: 1, limit: 20, total: data.length, pages: 1 }, loading: false, error: "", retry: mocks.retry, goToPage: mocks.onPage };
  },
}));

let renderer: ReactTestRenderer | undefined;
function text(node: ReactTestInstance | string): string {
  return typeof node === "string" ? node : node.children.map(text).join("");
}
function mount() {
  act(() => { renderer = create(createElement(AdminHome)); });
  return renderer!;
}
function button(view: ReactTestRenderer, label: string) {
  const found = view.root.findAllByType("button").find((node) => text(node) === label);
  if (!found) throw new Error("ADMIN_UI_BUTTON_MISSING");
  return found;
}
function navigate(view: ReactTestRenderer, label: string) {
  act(() => { button(view, label).props.onClick(); });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.approveProvider.mockResolvedValue(undefined);
  mocks.admin.rejectProvider.mockResolvedValue(undefined);
  mocks.admin.resolveDispute.mockResolvedValue(undefined);
  mocks.endSession.mockResolvedValue(undefined);
});
afterEach(() => { act(() => { renderer?.unmount(); }); renderer = undefined; });

describe("Admin · presentación y accesibilidad sin cambiar contratos", () => {
  it("conserva las seis secciones y anuncia la selección y el contenido asociado", () => {
    const view = mount();
    const navigation = view.root.findByProps({ "aria-label": "Secciones de administración" });
    expect(navigation.findAllByType("button").map(text)).toEqual(["Dashboard", "Usuarios", "Proveedores", "Solicitudes", "Disputas", "Auditoría"]);
    expect(button(view, "Dashboard").props["aria-pressed"]).toBe(true);
    expect(view.root.findByType("main").props["aria-labelledby"]).toBe("admin-section-title");
    navigate(view, "Solicitudes");
    expect(button(view, "Solicitudes").props["aria-pressed"]).toBe(true);
    expect(button(view, "Dashboard").props["aria-pressed"]).toBe(false);
    expect(text(view.root.findByProps({ id: "admin-section-title" }))).toBe("Solicitudes");
    expect(text(view.root)).toContain("Solicitud de prueba UI");
  });

  it("muestra métricas de la respuesta y conserva todas las áreas del dashboard", () => {
    const view = mount();
    expect(view.root.findAllByType("dt").map(text)).toEqual(["Usuarios", "Proveedores", "Verificados", "Pendientes", "Solicitudes Total", "Activas", "Completadas", "Disputas Abiertas"]);
    expect(view.root.findAllByType("dd").map(text)).toEqual(["12", "3", "2", "1", "7", "2", "4", "1"]);
    expect(text(view.root)).toContain("4.2/ 5");
  });

  it("las tablas conservan columnas completas, caption y acceso por teclado al scroll", () => {
    const view = mount();
    navigate(view, "Usuarios");
    expect(view.root.findByProps({ "aria-label": "Tabla de usuarios" }).props.tabIndex).toBe(0);
    expect(view.root.findAllByType("th").map((node) => node.props.scope)).toEqual(["col", "col", "col", "col", "col"]);
    expect(text(view.root.findByType("caption"))).toContain("verificación del correo");
    expect(text(view.root)).toContain("Sí");
    expect(text(view.root)).toContain("Pendiente");
    navigate(view, "Auditoría");
    expect(view.root.findByProps({ "aria-label": "Tabla de auditoría" }).props.tabIndex).toBe(0);
    expect(view.root.findAllByType("th").map(text)).toEqual(["Fecha", "Actor", "Acción", "Entidad"]);
    expect(text(view.root)).toContain("PROVIDER_APPROVED");
  });

  it("aprobar conserva el ID, bloqueo de acciones, feedback y recarga existente", async () => {
    const view = mount();
    navigate(view, "Proveedores");
    let finish!: () => void;
    mocks.admin.approveProvider.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
    let pending!: Promise<void>;
    act(() => { pending = button(view, "Aprobar").props.onClick(); });
    expect(mocks.admin.approveProvider).toHaveBeenCalledExactlyOnceWith("ui-provider");
    expect(button(view, "Aprobar").props.disabled).toBe(true);
    expect(button(view, "Rechazar").props.disabled).toBe(true);
    expect(text(view.root.findByProps({ role: "status" }))).toContain("Guardando la revisión");
    await act(async () => { finish(); await pending; });
    expect(mocks.retry).toHaveBeenCalledOnce();
    expect(mocks.toast).toHaveBeenCalledWith("success", "Proveedor aprobado correctamente");
  });

  it("el modal etiqueta campos y mantiene la resolución real elegida y su payload", async () => {
    const view = mount();
    navigate(view, "Disputas");
    act(() => { button(view, "Resolver").props.onClick(); });
    const dialog = view.root.findByProps({ role: "dialog" });
    expect(dialog.props["aria-modal"]).toBe("true");
    expect(dialog.props["aria-labelledby"]).toBe("admin-dispute-title");
    const field = view.root.findByType("textarea");
    expect(view.root.findByType("label").props.htmlFor).toBe(field.props.id);
    expect(field.props["aria-describedby"]).toBe("admin-dispute-resolution-hint");
    expect(button(view, "Cliente").props["aria-pressed"]).toBe(true);
    act(() => { button(view, "Proveedor").props.onClick(); field.props.onChange({ target: { value: "  Resolución de prueba registrada  " } }); });
    expect(button(view, "Proveedor").props["aria-pressed"]).toBe(true);
    await act(async () => { await view.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }); });
    expect(mocks.admin.resolveDispute).toHaveBeenCalledExactlyOnceWith("ui-dispute", "resolved_provider", "Resolución de prueba registrada");
    expect(view.root.findAllByProps({ role: "dialog" })).toHaveLength(0);
    expect(mocks.retry).toHaveBeenCalledOnce();
  });

  it("Escape cierra el modal y logout conserva su acción y navegación", async () => {
    const view = mount();
    navigate(view, "Disputas");
    act(() => { button(view, "Resolver").props.onClick(); });
    act(() => { view.root.findByProps({ role: "dialog" }).props.onKeyDown({ key: "Escape", preventDefault: vi.fn() }); });
    expect(view.root.findAllByProps({ role: "dialog" })).toHaveLength(0);
    await act(async () => { await button(view, "Salir").props.onClick(); });
    expect(mocks.endSession).toHaveBeenCalledOnce();
    expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith(PATHS.home);
  });

  it("un fallo de resolución mantiene el formulario abierto y anuncia un error real", async () => {
    const view = mount();
    navigate(view, "Disputas");
    act(() => { button(view, "Resolver").props.onClick(); });
    act(() => { view.root.findByType("textarea").props.onChange({ target: { value: "Resolución de prueba válida" } }); });
    mocks.admin.resolveDispute.mockRejectedValueOnce(new Error("ADMIN_UI_PRIVATE_FAILURE"));
    await act(async () => { await view.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }); });
    expect(view.root.findAllByProps({ role: "dialog" })).toHaveLength(1);
    expect(text(view.root.findByProps({ role: "alert" }))).toContain("Error al resolver la disputa");
    expect(text(view.root)).not.toContain("ADMIN_UI_PRIVATE_FAILURE");
    expect(mocks.retry).not.toHaveBeenCalled();
    expect(view.root.findByType("textarea").props["aria-invalid"]).toBeUndefined();
  });
});
