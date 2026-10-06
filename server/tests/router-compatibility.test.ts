import { createElement as h } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { PATHS, RequireRole, roleHome, tabPath, viewToPath } from "../../src/lib/router";
import type { Role } from "../../src/types";

let session: { role: Role } | null = null;
vi.mock("../../src/lib/state", () => ({ useApp: () => ({ session }) }));

let renderer: ReactTestRenderer | undefined;
afterEach(() => { act(() => renderer?.unmount()); renderer = undefined; session = null; });

function Location() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return h("div", null,
    h("output", null, pathname + search),
    h("button", { onClick: () => navigate(viewToPath({ t: "request", catId: "category", proId: "provider" })) }, "Solicitar"),
    h("button", { onClick: () => navigate(-1) }, "Anterior"),
  );
}

describe("Router 7 · navegación declarativa y guards existentes", () => {
  it("preserva rutas profundas, querystring y navegación atrás con hooks reales", async () => {
    await act(async () => {
      renderer = create(h(MemoryRouter, { initialEntries: ["/app/servicios/category"] },
        h(Routes, null, h(Route, { path: "/app/*", element: h(Location) }))));
    });
    expect(renderer!.root.findByType("output").children).toEqual(["/app/servicios/category"]);
    await act(async () => { renderer!.root.findAllByType("button")[0].props.onClick(); });
    expect(renderer!.root.findByType("output").children).toEqual(["/app/solicitar?cat=category&pro=provider"]);
    await act(async () => { renderer!.root.findAllByType("button")[1].props.onClick(); });
    expect(renderer!.root.findByType("output").children).toEqual(["/app/servicios/category"]);
  });

  it.each([null, "customer", "provider", "admin"] as const)("conserva protección /admin para %s", async (role) => {
    session = role ? { role } : null;
    await act(async () => {
      renderer = create(h(MemoryRouter, { initialEntries: [PATHS.admin] }, h(Routes, null,
        h(Route, { path: PATHS.admin, element: h(RequireRole, { roles: ["admin"], children: h("output", null, "admin autorizado") }) }),
        h(Route, { path: "*", element: h(Location) }),
      )));
    });
    expect(renderer!.root.findByType("output").children).toEqual([role === "admin" ? "admin autorizado" : role ? roleHome(role) : PATHS.home]);
  });

  it("los mapas de navegación siguen siendo rutas internas y codifican los filtros", () => {
    for (const tab of ["home", "explore", "jobs", "favs", "me"] as const) expect(tabPath(tab)).toMatch(/^\/app(?:\/|$)/);
    const path = viewToPath({ t: "request", catId: "category with &", proId: "provider?" });
    const parsed = new URL(path, "https://preview.example");
    expect(parsed.origin).toBe("https://preview.example");
    expect(parsed.pathname).toBe("/app/solicitar");
    expect(parsed.searchParams.get("cat")).toBe("category with &");
    expect(parsed.searchParams.get("pro")).toBe("provider?");
  });
});
