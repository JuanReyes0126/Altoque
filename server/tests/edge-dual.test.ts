/**
 * ALTOQUE · Tests del borde dual Vercel/Hono (F1.8)
 *
 * Unitarios: usan una app Hono diminuta (sin BD) y mocks de
 * IncomingMessage/ServerResponse. No requieren ALTOQUE_TEST_DB.
 *
 *   npx vitest run server/tests/edge-dual.test.ts
 */
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createEdgeHandler } from "../../api/index.js";

/* ── app de prueba (sin BD) ── */
const testApp = new Hono();
testApp.get("/echo", (c) => {
  const url = new URL(c.req.url);
  return c.json({
    path: url.pathname,
    search: url.search,
    method: c.req.method,
    cookie: c.req.header("cookie") ?? null,
    origin: c.req.header("origin") ?? null,
    host: c.req.header("host") ?? null,
  });
});
testApp.post("/echo-body", async (c) => {
  const text = await c.req.text(); // lee el cuerpo UNA vez
  return c.json({
    method: c.req.method,
    length: text.length,
    body: text,
    contentType: c.req.header("content-type") ?? null,
  });
});
testApp.get("/multi-cookie", () =>
  new Response("ok", {
    headers: [
      ["set-cookie", "a=1; Path=/; HttpOnly"],
      ["set-cookie", "b=2; Path=/; Secure"],
      ["x-custom", "yes"],
    ],
  }),
);

const handler = createEdgeHandler(testApp, { bodyTimeoutMs: 60, maxBodyBytes: 100 });

/* ── mocks ── */
function mockIncoming(o: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
  neverEnd?: boolean;
}): IncomingMessage {
  const rawHeaders: string[] = [];
  for (const [k, v] of Object.entries(o.headers ?? {})) rawHeaders.push(k, String(v));
  const chunks = o.body !== undefined ? [Buffer.from(o.body)] : [];
  return {
    method: o.method ?? "GET",
    url: o.url ?? "/",
    headers: o.headers ?? {},
    rawHeaders,
    [Symbol.asyncIterator]: o.neverEnd
      ? () => ({ next: () => new Promise<never>(() => {}) }) // nunca termina → timeout
      : async function* () {
          for (const c of chunks) yield c;
        },
  } as unknown as IncomingMessage;
}

function mockResponse() {
  const res = {
    statusCode: 200,
    statusMessage: "",
    headers: {} as Record<string, unknown>,
    bodyChunks: [] as Buffer[],
    writableEnded: false,
    destroyed: false,
    setHeader(k: string, v: unknown) {
      (this.headers as Record<string, unknown>)[k.toLowerCase()] = v;
    },
    write(c: Uint8Array | string) {
      this.bodyChunks.push(Buffer.from(c as Uint8Array));
      return true;
    },
    end(c?: Uint8Array | string) {
      if (c) this.bodyChunks.push(Buffer.from(c as Uint8Array));
      this.writableEnded = true;
    },
    writeHead(status: number) {
      this.statusCode = status;
      return this;
    },
  };
  return res as unknown as ServerResponse & {
    bodyChunks: Buffer[];
    headers: Record<string, unknown>;
  };
}

const bodyOf = (res: ReturnType<typeof mockResponse>) =>
  Buffer.concat(res.bodyChunks).toString("utf8");

/* ── convención Web nativa ── */
describe("borde dual · Web Request (nativo)", () => {
  it("Request -> Response sin pasar por el adaptador Node", async () => {
    const res = await handler(new Request("https://altoque.example/echo?a=1"));
    expect(res).toBeInstanceOf(Response);
    const json = await res.json();
    expect(json.path).toBe("/echo");
    expect(json.search).toBe("?a=1"); // query string preservada
    expect(json.method).toBe("GET");
  });
});

/* ── convención legada (IncomingMessage, ServerResponse) ── */
describe("borde dual · legacy Node", () => {
  it("GET no lee body y preserva query, método, cookie, origin y host", async () => {
    const req = mockIncoming({
      method: "GET",
      url: "/echo?a=1&b=2",
      headers: { cookie: "sid=abc", origin: "https://altoque.example", host: "altoque.example" },
    });
    const res = mockResponse();
    const returned = await handler(req, res);

    expect(returned).toBeUndefined(); // devuelve void → sin warning
    expect(res.writableEnded).toBe(true); // res.end() garantizado
    const json = JSON.parse(bodyOf(res));
    expect(json.method).toBe("GET");
    expect(json.search).toBe("?a=1&b=2");
    expect(json.cookie).toBe("sid=abc");
    expect(json.origin).toBe("https://altoque.example");
    expect(json.host).toBe("altoque.example");
  });

  it("POST JSON lee el cuerpo exactamente una vez y lo reenvía", async () => {
    const payload = '{"hola":1}';
    const req = mockIncoming({
      method: "POST",
      url: "/echo-body",
      headers: { "content-type": "application/json" },
      body: payload,
    });
    const res = mockResponse();
    await handler(req, res);

    const json = JSON.parse(bodyOf(res));
    expect(json.method).toBe("POST");
    expect(json.body).toBe(payload); // el cuerpo llegó íntegro a Hono
    expect(json.length).toBe(payload.length);
    expect(json.contentType).toBe("application/json");
  });

  it("POST vacío no cuelga y entrega cuerpo vacío", async () => {
    const req = mockIncoming({ method: "POST", url: "/echo-body", headers: {} });
    const res = mockResponse();
    await handler(req, res);

    const json = JSON.parse(bodyOf(res));
    expect(json.method).toBe("POST");
    expect(json.length).toBe(0);
    expect(res.writableEnded).toBe(true);
  });

  it("HEAD no adjunta cuerpo al Request", async () => {
    const req = mockIncoming({ method: "HEAD", url: "/echo", headers: {} });
    const res = mockResponse();
    await handler(req, res);
    expect(res.writableEnded).toBe(true);
    // No se leyó ni adjuntó body para HEAD (readBody devuelve undefined).
  });

  it("múltiples Set-Cookie se preservan sin concatenar", async () => {
    const req = mockIncoming({ method: "GET", url: "/multi-cookie", headers: {} });
    const res = mockResponse();
    await handler(req, res);

    const setCookie = res.headers["set-cookie"];
    expect(Array.isArray(setCookie)).toBe(true);
    expect(setCookie as string[]).toHaveLength(2);
    expect((setCookie as string[])[0]).toContain("a=1");
    expect((setCookie as string[])[1]).toContain("b=2");
    expect(res.headers["x-custom"]).toBe("yes");
  });

  it("cuerpo sobre el límite → 413", async () => {
    const req = mockIncoming({
      method: "POST",
      url: "/echo-body",
      headers: { "content-type": "application/json" },
      body: "x".repeat(200), // > maxBodyBytes (100)
    });
    const res = mockResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(413);
    expect(JSON.parse(bodyOf(res)).error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(res.writableEnded).toBe(true);
  });

  it("stream que nunca termina → 408 (timeout acotado, no cuelga)", async () => {
    const req = mockIncoming({ method: "POST", url: "/echo-body", headers: {}, neverEnd: true });
    const res = mockResponse();
    await handler(req, res); // debe resolver en ~bodyTimeoutMs, no colgar

    expect(res.statusCode).toBe(408);
    expect(JSON.parse(bodyOf(res)).error.code).toBe("BODY_READ_TIMEOUT");
    expect(res.writableEnded).toBe(true);
  });
});
