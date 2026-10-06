import { Hono } from "hono";
import { describe, expect, it } from "vitest";

const app = new Hono().get("/query", (context) => context.json(context.req.query()));

describe("Hono · query y fragmentos de URL", () => {
  it.each([
    ["/query?visible=1&zone=2", { visible: "1", zone: "2" }],
    ["/query?visible=1#ignored&hidden=2", { visible: "1" }],
    ["/query#ignored?hidden=2", {}],
    ["/query?visible=1%23ignored&zone=2", { visible: "1#ignored", zone: "2" }],
  ])("interpreta parámetros sin leer después del fragmento: %s", async (path, expected) => {
    const response = await app.request(`http://localhost${path}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expected);
  });
});
