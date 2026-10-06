/** Límites durables del correo/auth: sujetos HMAC, nunca email o IP en texto. */
import { createHmac } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { consume, LIMITS, type RateLimitRule } from "../lib/ratelimit.js";

export function emailLimitSubject(email: string, secret: string): string {
  return authLimitSubject("email", email.trim().toLowerCase(), secret);
}

export function authLimitSubject(kind: "email" | "ip", value: string, secret: string): string {
  return `${kind}:${createHmac("sha256", secret).update(`${kind}:${value}`).digest("hex")}`;
}

export function authEmailRule(path: string): RateLimitRule | undefined {
  if (path === "/sign-in/email") return LIMITS.login;
  if (path === "/sign-up/email") return LIMITS.register;
  if (path === "/send-verification-email") return LIMITS.resendVerification;
  if (path === "/request-password-reset" || path === "/forget-password") return LIMITS.forgot;
}

export async function consumeEmailLimit(
  db: PrismaClient, path: string, email: string, secret: string, ip?: string | null,
): Promise<void> {
  const rule = authEmailRule(path);
  if (!rule) return;
  if (ip) await consume(db, { ...rule, bucket: `${rule.bucket}:ip` }, authLimitSubject("ip", ip, secret));
  await consume(db, rule, emailLimitSubject(email, secret));
}
