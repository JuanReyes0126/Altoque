/**
 * ALTOQUE · Tests del borde dual Vercel/Hono (F1.8)
 *
 * Unitarios: usan una app Hono diminuta (sin BD) y mocks de
 * IncomingMessage/ServerResponse. No requieren ALTOQUE_TEST_DB.
 *
 *   npx vitest run server/tests/edge-dual.test.ts
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { EventEmitter, errorMonitor } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createEdgeHandler } from "../../api/index.js";

// El import del adaptador no debe inicializar la app real ni Prisma.
vi.mock("../../server/index.js", async () => {
  const { Hono: TestHono } = await import("hono");
  return { app: new TestHono() };
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

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
  const res = Object.assign(new EventEmitter(), {
    statusCode: 200,
    statusMessage: "",
    headers: {} as Record<string, unknown>,
    bodyChunks: [] as Buffer[],
    writableEnded: false,
    writableFinished: false,
    headersSent: false,
    destroyed: false,
    setHeader(k: string, v: unknown) {
      (this.headers as Record<string, unknown>)[k.toLowerCase()] = v;
    },
    write(c: Uint8Array | string) {
      this.headersSent = true;
      this.bodyChunks.push(Buffer.from(c as Uint8Array));
      return true;
    },
    end(c?: Uint8Array | string) {
      if (c) this.bodyChunks.push(Buffer.from(c as Uint8Array));
      this.headersSent = true;
      this.writableEnded = true;
    },
    writeHead(status: number) {
      this.statusCode = status;
      return this;
    },
  });
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

/* ── diagnóstico temporal: sólo Preview, sin tocar la aplicación real ── */
type DiagnosticRecord = {
  event: string;
  stage: string;
  correlationId: string;
  vercelRequestId?: string;
  errorType?: string;
  errorCode?: string;
  locations?: string[];
  headersSent?: boolean;
  writableEnded?: boolean;
  writableFinished?: boolean;
  destroyed?: boolean;
};

function captureDiagnostics() {
  const normal = vi.spyOn(console, "log").mockImplementation(() => {});
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const records = () =>
    [...normal.mock.calls, ...errors.mock.calls].map(([entry]) => {
      expect(typeof entry).toBe("string");
      const record = JSON.parse(entry as string) as DiagnosticRecord;
      expect(record.event).toBe("edge_diag");
      return record;
    });
  return { normal, errors, records };
}

function enableDiagnostics() {
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("ALTOQUE_DIAG", "1");
}

function edgeFor(response: Response | (() => Response | Promise<Response>)) {
  return createEdgeHandler({
    fetch: typeof response === "function" ? response : () => response,
  });
}

describe("borde dual · diagnóstico de Preview", () => {
  it.each([
    ["preview", "1", true],
    ["preview", "0", false],
    ["preview", "", false],
    ["production", "1", false],
    ["development", "1", false],
    ["", "1", false],
  ])("gate VERCEL_ENV=%s ALTOQUE_DIAG=%s", async (environment, diag, enabled) => {
    vi.stubEnv("VERCEL_ENV", environment);
    vi.stubEnv("ALTOQUE_DIAG", diag);
    const logs = captureDiagnostics();
    const res = mockResponse();
    await edgeFor(new Response("unchanged"))(mockIncoming({}), res);

    expect(bodyOf(res)).toBe("unchanged");
    expect(res.statusCode).toBe(200);
    expect(res.writableEnded).toBe(true);
    expect(res.listenerCount(errorMonitor)).toBe(enabled ? 1 : 0);
    res.emit("finish");
    res.emit("close");
    expect(logs.records().length > 0).toBe(enabled);
    expect(res.listenerCount(errorMonitor)).toBe(0);
  });

  it.each([false, true])("preserva status, headers, cookies y bytes; diagnóstico=%s", async (enabled) => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("ALTOQUE_DIAG", enabled ? "1" : "0");
    const logs = captureDiagnostics();
    const bytes = Uint8Array.from([0, 1, 127, 128, 255]);
    const res = mockResponse();
    const result = await edgeFor(new Response(bytes, {
      status: 202,
      statusText: "Accepted",
      headers: [
        ["content-type", "application/octet-stream"],
        ["x-custom", "preserved"],
        ["set-cookie", "one=fixture; Path=/; HttpOnly"],
        ["set-cookie", "two=fixture; Path=/; Secure"],
      ],
    }))(mockIncoming({}), res);

    expect(result).toBeUndefined();
    expect(res.statusCode).toBe(202);
    expect(res.statusMessage).toBe("Accepted");
    expect(res.headers).toEqual({
      "content-type": "application/octet-stream",
      "x-custom": "preserved",
      "set-cookie": [
        "one=fixture; Path=/; HttpOnly",
        "two=fixture; Path=/; Secure",
      ],
    });
    expect(Buffer.concat(res.bodyChunks)).toEqual(Buffer.from(bytes));
    expect(res.writableEnded).toBe(true);
    expect(logs.records().some((entry) => entry.stage === "dispatch_node")).toBe(enabled);
    res.emit("close");
  });

  it.each([false, true])("Web devuelve la misma Response sin consumirla; diagnóstico=%s", async (enabled) => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("ALTOQUE_DIAG", enabled ? "1" : "0");
    const logs = captureDiagnostics();
    const response = new Response("native exact body", {
      status: 201,
      headers: { "x-native": "preserved" },
    });
    const returned = await edgeFor(response)(new Request("https://preview.example/path"));

    expect(returned).toBe(response);
    expect(response.bodyUsed).toBe(false);
    expect(response.body?.locked).toBe(false);
    expect(response.status).toBe(201);
    expect(response.headers.get("x-native")).toBe("preserved");
    expect(await response.text()).toBe("native exact body");
    expect(logs.records().some((entry) => entry.stage === "web_response_returned")).toBe(enabled);
  });

  it("preserva respuestas sin cuerpo y redirects con diagnóstico activo", async () => {
    enableDiagnostics();
    const logs = captureDiagnostics();
    for (const response of [
      new Response(null, { status: 204 }),
      new Response(null, { status: 302, headers: { location: "https://preview.example/next" } }),
    ]) {
      const res = mockResponse();
      await edgeFor(response)(mockIncoming({}), res);
      expect(res.statusCode).toBe(response.status);
      expect(bodyOf(res)).toBe("");
      expect(res.writableEnded).toBe(true);
      if (response.status === 302) expect(res.headers.location).toBe("https://preview.example/next");
      res.emit("close");
    }
    expect(logs.records().some((record) => record.errorType)).toBe(false);
  });

  it("no registra contenido, headers, mensajes ni ubicaciones no permitidas", async () => {
    enableDiagnostics();
    const logs = captureDiagnostics();
    const sentinel = "PRIVATE_DIAGNOSTIC_SENTINEL";
    const error = Object.assign(new Error(sentinel), {
      name: sentinel,
      code: sentinel,
      stack: [
        sentinel,
        `    at privateFunction (/private/${sentinel}/api/index.ts:101:2)`,
        "    at middleware (/private/server/index.js:45:3)",
        "    at security (/private/server/middleware/security.ts:67:4)",
        "    at fourth (/private/api/index.js:102:5)",
        `    at privateFunction (/private/server/secret-${sentinel}.ts:1:2)`,
        `    at https://preview.example/?token=${sentinel}:10:3`,
      ].join("\n"),
    });
    const res = mockResponse();
    const req = mockIncoming({
      method: "POST",
      url: `/path?token=${sentinel}`,
      headers: {
        host: "preview.example",
        cookie: sentinel,
        authorization: sentinel,
        "x-vercel-id": sentinel,
        "content-type": "application/json",
      },
      body: sentinel,
    });
    await edgeFor(() => { throw error; })(req, res);

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(bodyOf(res)).error.code).toBe("INTERNAL_ERROR");
    const records = logs.records();
    const failure = records.find((entry) => entry.stage === "app_fetch" && entry.errorType);
    expect(failure).toBeDefined();
    expect(failure?.errorType).toBe("OtherError");
    expect(failure?.errorCode).toBe("UNKNOWN");
    expect(failure?.locations).toEqual([
      "api/index.ts:101:2",
      "server/index.ts:45:3",
      "server/middleware/security.ts:67:4",
    ]);
    const allowedKeys = new Set([
      "event", "stage", "correlationId", "vercelRequestId", "errorType", "errorCode",
      "locations", "headersSent", "writableEnded", "writableFinished", "destroyed",
    ]);
    for (const record of records) {
      expect(Object.keys(record).every((key) => allowedKeys.has(key))).toBe(true);
      expect(record.vercelRequestId).toBeUndefined();
      expect(record.correlationId).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    }
    expect(new Set(records.map((record) => record.correlationId)).size).toBe(1);
    expect(JSON.stringify([...logs.normal.mock.calls, ...logs.errors.mock.calls])).not.toContain(sentinel);
    res.emit("close");
  });

  it.each([
    "iad1::2kjb4-1791302975694-41c0a38ec326",
    "iad1::sfo1::2kjb4-1791302975694-41c0a38ec326",
  ])("acepta únicamente el ID técnico validado %s", async (vercelRequestId) => {
    enableDiagnostics();
    const logs = captureDiagnostics();
    const res = mockResponse();
    await edgeFor(new Response("ok"))(mockIncoming({ headers: { "x-vercel-id": vercelRequestId } }), res);
    expect(logs.records().every((record) => record.vercelRequestId === vercelRequestId)).toBe(true);
    res.emit("close");
  });

  it.each([
    "iad1::2kjb4-1791302975694-41c0a38ec326\nsecret",
    "iad1::2kjb4-1791302975694-41c0a38ec326?token=fixture",
    "IAD1::2kjb4-1791302975694-41c0a38ec326",
    "a".repeat(161),
  ])("omite IDs inválidos sin copiarlos en logs", async (invalidId) => {
    enableDiagnostics();
    const logs = captureDiagnostics();
    // La app normal no recibe estos headers inválidos: comprobar el gate en Web.
    const request = new Request("https://preview.example/");
    vi.spyOn(request.headers, "get").mockImplementation((name) => name === "x-vercel-id" ? invalidId : null);
    await edgeFor(new Response("ok"))(request);
    expect(logs.records().every((record) => record.vercelRequestId === undefined)).toBe(true);
    expect(JSON.stringify([...logs.normal.mock.calls, ...logs.errors.mock.calls])).not.toContain(invalidId);
  });

  it("identifica read_body manteniendo el 413 existente", async () => {
    enableDiagnostics();
    const logs = captureDiagnostics();
    const res = mockResponse();
    await handler(mockIncoming({ method: "POST", url: "/echo-body", body: "x".repeat(101) }), res);

    expect(res.statusCode).toBe(413);
    expect(JSON.parse(bodyOf(res)).error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(logs.records().find((record) => record.stage === "read_body" && record.errorType)).toBeDefined();
    res.emit("close");
  });

  it("identifica build_request antes de ejecutar la app y conserva HTTP 500", async () => {
    enableDiagnostics();
    const logs = captureDiagnostics();
    const res = mockResponse();
    const fetch = vi.fn(() => new Response("never reached"));
    await createEdgeHandler({ fetch })(mockIncoming({
      headers: { "x-forwarded-proto": "not a protocol" },
    }), res);

    expect(fetch).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(bodyOf(res)).error.code).toBe("INTERNAL_ERROR");
    expect(logs.records().find((record) => record.stage === "build_request" && record.errorType)).toBeDefined();
    res.emit("close");
  });

  it("Web registra app_fetch y propaga la misma excepción", async () => {
    enableDiagnostics();
    const logs = captureDiagnostics();
    const failure = new TypeError("native fixture never logged");
    await expect(edgeFor(() => { throw failure; })(new Request("https://preview.example/"))).rejects.toBe(failure);
    expect(logs.records().find((record) => record.stage === "app_fetch" && record.errorType)).toMatchObject({
      errorType: "TypeError",
    });
  });

  it("fallar al escribir el log no cambia la respuesta normal", async () => {
    enableDiagnostics();
    vi.spyOn(console, "log").mockImplementation(() => { throw new Error("logger fixture"); });
    vi.spyOn(console, "error").mockImplementation(() => { throw new Error("logger fixture"); });
    const res = mockResponse();
    await edgeFor(new Response("normal body", { status: 201 }))(mockIncoming({}), res);

    expect(res.statusCode).toBe(201);
    expect(bodyOf(res)).toBe("normal body");
    expect(res.writableEnded).toBe(true);
    expect(() => res.emit("finish")).not.toThrow();
    expect(() => res.emit("close")).not.toThrow();
  });

  it.each([
    ["TypeError", "ERR_HTTP_HEADERS_SENT"],
    ["Error", "ECONNRESET"],
    ["PrismaClientKnownRequestError", "P2024"],
  ])("permite exclusivamente tipo/código conocidos: %s/%s", async (name, code) => {
    enableDiagnostics();
    const logs = captureDiagnostics();
    const res = mockResponse();
    const failure = Object.assign(new Error("message deliberately omitted"), { name, code });
    await edgeFor(() => { throw failure; })(mockIncoming({}), res);
    expect(logs.records().find((record) => record.stage === "app_fetch" && record.errorType)).toMatchObject({
      errorType: name,
      errorCode: code,
    });
    res.emit("close");
  });

  it.each([
    "headers", "reader_acquire", "stream_read", "stream_write", "reader_release", "response_end",
  ])("identifica fallo de transmisión en %s sin alterar recuperación", async (stage) => {
    enableDiagnostics();
    const logs = captureDiagnostics();
    const failure = Object.assign(new TypeError("not logged"), { code: "ERR_INVALID_STATE" });
    const response = new Response("stream contents");
    const res = mockResponse();
    if (stage === "headers") {
      vi.spyOn(res, "setHeader").mockImplementation(() => { throw failure; });
    } else if (stage === "reader_acquire") {
      vi.spyOn(response.body!, "getReader").mockImplementation(() => { throw failure; });
    } else if (stage === "stream_read" || stage === "reader_release") {
      vi.spyOn(response.body!, "getReader").mockReturnValue({
        read: stage === "stream_read"
          ? async () => { throw failure; }
          : async () => ({ done: true, value: undefined }),
        releaseLock: () => { if (stage === "reader_release") throw failure; },
      } as unknown as ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>);
    } else if (stage === "stream_write") {
      vi.spyOn(res, "write").mockImplementation(() => { throw failure; });
    } else {
      vi.spyOn(res, "end").mockImplementationOnce(() => { throw failure; });
    }
    await edgeFor(response)(mockIncoming({}), res);

    expect(res.statusCode).toBe(500);
    expect(res.writableEnded).toBe(true);
    expect(logs.records().filter((record) => record.errorType)).toEqual([
      expect.objectContaining({ stage, errorType: "TypeError", errorCode: "ERR_INVALID_STATE" }),
    ]);
    res.emit("close");
  });

  it("registra recuperación fallida y propaga exactamente la misma excepción", async () => {
    enableDiagnostics();
    const logs = captureDiagnostics();
    const res = mockResponse();
    const headerFailure = new TypeError("header fixture");
    const endFailure = Object.assign(new Error("end fixture"), { code: "EPIPE" });
    vi.spyOn(res, "setHeader").mockImplementation(() => { throw headerFailure; });
    vi.spyOn(res, "end").mockImplementation(() => { throw endFailure; });

    await expect(edgeFor(new Response("ok"))(mockIncoming({}), res)).rejects.toBe(endFailure);
    expect(logs.records().filter((record) => record.errorType).map((record) => record.stage)).toEqual([
      "headers", "recovery_end",
    ]);
    res.emit("close");
  });

  it("observa finish/close con flags y retira únicamente sus listeners", async () => {
    enableDiagnostics();
    const logs = captureDiagnostics();
    const res = mockResponse();
    const externalFinish = vi.fn();
    const externalClose = vi.fn();
    const externalMonitor = vi.fn();
    res.on("finish", externalFinish);
    res.on("close", externalClose);
    res.on(errorMonitor, externalMonitor);
    await edgeFor(new Response("ok"))(mockIncoming({}), res);

    expect(logs.records().some((record) => record.stage === "response_finish")).toBe(false);
    Object.assign(res, { writableFinished: true });
    res.emit("finish");
    res.destroyed = true;
    res.emit("close");
    expect(externalFinish).toHaveBeenCalledOnce();
    expect(externalClose).toHaveBeenCalledOnce();
    expect(logs.records().find((record) => record.stage === "response_finish")).toMatchObject({
      headersSent: true, writableEnded: true, writableFinished: true, destroyed: false,
    });
    expect(logs.records().find((record) => record.stage === "response_close")).toMatchObject({
      headersSent: true, writableEnded: true, writableFinished: true, destroyed: true,
    });
    expect(res.listeners("finish")).toEqual([externalFinish]);
    expect(res.listeners("close")).toEqual([externalClose]);
    expect(res.listeners(errorMonitor)).toEqual([externalMonitor]);
  });

  it("close sin finish identifica cierre incompleto sin inventar finalización", async () => {
    enableDiagnostics();
    const logs = captureDiagnostics();
    const res = mockResponse();
    await edgeFor(new Response("ok"))(mockIncoming({}), res);
    res.destroyed = true;
    res.emit("close");

    expect(logs.records().some((record) => record.stage === "response_finish")).toBe(false);
    expect(logs.records().find((record) => record.stage === "response_close")).toMatchObject({
      writableEnded: true, writableFinished: false, destroyed: true,
    });
  });

  it("errorMonitor observa error sin impedir que el evento fatal lance la misma excepción", async () => {
    enableDiagnostics();
    const logs = captureDiagnostics();
    const res = mockResponse();
    await edgeFor(new Response("ok"))(mockIncoming({}), res);
    const failure = Object.assign(new Error("unlogged event fixture"), { code: "ECONNRESET" });

    expect(res.listenerCount("error")).toBe(0);
    let thrown: unknown;
    try { res.emit("error", failure); } catch (error) { thrown = error; }
    expect(thrown).toBe(failure);
    expect(logs.records().find((record) => record.stage === "response_error")).toMatchObject({
      errorType: "Error", errorCode: "ECONNRESET",
    });
    res.emit("close");
  });

  it("diagnóstico apagado preserva el error fatal y no añade listeners ni logs", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("ALTOQUE_DIAG", "0");
    const logs = captureDiagnostics();
    const res = mockResponse();
    await edgeFor(new Response("ok"))(mockIncoming({}), res);
    const failure = new Error("fatal event fixture");

    expect(res.listenerCount("error")).toBe(0);
    expect(res.listenerCount(errorMonitor)).toBe(0);
    let thrown: unknown;
    try { res.emit("error", failure); } catch (error) { thrown = error; }
    expect(thrown).toBe(failure);
    expect(logs.records()).toEqual([]);
  });

  it("errorMonitor respeta un listener error existente y su cleanup", async () => {
    enableDiagnostics();
    const logs = captureDiagnostics();
    const res = mockResponse();
    const externalError = vi.fn();
    res.on("error", externalError);
    await edgeFor(new Response("ok"))(mockIncoming({}), res);
    const failure = Object.assign(new Error("handled event fixture"), { code: "EPIPE" });

    expect(() => res.emit("error", failure)).not.toThrow();
    expect(externalError).toHaveBeenCalledExactlyOnceWith(failure);
    expect(logs.records().find((record) => record.stage === "response_error")).toMatchObject({
      errorType: "Error", errorCode: "EPIPE",
    });
    res.emit("close");
    expect(res.listeners("error")).toEqual([externalError]);
    expect(res.listenerCount(errorMonitor)).toBe(0);
  });

  it("genera una correlación distinta por invocación", async () => {
    enableDiagnostics();
    const logs = captureDiagnostics();
    for (let i = 0; i < 2; i++) {
      const res = mockResponse();
      await edgeFor(new Response("ok"))(mockIncoming({}), res);
      res.emit("close");
    }
    expect(new Set(logs.records().map((record) => record.correlationId)).size).toBe(2);
  });
});
