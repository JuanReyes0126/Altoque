/** Bootstrap explícito: nunca promueve cuentas existentes ni rota passwords. */
import { Prisma, type PrismaClient } from "@prisma/client";
import { createLocalAccountIssuer } from "better-auth/db";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { ulid } from "../../lib/ids.js";

export interface AdminCredentials { email: string; password: string }

export function adminCredentials(environment: NodeJS.ProcessEnv, optional = false): AdminCredentials | null {
  if (optional && !environment.SEED_ADMIN_EMAIL && !environment.SEED_ADMIN_PASSWORD) return null;
  const email = environment.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = environment.SEED_ADMIN_PASSWORD;
  if (!z.string().email().safeParse(email).success || typeof password !== "string" || password.length < 16 || password.length > 128) {
    throw new Error("ADMIN_SEED_CREDENTIALS_INVALID");
  }
  return { email: email!, password };
}

export async function bootstrapAdmin(prisma: PrismaClient, credentials: AdminCredentials): Promise<"created" | "already-provisioned"> {
  const inspectExisting = async () => {
    const matches = await prisma.user.findMany({
      where: { email: { equals: credentials.email, mode: "insensitive" } },
      take: 2,
      select: {
        id: true, email: true, role: true, status: true, emailVerified: true,
        admin_profile: { select: { admin_role: true } },
        account: { where: { providerId: "credential" }, select: { accountId: true, issuer: true, password: true } },
      },
    });
    if (matches.length === 0) return false;
    if (matches.length !== 1) throw new Error("ADMIN_EXISTING_ACCOUNT_REQUIRES_REVIEW");
    const existing = matches[0];
    const account = existing.account[0];
    if (existing.email !== credentials.email || existing.role !== "admin" || existing.status !== "active" || !existing.emailVerified
      || existing.admin_profile?.admin_role !== "super_admin" || existing.account.length !== 1
      || account.accountId !== existing.id || account.issuer !== createLocalAccountIssuer("credential") || !account.password) {
      throw new Error("ADMIN_EXISTING_ACCOUNT_REQUIRES_REVIEW");
    }
    return true;
  };
  if (await inspectExisting()) return "already-provisioned";
  const hashed = await hashPassword(credentials.password);
  const userId = ulid();
  try {
    // user + credential + admin_profile son una única creación anidada atómica.
    await prisma.user.create({
      data: {
        id: userId, name: "Admin Altoque", email: credentials.email,
        emailVerified: true, role: "admin", status: "active",
        account: { create: {
          accountId: userId, providerId: "credential",
          issuer: createLocalAccountIssuer("credential"), password: hashed,
        } },
        admin_profile: { create: { admin_role: "super_admin" } },
      },
    });
    return "created";
  } catch (error) {
    const target = error instanceof Prisma.PrismaClientKnownRequestError ? error.meta?.target : undefined;
    // Dos ejecuciones simultáneas solo pueden reutilizar el mismo admin válido.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
      && Array.isArray(target) && target.length === 1 && target[0] === "email" && await inspectExisting()) {
      return "already-provisioned";
    }
    throw error;
  }
}
