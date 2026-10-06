import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { describe, expect, it } from "vitest";
import { Landing, LandingCatalog, LandingProviders, landingSearchIntent } from "../../src/features/landing/Landing";
import type { CatalogCategory, PublicProvider } from "../../src/lib/api";

const categories: CatalogCategory[] = [{ id: "opaque-catalog-id", name: "Electricidad", icon: "plug", group_name: "Hogar" }];
const provider: PublicProvider = {
  id: "actual-directory-id", name: "Perfil del directorio", image: null, business_name: null,
  rating: 0, reviews_count: 0, is_available: true, avg_eta_min: null,
  categories: [{ id: categories[0].id, name: categories[0].name, icon: "plug" }],
  zones: [{ id: "actual-zone-id", name: "Zona del catálogo" }],
};
const base = { loading: false, error: "", onRetry: () => {}, onPick: () => {} };

describe("Landing · contenido público honesto", () => {
  it("la página inicial no presenta métricas, actividad o personas de demo como reales", () => {
    const html = renderToStaticMarkup(createElement(StaticRouter, { location: "/" }, createElement(Landing)));
    expect(html).toContain("Lo que necesitas");
    expect(html).toContain("Consulta las categorías del catálogo actual");
    expect(html).toContain("Su disponibilidad puede cambiar");
    expect(html).toContain("La asignación se confirma cuando uno la acepta");
    for (const unsupported of ["EN VIVO", "12,400", "12.400", "243", "4.8 ★", "RD$", "100 fundadores", "809-555", "hola@altoque", "Carlos Méndez", "María Santos"]) {
      expect(html).not.toContain(unsupported);
    }
    expect(html).not.toContain("Solicitudes completadas");
  });

  it("la búsqueda conserva el ID del catálogo real, incluso si no es un slug de demo", () => {
    expect(landingSearchIntent("  ELECTRI  ", categories)).toEqual({ t: "results", catId: "opaque-catalog-id" });
    expect(landingSearchIntent("", categories)).toEqual({ t: "explore" });
    expect(landingSearchIntent("servicio desconocido", categories)).toEqual({ t: "explore" });
    expect(landingSearchIntent("Electricidad", [])).toEqual({ t: "explore" });
  });

  it("las categorías muestran solo el catálogo recibido, sin precios ni conteos inventados", () => {
    const html = renderToStaticMarkup(createElement(LandingCatalog, { ...base, categories }));
    expect(html).toContain("Electricidad");
    expect(html).toContain("Explorar este servicio");
    expect(html).not.toContain("RD$");
    expect(html).not.toContain("profesionales disponibles");
    expect(html).not.toContain("Plomería");
  });

  it("el directorio presenta el perfil recibido y conserva un estado honesto sin reseñas", () => {
    const html = renderToStaticMarkup(createElement(LandingProviders, { ...base, providers: [provider] }));
    expect(html).toContain("Perfil del directorio");
    expect(html).toContain("Zona del catálogo");
    expect(html).toContain("Aún sin reseñas");
    expect(html).toContain("Ver perfil");
    expect(html).not.toContain("★");
    expect(html).not.toContain("minutos");
  });

  it("los ratings y reseñas mostrados corresponden al DTO del directorio", () => {
    const html = renderToStaticMarkup(createElement(LandingProviders, { ...base, providers: [{ ...provider, rating: 4.25, reviews_count: 2 }] }));
    expect(html).toContain("4.3 ★ · 2 reseñas");
    expect(html).not.toContain("Aún sin reseñas");
  });

  it.each(["catálogo", "directorio"])("%s vacío es normal y no activa un fallback de demo", (kind) => {
    const html = kind === "catálogo"
      ? renderToStaticMarkup(createElement(LandingCatalog, { ...base, categories: [] }))
      : renderToStaticMarkup(createElement(LandingProviders, { ...base, providers: [] }));
    expect(html).toContain("No hay resultados disponibles por ahora");
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("Perfil del directorio");
  });

  it.each(["catálogo", "directorio"])("%s diferencia carga/error y oculta filas anteriores", (kind) => {
    const render = (loading: boolean, error: string) => kind === "catálogo"
      ? renderToStaticMarkup(createElement(LandingCatalog, { ...base, categories, loading, error }))
      : renderToStaticMarkup(createElement(LandingProviders, { ...base, providers: [provider], loading, error }));
    const loading = render(true, "");
    expect(loading).toContain('role="status"');
    expect(loading).toContain("Cargando");
    expect(loading).not.toContain("Electricidad");
    const error = render(false, "No pudimos consultar el catálogo");
    expect(error).toContain('role="alert"');
    expect(error).toContain("Reintentar");
    expect(error).not.toContain("Electricidad");
    expect(error).not.toContain("No hay resultados");
  });

  it("escapa contenido del API en vez de convertirlo en HTML ejecutable", () => {
    const html = renderToStaticMarkup(createElement(LandingProviders, { ...base, providers: [{ ...provider, name: "<script>unsafe()</script>" }] }));
    expect(html).toContain("&lt;script&gt;unsafe()&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });
});
