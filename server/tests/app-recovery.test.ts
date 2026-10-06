import { createElement as h } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "../../src/components/AppStates";

let renderer: ReactTestRenderer | undefined;
afterEach(() => { act(() => renderer?.unmount()); renderer = undefined; vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function failedView() {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const BrokenView = () => { throw new Error("PRIVATE_RENDER_FIXTURE"); };
  act(() => { renderer = create(h(AppErrorBoundary, { children: h(BrokenView) })); });
  expect(JSON.stringify(renderer!.toJSON())).not.toContain("PRIVATE_RENDER_FIXTURE");
  return renderer!.root.findByType("a");
}

describe("Error boundary · recuperación real en SPA HashRouter", () => {
  it("click normal vuelve al hash inicial y recarga, conservando el enlace y su presentación", () => {
    const replaceState = vi.fn(); const reload = vi.fn();
    vi.stubGlobal("window", { history: { replaceState }, location: { reload } });
    const link = failedView(); const preventDefault = vi.fn();
    expect(link.props.href).toBe("/#/");
    expect(link.children).toEqual(["Volver al inicio"]);
    act(() => { link.props.onClick({ button: 0, preventDefault }); });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(replaceState).toHaveBeenCalledExactlyOnceWith(null, "", "/#/");
    expect(reload).toHaveBeenCalledOnce();
  });

  it.each(["metaKey", "ctrlKey", "shiftKey", "altKey"])("conserva la navegación nativa del click con %s", (modifier) => {
    const replaceState = vi.fn(); const reload = vi.fn();
    vi.stubGlobal("window", { history: { replaceState }, location: { reload } });
    const link = failedView(); const preventDefault = vi.fn();
    act(() => { link.props.onClick({ button: 0, [modifier]: true, preventDefault }); });
    expect(preventDefault).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("un render normal conserva los hijos sin fallback ni reload", () => {
    act(() => { renderer = create(h(AppErrorBoundary, { children: h("p", null, "Vista normal") })); });
    expect(renderer!.root.findByType("p").children).toEqual(["Vista normal"]);
    expect(renderer!.root.findAllByType("a")).toHaveLength(0);
  });
});
