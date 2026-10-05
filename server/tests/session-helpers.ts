import { makeSignature } from "better-auth/crypto";
import { auth } from "../auth/auth.js";

/** Crea una sesión mediante Better Auth y firma su cookie sin registrar tokens. */
export async function createTestCookie(userId: string): Promise<string> {
  const context = await auth.$context;
  const session = await context.internalAdapter.createSession(userId);
  const signature = await makeSignature(session.token, context.secret);
  return `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${session.token}.${signature}`)}`;
}

export function testHeaders(cookie: string): Record<string, string> {
  return { Cookie: cookie, Origin: "http://localhost:3000" };
}
