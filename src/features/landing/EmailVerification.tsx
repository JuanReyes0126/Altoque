import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../../components/icons";
import { authApi } from "../../lib/api";
import { ApiHttpError } from "../../lib/http";

/** Un error de red o de acceso no demuestra que el enlace haya expirado. */
export function verificationCompletionError(error: unknown): string {
  if (error instanceof ApiHttpError) {
    if (error.code === "ACCOUNT_INACTIVE") return "Esta cuenta no puede iniciar sesión. Contacta al equipo de Altoque.";
    if (["INVALID_TOKEN", "TOKEN_EXPIRED"].includes(error.code)) return "El enlace de verificación no es válido o expiró";
  }
  return "No pudimos completar la verificación. Vuelve a abrir el enlace del correo.";
}

export function verificationErrorMessage(error: unknown): string {
  if (error instanceof ApiHttpError && error.code === "RATE_LIMITED") {
    return "Has solicitado varios correos. Espera unos minutos antes de volver a intentarlo.";
  }
  return "No pudimos enviar el correo de verificación. Puedes volver a intentarlo.";
}

export function useVerificationResend() {
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const cooldownUntil = useRef(0);

  const reset = useCallback(() => {
    generation.current++;
    inFlight.current = false;
    cooldownUntil.current = 0;
    setBusy(false); setCooldown(0); setAccepted(false); setError(null);
  }, []);

  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(Math.max(0, Math.ceil((cooldownUntil.current - Date.now()) / 1000))), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resend = async (email: string): Promise<boolean> => {
    if (!email || inFlight.current || Date.now() < cooldownUntil.current) return false;
    const current = generation.current;
    inFlight.current = true;
    setBusy(true); setAccepted(false); setError(null);
    try {
      await authApi.resendVerification(email);
      if (current !== generation.current) return false;
      setAccepted(true);
      cooldownUntil.current = Date.now() + 60_000;
      setCooldown(60);
      return true;
    } catch (failure) {
      if (current !== generation.current) return false;
      setError(verificationErrorMessage(failure));
      if (failure instanceof ApiHttpError && failure.code === "RATE_LIMITED") {
        cooldownUntil.current = Date.now() + 15 * 60_000;
        setCooldown(15 * 60);
      }
      return false;
    } finally {
      if (current === generation.current) { inFlight.current = false; setBusy(false); }
    }
  };

  return { busy, cooldown, accepted, error, resend, reset };
}

export function resendButtonLabel(busy: boolean, cooldown: number): string {
  if (busy) return "Enviando…";
  if (cooldown > 0) return cooldown >= 60 ? `Reenviar en ${Math.ceil(cooldown / 60)} min` : `Reenviar en ${cooldown} s`;
  return "Reenviar correo";
}

export function EmailVerificationPanel({ email, sent, error, busy, cooldown, accepted, onResend, onContinue }: {
  email: string; sent: boolean; error: string | null; busy: boolean; cooldown: number;
  accepted: boolean; onResend: () => void; onContinue: () => void;
}) {
  return (
    <div className="text-center py-2">
      <span className="w-16 h-16 rounded-2xl bg-pinesoft text-pine grid place-items-center mx-auto">
        <Icon name="doc" className="w-8 h-8" strokeWidth={1.8} />
      </span>
      <p className="font-disp font-bold text-lg text-ink mt-5">{sent ? "Revisa tu correo" : "Tu cuenta espera verificación"}</p>
      <p className="text-[0.85rem] text-mut font-medium leading-relaxed mt-2 max-w-xs mx-auto">
        Si el correo <strong className="text-ink">{email}</strong> corresponde a una cuenta pendiente, confirma el enlace de verificación para activar tu sesión.
      </p>
      {sent && <p className="text-[0.78rem] text-soft mt-3">Revisa también la carpeta de spam. Usa el enlace del correo más reciente.</p>}
      {error && <p role="alert" className="rounded-xl bg-corsoft text-cor px-4 py-3 text-[0.8rem] font-semibold mt-4">{error}</p>}
      {accepted && <p role="status" className="text-[0.78rem] text-pine mt-3">Solicitud de reenvío aceptada. Si tu correo sigue pendiente, recibirás el enlace.</p>}
      <div className="grid gap-2.5 mt-5">
        <button type="button" onClick={onContinue} className="btn-pine w-full h-12 text-[0.9rem]">Ya verifiqué — iniciar sesión</button>
        <button type="button" onClick={onResend} disabled={busy || cooldown > 0} className="btn-ghost w-full h-12 text-[0.9rem] disabled:opacity-60">
          {resendButtonLabel(busy, cooldown)}
        </button>
      </div>
    </div>
  );
}
