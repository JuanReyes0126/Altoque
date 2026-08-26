/**
 * ALTOQUE · Email transaccional (F1.2)
 *
 * Development: los enlaces se imprimen en consola (nunca en logs de
 * producción con nivel info; aquí es la salida local del desarrollador).
 * Production (F2): se conecta Resend usando RESEND_API_KEY — la
 * interfaz ya está fijada para no tocar auth.ts.
 */
import { log } from "../lib/logger.js";
import { env } from "../config/env.js";
import { diagEnabled, redactEmail } from "../lib/diag.js";

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail(email: OutgoingEmail): Promise<void> {
  // ⚠️ TEMPORAL (debug F1.8): demuestra en logs que sendEmail retorna de
  // inmediato (no espera transporte externo) cuando no hay RESEND_API_KEY.
  const t0 = Date.now();
  const e = env();
  if (!e.RESEND_API_KEY) {
    // Dev/test: consola. El contenido lleva token — aceptable SOLO local.
    console.info(
      `[altoque:email] → ${email.to}\n  asunto: ${email.subject}\n  ${email.text.split("\n").join("\n  ")}`,
    );
    if (diagEnabled()) {
      log.info("[diag] sendEmail (sin RESEND_API_KEY) → retorno inmediato", {
        durationMs: Date.now() - t0,
        to: redactEmail(email.to),
      });
    }
    return;
  }
  // F2: fetch("https://api.resend.com/emails") con RESEND_API_KEY,
  // from: EMAIL_FROM. Fallo → throw (Better Auth propaga el error).
  log.warn("RESEND_API_KEY definida pero el transporte se conecta en F2; usando consola", {
    to: "[REDACTED]",
  });
  console.info(`[altoque:email] → ${email.to}\n  asunto: ${email.subject}\n  ${email.text}`);
}

export const verificationEmail = async ({ user, url }: { user: { email: string; name: string }; url: string }) => {
  await sendEmail({
    to: user.email,
    subject: "Verifica tu correo — Altoque",
    text: `Hola ${user.name},\n\nConfirma tu correo para activar tu cuenta en Altoque:\n${url}\n\nEl enlace expira en 24 horas. Si no creaste esta cuenta, ignora este mensaje.`,
  });
};

export const resetPasswordEmail = async ({ user, url }: { user: { email: string; name: string }; url: string }) => {
  await sendEmail({
    to: user.email,
    subject: "Restablece tu contraseña — Altoque",
    text: `Hola ${user.name},\n\nRestablece tu contraseña aquí:\n${url}\n\nEl enlace expira en 1 hora y solo puede usarse una vez. Si no lo solicitaste, ignora este mensaje.`,
  });
};
