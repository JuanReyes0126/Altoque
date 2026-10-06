/** Política de emisión: sin BD viva y sin valores de sesión en assertions/logs. */
import { APIError } from "better-auth/api";
import type { BetterAuthOptions } from "better-auth";
import { afterEach, describe, expect, it, vi } from "vitest";
import { auth } from "../auth/auth.js";
import { prisma } from "../database/prisma.js";

const beforeSession = auth.options.databaseHooks?.session?.create?.before;
if (!beforeSession) throw new Error("AUTH_SESSION_POLICY_MISSING");

describe("Auth · política de sesión activa", () => {
  afterEach(() => vi.restoreAllMocks());

  it("consulta solo status y conserva la sesión de una cuenta activa", async () => {
    const lookup = vi.spyOn(prisma.user, "findUnique").mockResolvedValueOnce({ status: "active" } as never);
    const session = { userId: "test-user-id", token: "session-fixture-marker" };
    const result = await beforeSession(session as never);
    expect(result === undefined).toBe(true);
    expect(lookup).toHaveBeenCalledExactlyOnceWith({ where: { id: session.userId }, select: { status: true } });
    expect(session.token === "session-fixture-marker").toBe(true);
  });

  it.each(["suspended", "blocked", "unknown", null])("rechaza %s con un error genérico sin datos privados", async (status) => {
    vi.spyOn(prisma.user, "findUnique").mockResolvedValueOnce(status === null ? null : { status } as never);
    let failure: unknown;
    try { await beforeSession({ userId: "private-user-fixture", token: "private-session-fixture" } as never); }
    catch (error) { failure = error; }
    expect(failure instanceof APIError).toBe(true);
    const body = (failure as APIError).body;
    expect(body?.code).toBe("ACCOUNT_INACTIVE");
    expect(JSON.stringify(body)).not.toMatch(/private-user-fixture|private-session-fixture|suspended|blocked/);
  });

  it("un fallo real de BD se propaga intacto y no se transforma en cuenta inactiva", async () => {
    const original = new Error("database-fixture-error");
    vi.spyOn(prisma.user, "findUnique").mockRejectedValueOnce(original);
    let failure: unknown;
    try { await beforeSession({ userId: "test-user-id" } as never); }
    catch (error) { failure = error; }
    expect(failure === original).toBe(true);
  });

  it("las sesiones siguen usando DB como fuente, sin cache cookie ni secondary storage", () => {
    const options: BetterAuthOptions = auth.options;
    expect(options.session?.cookieCache?.enabled ?? false).toBe(false);
    expect(Boolean(options.secondaryStorage)).toBe(false);
    expect(auth.options.emailAndPassword?.requireEmailVerification).toBe(true);
  });
});
