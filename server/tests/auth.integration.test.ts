/**
 * ALTOQUE · Integración de autenticación contra Neon DEV (F1.6)
 *
 * Activación: ALTOQUE_TEST_DB=1 DATABASE_URL=<dev> BETTER_AUTH_SECRET=<32+> npx vitest run
 *
 * Cobertura pedida:
 *  - signup cannot choose admin / super_admin
 *  - cuenta no verificada no obtiene sesión (y no accede a protegidos)
 *  - expired session rejected
 *  - revoked session rejected
 *  - reset token cannot be reused
 *  - verification token expires
 *  - el comportamiento de sesión coincide con el esquema oficial de Better Auth
 */
import { afterAll, describe, expect, it } from "vitest";
import { auth } from "../auth/auth";
import { prisma } from "../database/prisma";
import { hashPassword } from "better-auth/crypto";
import { HAS_DB } from "./setup";

const d = describe.runIf(HAS_DB)("Auth · integración (Neon dev)", () => {
  const createdEmails: string[] = [];

  afterAll(async () => {
    for (const email of createdEmails) {
      const u = await prisma.user.findUnique({ where: { email } });
      if (u) await prisma.user.delete({ where: { id: u.id } }); // cascada limpia sesiones/cuentas
    }
    await prisma.$disconnect();
  });

  const uniqueEmail = (tag: string) => {
    const email = `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.altoque.do`;
    createdEmails.push(email);
    return email;
  };

  it("signup con role:'admin' en el body NO crea admin (input:false)", async () => {
    const email = uniqueEmail("admin-esc");
    const res = await auth.api.signUpEmail({
      body: { name: "Escalada", email, password: "Password123!", role: "admin" } as never,
    });
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user!.role).toBe("customer"); // el servidor ignoró el campo
    expect(res.user.role as string).not.toBe("admin");
  });

  it("signup con role:'super_admin' tampoco", async () => {
    const email = uniqueEmail("super-esc");
    await auth.api.signUpEmail({
      body: { name: "Super Escalada", email, password: "Password123!", role: "super_admin" } as never,
    });
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user!.role).toBe("customer");
  });

  it("cuenta no verificada NO obtiene sesión al registrarse", async () => {
    const email = uniqueEmail("unver");
    const res = await auth.api.signUpEmail({
      body: { name: "No Verificado", email, password: "Password123!" },
    });
    // requireEmailVerification: la respuesta NO incluye sesión válida.
    expect((res as { token?: string }).token).toBeTruthy(); // token de verificación
    expect((res as { session?: unknown }).session).toBeFalsy();

    // e intentar login antes de verificar también falla
    await expect(
      auth.api.signInEmail({ body: { email, password: "Password123!" } }),
    ).rejects.toBeTruthy();
  });

  it("expired session → rechazada", async () => {
    const email = uniqueEmail("expire");
    await prisma.user.create({
      data: {
        name: "Expira", email, emailVerified: true, role: "customer",
        account: { create: { accountId: email, providerId: "credential", password: await hashPassword("Password123!") } },
      },
    });
    const res = await auth.api.signInEmail({ body: { email, password: "Password123!" } });
    expect(res.session).toBeTruthy();

    // expirar la sesión directamente en BD (fuente de verdad)
    await prisma.session.update({
      where: { id: res.session.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const cookie = `better-auth.session_token=${res.session.token}`;
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    expect(session).toBeNull(); // sesión expirada rechazada
  });

  it("revoked session (logout) → rechazada", async () => {
    const email = uniqueEmail("revoke");
    await prisma.user.create({
      data: {
        name: "Revoca", email, emailVerified: true, role: "customer",
        account: { create: { accountId: email, providerId: "credential", password: await hashPassword("Password123!") } },
      },
    });
    const res = await auth.api.signInEmail({ body: { email, password: "Password123!" } });
    const cookie = `better-auth.session_token=${res.session.token}`;

    await auth.api.signOut({ headers: new Headers({ cookie }) });

    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    expect(session).toBeNull(); // sesión revocada rechazada
  });

  it("verification token expirado → rechazado", async () => {
    const email = uniqueEmail("vexp");
    const res = await auth.api.signUpEmail({
      body: { name: "V Exp", email, password: "Password123!" },
    });
    const token = (res as { token?: string }).token;
    expect(token).toBeTruthy();

    // expirar todos los tokens de verificación del usuario
    await prisma.verification.updateMany({
      where: { identifier: { contains: email } },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await expect(auth.api.verifyEmail({ query: { token: token! } })).rejects.toBeTruthy();

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user!.emailVerified).toBe(false);
  });

  it("reset token de un solo uso: el segundo intento falla", async () => {
    const email = uniqueEmail("reset");
    await prisma.user.create({
      data: {
        name: "Reset", email, emailVerified: true, role: "customer",
        account: { create: { accountId: email, providerId: "credential", password: await hashPassword("Password123!") } },
      },
    });
    const res = await auth.api.requestPasswordReset({ body: { email, redirectTo: "http://localhost:3000/reset" } });
    const token = (res as { token?: string } | null)?.token;
    expect(token).toBeTruthy();

    await auth.api.resetPassword({ body: { token: token!, newPassword: "NewPassword123!" } });

    // reutilizar el mismo token debe fallar
    await expect(
      auth.api.resetPassword({ body: { token: token!, newPassword: "OtherPassword123!" } }),
    ).rejects.toBeTruthy();

    // y la contraseña nueva es la vigente
    const ok = await auth.api.signInEmail({ body: { email, password: "NewPassword123!" } });
    expect(ok.session).toBeTruthy();
  });
});

// referencia para evitar tree-shaking del describe condicional
void d;
