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
  const identityLabels = new Set(["preview", "production", "other", "invalid"]);
  const isIdentity = (entry: unknown) => typeof entry === "string" && identityLabels.has(entry);
  const identities = () => normal.mock.calls.filter(([entry]) => isIdentity(entry)).map(([entry]) => entry);
  const records = () =>
    [...normal.mock.calls, ...errors.mock.calls].filter(([entry]) => !isIdentity(entry)).map(([entry]) => {
      expect(typeof entry).toBe("string");
      const record = JSON.parse(entry as string) as DiagnosticRecord;
      expect(record.event).toBe("edge_diag");
      return record;
    });
  return { normal, errors, records, identities };
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

describe("borde dual · identidad de DATABASE_URL sin conexión", () => {
  const preview = "ep-flat-violet-au1e8xde";
  const production = "ep-steep-hall-au81p0co";
  const suffix = ".c-10.us-east-1.aws.neon.tech";
  // Exclusivamente fixtures sintéticos; nunca cargar .env ni la app/Prisma real.
  const user = "PRIVATE_DATABASE_USER_SENTINEL";
  const password = "PRIVATE_DATABASE_PASSWORD_SENTINEL";
  const database = "PRIVATE_DATABASE_NAME_SENTINEL";
  const token = "PRIVATE_DATABASE_TOKEN_SENTINEL";
  const fixtureUrl = (host: string) =>
    `postgresql://${user}:${password}@${host}/${database}?sslmode=require&token=${token}`;

  function prismaFixture() {
    const client = {
      $queryRaw: vi.fn(async (..._args: unknown[]) => []),
      $connect: vi.fn(async () => {}),
      $on: vi.fn((_event: string, _listener: (event: unknown) => void) => {}),
    };
    const constructor = vi.fn(function () { return client; });
    return { client, constructor };
  }

  async function withPrismaFixture(run: (fixture: ReturnType<typeof prismaFixture>) => Promise<void>) {
    const fixture = prismaFixture();
    const cacheKey = "__altoquePrisma";
    const savedCache = Object.getOwnPropertyDescriptor(globalThis, cacheKey);
    Reflect.deleteProperty(globalThis, cacheKey);
    vi.resetModules();
    vi.doMock("@prisma/client", () => ({ PrismaClient: fixture.constructor }));
    try {
      // Importar el módulo real en frío, pero nunca el cliente/engine de PostgreSQL.
      const { prisma } = await import("../database/prisma.js");
      expect(prisma).toBe(fixture.client);
      await run(fixture);
    } finally {
      if (savedCache) Object.defineProperty(globalThis, cacheKey, savedCache);
      else Reflect.deleteProperty(globalThis, cacheKey);
      vi.doUnmock("@prisma/client");
      vi.resetModules();
    }
  }

  it.each([
    ["preview", fixtureUrl(`${preview}${suffix}`)],
    ["production", fixtureUrl(`${production}-pooler${suffix}`)],
    ["other", fixtureUrl("database.example")],
    ["invalid", token],
  ])("cold start y clasificación %s no conectan ni ejecutan SELECT 1", async (identity, value) => {
    enableDiagnostics();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", value);
    const logs = captureDiagnostics();
    await withPrismaFixture(async ({ client, constructor }) => {
      expect(constructor).toHaveBeenCalledOnce();
      expect(client.$on.mock.calls.map(([event]) => event)).toEqual(["query", "warn", "error"]);
      expect(client.$queryRaw).not.toHaveBeenCalled();
      expect(client.$connect).not.toHaveBeenCalled();
      expect(logs.normal).not.toHaveBeenCalled();
      expect(logs.errors).not.toHaveBeenCalled();

      const response = new Response("unchanged");
      expect(await edgeFor(response)(new Request("https://preview.example/"))).toBe(response);
      expect(logs.identities()).toEqual([identity]);
      expect(client.$queryRaw).not.toHaveBeenCalled();
      expect(client.$connect).not.toHaveBeenCalled();
      expect(response.bodyUsed).toBe(false);
      expect(logs.records().map((record) => record.stage)).toEqual([
        "dispatch_web", "app_fetch_start", "app_fetch_done", "web_response_returned",
      ]);
      const output = JSON.stringify([...logs.normal.mock.calls, ...logs.errors.mock.calls]);
      for (const privateValue of [user, password, database, token, preview, production, "neon.tech", value])
        expect(output.indexOf(privateValue)).toBe(-1);
    });
  });

  it.each([
    ["preview", "0", "production", false],
    ["development", "0", "development", false],
    ["production", "1", "production", false],
    ["preview", "1", "production", true],
  ])("entorno=%s diag=%s conserva consultas normales", async (environment, diag, nodeEnv, enabled) => {
    vi.stubEnv("VERCEL_ENV", environment);
    vi.stubEnv("ALTOQUE_DIAG", diag);
    vi.stubEnv("NODE_ENV", nodeEnv);
    vi.stubEnv("DATABASE_URL", fixtureUrl(`${preview}${suffix}`));
    const logs = captureDiagnostics();
    await withPrismaFixture(async ({ client }) => {
      expect(client.$queryRaw).not.toHaveBeenCalled();
      expect(client.$connect).not.toHaveBeenCalled();
      expect(client.$on).toHaveBeenCalledTimes(enabled ? 3 : 0);
      const fetch = async () => {
        await client.$queryRaw`SELECT normal_request_fixture`;
        return new Response("normal query result", { status: 201 });
      };
      const response = await createEdgeHandler({ fetch })(new Request("https://preview.example/"));
      expect(await response.text()).toBe("normal query result");
      expect(response.status).toBe(201);
      expect(client.$queryRaw).toHaveBeenCalledOnce();
      expect(client.$queryRaw.mock.calls[0][0]).toEqual(["SELECT normal_request_fixture"]);
      expect(logs.identities()).toEqual(enabled ? ["preview"] : []);
      if (!enabled) expect(logs.normal).not.toHaveBeenCalled();
      expect(logs.errors).not.toHaveBeenCalled();
    });
  });

  it("desarrollo con DIAG conserva el self-test local", async () => {
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("ALTOQUE_DIAG", "1");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATABASE_URL", fixtureUrl("127.0.0.1:1"));
    const logs = captureDiagnostics();
    await withPrismaFixture(async ({ client }) => {
      expect(client.$queryRaw).toHaveBeenCalledOnce();
      expect(client.$queryRaw.mock.calls[0][0]).toEqual(["SELECT 1"]);
      expect(client.$connect).not.toHaveBeenCalled();
      expect(client.$on.mock.calls.map(([event]) => event)).toEqual(["query", "warn", "error"]);
      expect(logs.identities()).toEqual([]);
      expect(logs.errors).not.toHaveBeenCalled();
      const entries = logs.normal.mock.calls.map(([line]) => JSON.parse(line as string));
      expect(entries).toEqual([expect.objectContaining({ msg: "[diag][prisma:selftest] SELECT 1 ok" })]);
    });
  });

  it("Preview conserva observación Prisma sin registrar SQL, parámetros ni mensajes", async () => {
    enableDiagnostics();
    vi.stubEnv("NODE_ENV", "production");
    const value = fixtureUrl(`${preview}${suffix}`);
    vi.stubEnv("DATABASE_URL", value);
    const logs = captureDiagnostics();
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
    await withPrismaFixture(async ({ client }) => {
      for (const [event, listener] of client.$on.mock.calls) {
        listener({ duration: 7, query: value, params: password, message: token });
        expect(["query", "warn", "error"].indexOf(event)).not.toBe(-1);
      }
      expect(client.$queryRaw).not.toHaveBeenCalled();
      expect(client.$connect).not.toHaveBeenCalled();
      expect(JSON.parse(logs.normal.mock.calls[0][0] as string)).toMatchObject({
        msg: "[diag][prisma:query]", durationMs: 7,
      });
      const output = JSON.stringify([...logs.normal.mock.calls, ...warnings.mock.calls, ...logs.errors.mock.calls]);
      for (const privateValue of [value, user, password, database, token, preview, production, "neon.tech"])
        expect(output.indexOf(privateValue)).toBe(-1);
    });
  });

  it.each([
    ["Preview directo", fixtureUrl(`${preview}${suffix}`), "preview"],
    ["Preview pooled", fixtureUrl(`${preview}-pooler${suffix}`), "preview"],
    ["Production directo", fixtureUrl(`${production}${suffix}`), "production"],
    ["Production pooled", fixtureUrl(`${production}-pooler${suffix}`), "production"],
    ["alias postgres", fixtureUrl(`${preview}${suffix}`).replace("postgresql:", "postgres:"), "preview"],
    ["DNS con mayúsculas", fixtureUrl(`${preview}${suffix}`.toUpperCase()), "preview"],
    ["credenciales codificadas", fixtureUrl(`${preview}${suffix}`).replace(password, "PRIVATE%40%3A%23%2F"), "preview"],
    ["otro endpoint Neon", fixtureUrl(`ep-unknown-fixture${suffix}`), "other"],
    ["PostgreSQL local", fixtureUrl("127.0.0.1:5432"), "other"],
    ["PostgreSQL IPv6", fixtureUrl("[::1]:5432"), "other"],
    ["otro dominio", fixtureUrl("database.example"), "other"],
    ["dominio con sufijo falso", fixtureUrl(`${preview}${suffix}.evil.example`), "other"],
    ["prefijo del endpoint", fixtureUrl(`prefix-${preview}${suffix}`), "other"],
    ["sufijo del endpoint", fixtureUrl(`${preview}-suffix${suffix}`), "other"],
    ["pooler duplicado", fixtureUrl(`${preview}-pooler-pooler${suffix}`), "other"],
    ["host conocido en credenciales", `postgresql://${preview}:${production}@database.example/${database}`, "other"],
    ["host conocido en path", fixtureUrl("database.example").replace(database, preview), "other"],
    ["host conocido en query inerte", `${fixtureUrl("database.example")}&reference=${preview}&other=${production}`, "other"],
    ["host diferente en query no cambia la autoridad", `${fixtureUrl(`${preview}${suffix}`)}&fixture=${production}`, "preview"],
    ["override host", `${fixtureUrl(`${preview}${suffix}`)}&host=${production}`, "invalid"],
    ["override host codificado", `${fixtureUrl(`${preview}${suffix}`)}&h%6fst=${production}`, "invalid"],
    ["override host vacío", `${fixtureUrl(`${preview}${suffix}`)}&host=`, "invalid"],
    ["override host duplicado", `${fixtureUrl(`${preview}${suffix}`)}&host=fixture&host=${production}`, "invalid"],
    ["override hostaddr", `${fixtureUrl(`${preview}${suffix}`)}&HOSTADDR=127.0.0.1`, "invalid"],
    ["override puerto", `${fixtureUrl(`${preview}${suffix}`)}&port=5433`, "invalid"],
    ["override servicio", `${fixtureUrl(`${preview}${suffix}`)}&service=fixture`, "invalid"],
    ["override archivo servicio", `${fixtureUrl(`${preview}${suffix}`)}&servicefile=fixture`, "invalid"],
    ["override options", `${fixtureUrl(`${preview}${suffix}`)}&options=endpoint%3D${production}`, "invalid"],
    ["override endpoint", `${fixtureUrl(`${preview}${suffix}`)}&endpoint=${production}`, "invalid"],
    ["puerto malformado", fixtureUrl(`${preview}${suffix}:not-a-port`), "invalid"],
    ["esquema HTTPS", fixtureUrl(`${preview}${suffix}`).replace("postgresql:", "https:"), "invalid"],
    ["esquema vacío", fixtureUrl(`${preview}${suffix}`).replace("postgresql:", ""), "invalid"],
    ["hostname ausente", "postgresql:///fixture", "invalid"],
    ["hostname codificado", fixtureUrl(`${preview}%2Ec-10.us-east-1.aws.neon.tech`), "invalid"],
    ["hostname Unicode", fixtureUrl(`é${preview}${suffix}`), "invalid"],
    ["hostname con salto de línea", fixtureUrl(`${preview}\n${suffix}`), "invalid"],
    ["hostname con espacio", fixtureUrl(`${preview} ${suffix}`), "invalid"],
    ["backslash en autoridad", fixtureUrl(`${preview}\\${suffix}`), "invalid"],
    ["fragmento", `${fixtureUrl(`${preview}${suffix}`)}#${token}`, "invalid"],
    ["fragmento vacío", `${fixtureUrl(`${preview}${suffix}`)}#`, "invalid"],
    ["texto no URL", token, "invalid"],
    ["vacío", "", "invalid"],
    ["ausente", undefined, "invalid"],
  ])("clasifica %s; sólo emite la etiqueta permitida", async (_name, value, expected) => {
    enableDiagnostics();
    vi.stubEnv("DATABASE_URL", value);
    const logs = captureDiagnostics();
    const response = new Response("untouched", { status: 202, headers: { "x-fixture": "unchanged" } });
    const returned = await edgeFor(response)(new Request("https://preview.example/"));

    expect(logs.identities()).toEqual([expected]);
    expect(returned).toBe(response);
    expect(response.status).toBe(202);
    expect(response.headers.get("x-fixture")).toBe("unchanged");
    expect(response.bodyUsed).toBe(false);
    expect(logs.errors).not.toHaveBeenCalled();
    // Todos los argumentos son una etiqueta o el payload cerrado preexistente.
    for (const call of [...logs.normal.mock.calls, ...logs.errors.mock.calls]) expect(call).toHaveLength(1);
    expect(logs.records().map((record) => record.stage)).toEqual([
      "dispatch_web", "app_fetch_start", "app_fetch_done", "web_response_returned",
    ]);
    const output = JSON.stringify([...logs.normal.mock.calls, ...logs.errors.mock.calls]);
    for (const privateValue of [user, password, database, token, preview, production, "neon.tech", "postgresql://", "postgres://"])
      expect(output.indexOf(privateValue)).toBe(-1);
    if (value) expect(output.indexOf(value)).toBe(-1);
    expect(await response.text()).toBe("untouched");
  });

  it.each([
    ["preview", "1", true],
    ["preview", "0", false],
    ["preview", "true", false],
    ["preview", "01", false],
    ["preview", "1 ", false],
    ["preview", "", false],
    ["preview", undefined, false],
    ["Preview", "1", false],
    ["production", "1", false],
    ["development", "1", false],
    [undefined, "1", false],
  ])("gate exacto entorno=%s diag=%s", async (environment, diag, enabled) => {
    vi.stubEnv("VERCEL_ENV", environment);
    vi.stubEnv("ALTOQUE_DIAG", diag);
    vi.stubEnv("DATABASE_URL", fixtureUrl(`${preview}${suffix}`));
    const logs = captureDiagnostics();
    const res = mockResponse();
    await edgeFor(new Response("unchanged"))(mockIncoming({}), res);
    expect(logs.identities()).toEqual(enabled ? ["preview"] : []);
    expect(bodyOf(res)).toBe("unchanged");
    expect(res.statusCode).toBe(200);
    expect(res.writableEnded).toBe(true);
    res.emit("close");
    const response = new Response("native unchanged", { status: 201 });
    expect(await edgeFor(response)(new Request("https://preview.example/"))).toBe(response);
    expect(logs.identities()).toEqual(enabled ? ["preview", "preview"] : []);
    if (!enabled) {
      expect(logs.normal).not.toHaveBeenCalled();
      expect(logs.errors).not.toHaveBeenCalled();
    }
  });

  it("Node preserva bytes, headers y cookies sin exponer identidad al cliente", async () => {
    enableDiagnostics();
    vi.stubEnv("DATABASE_URL", fixtureUrl(`${production}-pooler${suffix}`));
    const logs = captureDiagnostics();
    const res = mockResponse();
    const bytes = Uint8Array.from([0, 127, 128, 255]);
    const returned = await edgeFor(new Response(bytes, {
      status: 201,
      headers: [["x-fixture", "unchanged"], ["set-cookie", "fixture=unchanged; HttpOnly"]],
    }))(mockIncoming({}), res);

    expect(logs.identities()).toEqual(["production"]);
    expect(returned).toBeUndefined();
    expect(res.statusCode).toBe(201);
    expect(res.headers).toEqual({ "x-fixture": "unchanged", "set-cookie": ["fixture=unchanged; HttpOnly"] });
    expect(Buffer.concat(res.bodyChunks)).toEqual(Buffer.from(bytes));
    expect(res.writableEnded).toBe(true);
    res.emit("close");
    const output = JSON.stringify([...logs.normal.mock.calls, ...logs.errors.mock.calls]);
    for (const privateValue of [user, password, database, token, preview, production, "neon.tech"])
      expect(output.indexOf(privateValue)).toBe(-1);
    expect(logs.records().some((record) => record.stage === "response_close")).toBe(true);
  });

  it("fallo del log de identidad no cambia Response ni el diagnóstico existente", async () => {
    enableDiagnostics();
    vi.stubEnv("DATABASE_URL", fixtureUrl(`${preview}${suffix}`));
    const logs = captureDiagnostics();
    logs.normal.mockImplementationOnce(() => { throw new Error("PRIVATE_LOGGER_FAILURE_SENTINEL"); });
    const response = new Response("unchanged");
    const returned = await edgeFor(response)(new Request("https://preview.example/"));
    expect(returned).toBe(response);
    expect(logs.normal.mock.calls[0]).toEqual(["preview"]);
    expect(logs.errors).not.toHaveBeenCalled();
    expect(logs.records().map((record) => record.stage)).toEqual([
      "dispatch_web", "app_fetch_start", "app_fetch_done", "web_response_returned",
    ]);
    expect(JSON.stringify(logs.normal.mock.calls).indexOf("PRIVATE_LOGGER_FAILURE_SENTINEL")).toBe(-1);
    expect(await response.text()).toBe("unchanged");
  });
});

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
