import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Icon } from "../../components/icons";
import { FadeUp } from "../../components/ui/kit";
import { useApp } from "../../lib/state";
import { authApi } from "../../lib/api";
import { ApiHttpError } from "../../lib/http";
import { PATHS } from "../../lib/router";
import { EmailVerificationPanel, useVerificationResend, verificationErrorMessage } from "./EmailVerification";

/** La cuenta se verifica primero; el perfil y la disponibilidad se guardan en el panel. */
export function ProviderOnboarding() {
  const { session } = useApp();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resendState = useVerificationResend();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await authApi.signUp({ name: name.trim(), email: email.trim(), password, ...(phone.trim() ? { phone: phone.trim() } : {}) }, "/#/pro");
      setPendingEmail(email.trim()); setSent(true); setPassword("");
    } catch (failure) {
      if (failure instanceof ApiHttpError && failure.code === "VERIFICATION_EMAIL_FAILED") {
        setPendingEmail(email.trim()); setSent(false); setPassword("");
      }
      setError(failure instanceof ApiHttpError && failure.code === "USER_ALREADY_EXISTS"
        ? "Este correo ya está registrado. Inicia sesión para completar tu perfil profesional."
        : failure instanceof ApiHttpError && ["EMAIL_NOT_CONFIGURED", "VERIFICATION_EMAIL_FAILED"].includes(failure.code)
          ? verificationErrorMessage(failure)
          : failure instanceof ApiHttpError ? failure.message : "No pudimos crear tu cuenta. Inténtalo nuevamente.");
    } finally { setBusy(false); }
  };

  const resend = async () => {
    if (!pendingEmail) return;
    setError(null);
    await resendState.resend(pendingEmail);
  };

  if (session) return <Navigate to={PATHS.pro} replace />;

  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-line2 bg-paper">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          <button type="button" onClick={() => nav(PATHS.home)} className="btn-ghost w-10 h-10" aria-label="Volver al inicio">
            <Icon name="chevl" className="w-4.5 h-4.5" />
          </button>
          <p className="font-disp font-bold text-ink">Registro profesional</p>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-5 py-9">
        <FadeUp>
          {pendingEmail ? (
            <div className="card p-6">
              <EmailVerificationPanel email={pendingEmail} sent={sent} error={error ?? resendState.error}
                busy={resendState.busy} cooldown={resendState.cooldown} accepted={resendState.accepted}
                onResend={resend} onContinue={() => nav(PATHS.home)} />
            </div>
          ) : (
            <>
              <h1 className="font-disp font-bold text-3xl text-ink">Empieza con tu cuenta</h1>
              <p className="text-mut font-medium mt-3 leading-relaxed">Verifica tu correo y después completa tus servicios y zonas en el panel profesional.</p>
              <p className="text-soft text-sm mt-2">Podrás activar tu disponibilidad cuando tu perfil esté aprobado, aunque todavía no existan solicitudes.</p>
              <form onSubmit={submit} className="card p-6 mt-6 space-y-4">
                <label className="block text-sm font-semibold text-mut">Nombre completo
                  <input required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={event => setName(event.target.value)} className={inputClass} />
                </label>
                <label className="block text-sm font-semibold text-mut">Correo electrónico
                  <input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className={inputClass} />
                </label>
                <label className="block text-sm font-semibold text-mut">Teléfono (opcional)
                  <input type="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} className={inputClass} />
                </label>
                <label className="block text-sm font-semibold text-mut">Contraseña
                  <input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className={inputClass} />
                </label>
                {error && <p role="alert" className="text-cor text-sm font-semibold">{error}</p>}
                <button type="submit" disabled={busy} className="btn-pine w-full h-12 disabled:opacity-60">{busy ? "Creando cuenta…" : "Crear cuenta profesional"}</button>
                <button type="button" onClick={() => nav(PATHS.home)} className="btn-ghost w-full h-11">Ya tengo cuenta — iniciar sesión</button>
              </form>
            </>
          )}
        </FadeUp>
      </main>
    </div>
  );
}

const inputClass = "mt-1.5 w-full h-12 rounded-xl border border-line bg-paper px-4 font-semibold outline-none focus:border-pine";
