/** Dialog interaction with mocked DOM nodes/API; no network, database or email. */
import { createElement, type ComponentType } from "react";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DisputeModal } from "../../src/features/client/DisputeModal";
import { ProDisputeModal } from "../../src/features/provider/ProDisputeModal";

const calls = vi.hoisted(() => ({ create: vi.fn(), toast: vi.fn() }));
vi.mock("../../src/lib/api", () => ({ api: { disputes: { create: calls.create } } }));
vi.mock("../../src/components/Toast", () => ({ useToast: () => ({ showToast: calls.toast }) }));

type Props = { requestId: string; onClose: () => void; onSuccess: () => void };
type FocusNode = {
  focus: () => void;
  isConnected: boolean;
  tabIndex: number;
  hidden: boolean;
  getAttribute: (name: string) => string | null;
};
const renderers: ReactTestRenderer[] = [];
function text(node: ReactTestInstance | string): string {
  return typeof node === "string" ? node : node.children.map(text).join("");
}
function mount(Component: ComponentType<Props>) {
  let view!: ReactTestRenderer;
  const nodes = new Map<ReactTestInstance, FocusNode>();
  const documentState = { activeElement: null as FocusNode | null };
  const outside: FocusNode = {
    isConnected: true, tabIndex: 0, hidden: false, getAttribute: () => null,
    focus: vi.fn(() => { documentState.activeElement = outside; }),
  };
  documentState.activeElement = outside;
  const nodeFor = (instance: ReactTestInstance): FocusNode => {
    let node = nodes.get(instance);
    if (!node) {
      node = {
        isConnected: true, tabIndex: instance.props.tabIndex ?? 0, hidden: false,
        getAttribute: (name) => instance.props[name] ?? null,
        focus: vi.fn(() => { documentState.activeElement = node!; }),
      };
      nodes.set(instance, node);
    }
    return node;
  };
  const dialogNode: FocusNode & { querySelector: () => FocusNode | null; querySelectorAll: () => FocusNode[] } = {
    isConnected: true, tabIndex: -1, hidden: false, getAttribute: () => null,
    focus: vi.fn(() => { documentState.activeElement = dialogNode; }),
    querySelector: () => {
      const field = view.root.findAllByType("textarea").find((node) => !node.props.disabled);
      return field ? nodeFor(field) : null;
    },
    querySelectorAll: () => view.root.findAll((node) =>
      (node.type === "button" || node.type === "textarea") && !node.props.disabled && node.props.tabIndex !== -1,
    ).map(nodeFor),
  };
  vi.stubGlobal("document", documentState);
  const close = vi.fn(), success = vi.fn();
  act(() => {
    view = create(createElement(Component, { requestId: "request-ui-fixture", onClose: close, onSuccess: success }), {
      createNodeMock: (element) => element.props.role === "dialog" ? dialogNode : null,
    });
  });
  renderers.push(view);
  const dialog = () => view.root.findByProps({ role: "dialog" });
  const field = () => view.root.findByType("textarea");
  const setReason = (value: string) => act(() => { field().props.onChange({ target: { value } }); });
  const key = (value: string, shiftKey = false) => {
    const preventDefault = vi.fn();
    act(() => { dialog().props.onKeyDown({ key: value, shiftKey, preventDefault }); });
    return preventDefault;
  };
  return { view, close, success, documentState, outside, dialogNode, nodeFor, dialog, field, setReason, key };
}
function deferred() {
  let resolve!: () => void, reject!: (error: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.resetAllMocks();
  calls.create.mockResolvedValue(undefined);
});
afterEach(() => {
  act(() => { for (const renderer of renderers.splice(0)) renderer.unmount(); });
  vi.unstubAllGlobals();
});

for (const [name, Component, professional] of [
  ["Cliente", DisputeModal, false], ["Profesional", ProDisputeModal, true],
] as const) {
  describe(`${name} · modal de disputa accesible sin cambiar contratos`, () => {
    it("enfoca el motivo y asocia nombre, descripción, etiqueta y límite existentes", () => {
      const state = mount(Component);
      expect(state.dialog().props["aria-modal"]).toBe("true");
      expect(text(state.view.root.findByProps({ id: state.dialog().props["aria-labelledby"] }))).toBe("Abrir disputa");
      expect(text(state.view.root.findByProps({ id: state.dialog().props["aria-describedby"] }))).toBe("Describe el problema con este servicio");
      expect(state.view.root.findByType("label").props.htmlFor).toBe(state.field().props.id);
      expect(text(state.view.root.findByProps({ id: state.field().props["aria-describedby"] }))).toContain("0/2000 caracteres (mínimo 10)");
      expect(state.field().props).toMatchObject({ minLength: 10, maxLength: 2000, required: true, rows: 5 });
      expect(state.documentState.activeElement).toBe(state.nodeFor(state.field()));
      expect(calls.create).not.toHaveBeenCalled();
    });

    it("un motivo corto anuncia la validación y no llama al API", async () => {
      const state = mount(Component);
      state.setReason("breve");
      await act(async () => { await state.view.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }); });
      const alert = state.view.root.findByProps({ role: "alert" });
      expect(text(alert)).toBe("El motivo debe tener al menos 10 caracteres");
      expect(state.field().props["aria-describedby"]).toContain(alert.props.id);
      expect(state.field().props["aria-invalid"]).toBe(true);
      expect(calls.create).not.toHaveBeenCalled();
      expect(state.success).not.toHaveBeenCalled();
    });

    it("conserva ID, motivo normalizado, éxito y toast del profesional", async () => {
      const state = mount(Component);
      state.setReason("  Motivo válido de prueba del servicio  ");
      await act(async () => { await state.view.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }); });
      expect(calls.create).toHaveBeenCalledExactlyOnceWith("request-ui-fixture", "Motivo válido de prueba del servicio");
      expect(state.success).toHaveBeenCalledOnce();
      expect(state.close).not.toHaveBeenCalled();
      if (professional) expect(calls.toast).toHaveBeenCalledExactlyOnceWith("success", "Disputa creada correctamente");
      else expect(calls.toast).not.toHaveBeenCalled();
    });

    it("contiene Tab y Shift+Tab, permite Escape y restaura el foco al desmontarse", () => {
      const state = mount(Component);
      state.setReason("Motivo de prueba válido");
      const controls = state.dialogNode.querySelectorAll();
      controls[0].focus();
      expect(state.key("Tab", true)).toHaveBeenCalledOnce();
      expect(state.documentState.activeElement).toBe(controls.at(-1));
      expect(state.key("Tab")).toHaveBeenCalledOnce();
      expect(state.documentState.activeElement).toBe(controls[0]);
      state.dialogNode.focus();
      expect(state.key("Tab")).toHaveBeenCalledOnce();
      expect(state.documentState.activeElement).toBe(controls[0]);
      expect(state.key("Escape")).toHaveBeenCalledOnce();
      expect(state.close).toHaveBeenCalledOnce();
      act(() => { state.view.unmount(); });
      renderers.splice(renderers.indexOf(state.view), 1);
      expect(state.outside.focus).toHaveBeenCalledOnce();
      expect(state.documentState.activeElement).toBe(state.outside);
    });

    it("mueve foco al diálogo durante envío, bloquea Escape y recupera el campo tras fallo", async () => {
      const state = mount(Component);
      state.setReason("Motivo de prueba válido");
      const response = deferred();
      calls.create.mockReturnValueOnce(response.promise);
      let pending!: Promise<void>;
      act(() => { pending = state.view.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }); });
      expect(state.dialog().props["aria-busy"]).toBe(true);
      expect(state.field().props.disabled).toBe(true);
      expect(state.view.root.findAllByType("button").every((node) => node.props.disabled)).toBe(true);
      expect(state.documentState.activeElement).toBe(state.dialogNode);
      state.key("Escape");
      expect(state.close).not.toHaveBeenCalled();
      expect(state.key("Tab", true)).toHaveBeenCalledOnce();
      expect(state.documentState.activeElement).toBe(state.dialogNode);
      await act(async () => { response.reject(new Error("UI_INTERNAL_FAILURE_DO_NOT_DISPLAY")); await pending; });
      expect(state.dialog().props["aria-busy"]).toBe(false);
      expect(state.documentState.activeElement).toBe(state.nodeFor(state.field()));
      expect(text(state.view.root.findByProps({ role: "alert" }))).toBe("Error al crear la disputa. Intenta nuevamente.");
      expect(state.field().props["aria-invalid"]).toBeUndefined();
      expect(text(state.view.root)).not.toContain("UI_INTERNAL_FAILURE_DO_NOT_DISPLAY");
      expect(state.success).not.toHaveBeenCalled();
      expect(calls.toast).not.toHaveBeenCalled();
    });

    it("preserva los errores específicos y los dos controles de cierre", async () => {
      const state = mount(Component);
      state.setReason("Motivo de prueba válido");
      for (const [failure, expected] of [
        [new Error("Ya existe una disputa"), "Ya existe una disputa abierta para esta solicitud"],
        [new Error("Solo se pueden disputar"), "Esta solicitud no puede ser disputada en este momento"],
        [null, "Error inesperado. Intenta nuevamente."],
      ] as const) {
        calls.create.mockRejectedValueOnce(failure);
        await act(async () => { await state.view.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }); });
        expect(text(state.view.root.findByProps({ role: "alert" }))).toBe(expected);
      }
      act(() => {
        state.view.root.findByProps({ "aria-label": "Cerrar" }).props.onClick();
        state.view.root.findAllByType("button").find((node) => text(node) === "Cancelar")!.props.onClick();
      });
      expect(state.close).toHaveBeenCalledTimes(2);
    });
  });
}

it("dos modales mantienen identificadores accesibles independientes", () => {
  const props = { requestId: "request-ui-fixture", onClose: vi.fn(), onSuccess: vi.fn() };
  const html = renderToStaticMarkup(createElement("div", null, createElement(DisputeModal, props), createElement(ProDisputeModal, props)));
  const ids = [...html.matchAll(/aria-labelledby="([^"]+)"/g)].map((match) => match[1]);
  expect(ids).toHaveLength(2);
  expect(new Set(ids).size).toBe(2);
  expect(ids.every((id) => html.includes(`id="${id}"`))).toBe(true);
});
