/** Transporte transaccional real. Nunca imprime destinatarios, cuerpos ni enlaces. */
import { z } from "zod";
import { env } from "../config/env.js";

export const VERIFICATION_EXPIRES_SECONDS = 60 * 60;
export const RESET_PASSWORD_EXPIRES_SECONDS = 60 * 60;
export const EMAIL_TIMEOUT_MS = 8_000;

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

function escapeHTML(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

/** HTML autocontenido, sin recursos externos ni dominio/remitente hardcodeado. */
function accountEmailHTML(name: string, url: string, reset: boolean): string {
  const heading = reset ? "Recupera el acceso a tu cuenta" : "Bienvenido a Altoque";
  const action = reset ? "Restablecer contraseña" : "Verificar mi correo";
  const description = reset
    ? "Recibimos una solicitud para restablecer tu contraseña. Usa el siguiente botón para elegir una nueva."
    : "Estás a un paso de conectar con los servicios que necesitas. Verifica tu correo para activar tu cuenta.";
  const safeURL = escapeHTML(url);
  return `<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f5;font-family:Arial,Helvetica,sans-serif;color:#17382d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e0e8e3;border-radius:16px">
<tr><td style="padding:32px 32px 16px;font-size:28px;font-weight:bold;color:#0c5f46">altoque<span style="color:#e7a91a">.</span></td></tr>
<tr><td style="padding:0 32px 32px"><h1 style="margin:8px 0 20px;font-size:26px;line-height:1.25">${heading}</h1>
<p style="font-size:16px;line-height:1.6">Hola ${escapeHTML(name)},</p>
<p style="font-size:16px;line-height:1.6;color:#4b6359">${description}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0"><tr><td style="border-radius:8px;background:#0c5f46"><a href="${safeURL}" style="display:inline-block;padding:15px 24px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none">${action}</a></td></tr></table>
<p style="font-size:14px;line-height:1.6;color:#4b6359">El enlace expira en 1 hora. Es personal: no lo compartas.</p>
<p style="font-size:13px;line-height:1.6;color:#718378">Si el botón no funciona, copia este enlace en tu navegador:</p>
<p style="font-size:13px;line-height:1.6;word-break:break-all"><a href="${safeURL}" style="color:#0c5f46">${safeURL}</a></p>
<hr style="border:0;border-top:1px solid #e0e8e3;margin:28px 0 20px">
<p style="font-size:13px;line-height:1.6;color:#718378">${reset ? "Si no solicitaste este cambio, ignora este mensaje. Tu contraseña seguirá igual." : "Si no creaste esta cuenta, puedes ignorar este mensaje."}</p>
<p style="font-size:13px;color:#718378;margin:20px 0 0">El equipo de Altoque</p>
</td></tr></table></td></tr></table></body></html>`;
}

export class EmailDeliveryError extends Error {
  constructor(readonly code: "EMAIL_NOT_CONFIGURED" | "EMAIL_DELIVERY_FAILED") {
    super(code === "EMAIL_NOT_CONFIGURED"
      ? "El servicio de correo todavía no está configurado. Inténtalo más tarde."
      : "No pudimos enviar el correo. Inténtalo de nuevo.");
    this.name = "EmailDeliveryError";
  }
}

/** Fail closed incluso en local: no sustituir envíos por logs o respuestas ficticias. */
export function assertEmailConfigured(): { apiKey: string; from: string } {
  const { RESEND_API_KEY: apiKey, EMAIL_FROM: from } = env();
  const address = from?.match(/^[^<>\r\n]+<([^<>]+)>$/)?.[1] ?? from;
  if (!apiKey || !from || /\s/.test(apiKey) || /[\r\n]/.test(from)
    || !z.string().email().safeParse(address).success) {
    throw new EmailDeliveryError("EMAIL_NOT_CONFIGURED");
  }
  return { apiKey, from };
}

export async function sendEmail(email: OutgoingEmail): Promise<void> {
  const { apiKey, from } = assertEmailConfigured();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [email.to], subject: email.subject, text: email.text,
        ...(email.html ? { html: email.html } : {}),
      }),
      signal: controller.signal,
      redirect: "error",
    });
    // No propagar el cuerpo del proveedor: puede contener datos privados.
    if (!response.ok) throw new EmailDeliveryError("EMAIL_DELIVERY_FAILED");
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("id" in body)
      || typeof body.id !== "string" || !body.id.trim()) {
      throw new EmailDeliveryError("EMAIL_DELIVERY_FAILED");
    }
  } catch {
    // Red, timeout, JSON inválido y rechazos remotos comparten un error seguro.
    throw new EmailDeliveryError("EMAIL_DELIVERY_FAILED");
  } finally {
    clearTimeout(timeout);
  }
}

export const verificationEmail = async ({ user, url }: { user: { email: string; name: string }; url: string }) => {
  await sendEmail({
    to: user.email,
    subject: "Verifica tu correo — Altoque",
    text: `Hola ${user.name},\n\nConfirma tu correo para activar tu cuenta en Altoque:\n${url}\n\nEl enlace expira en 1 hora. Si no creaste esta cuenta, ignora este mensaje.`,
    html: accountEmailHTML(user.name, url, false),
  });
};

export const resetPasswordEmail = async ({ user, url }: { user: { email: string; name: string }; url: string }) => {
  await sendEmail({
    to: user.email,
    subject: "Restablece tu contraseña — Altoque",
    text: `Hola ${user.name},\n\nRestablece tu contraseña aquí:\n${url}\n\nEl enlace expira en 1 hora y solo puede usarse una vez. Si no lo solicitaste, ignora este mensaje.`,
    html: accountEmailHTML(user.name, url, true),
  });
};
