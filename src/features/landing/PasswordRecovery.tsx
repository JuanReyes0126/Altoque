import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../../lib/api";
import { ApiHttpError } from "../../lib/http";

export function recoveryError(error: unknown): string {
  if (error instanceof ApiHttpError) {
    if (error.code === "RATE_LIMITED" || error.status === 429) return "Demasiadas solicitudes. Espera unos minutos antes de intentar de nuevo.";
    if (error.code === "INVALID_TOKEN") return "El enlace ya fue utilizado o venció. Solicita uno nuevo.";
    if (error.code === "PASSWORD_TOO_SHORT") return "La contraseña debe tener al menos 8 caracteres.";
  }
  return "No pudimos completar la operación. Inténtalo nuevamente.";
}

/** Consume solo el token de reset que Better Auth redirige; nunca lo persiste. */
export function takeResetLink(location: Pick<Location, "search" | "pathname" | "hash">, replace: (url: string) => void) {
  const params = new URLSearchParams(location.search);
  if (params.get("flow") !== "password-reset") return { token: "", invalid: false };
  const token = params.get("token") ?? "";
  const invalid = params.get("error") === "INVALID_TOKEN";
  params.delete("token"); params.delete("error"); params.delete("flow");
  const remaining = params.toString();
  replace(`${location.pathname}${remaining ? `?${remaining}` : ""}${location.hash}`);
  return { token, invalid };
}

export function PasswordRecovery() {
  const navigate = useNavigate();
  const [link, setLink] = useState<{ token: string; invalid: boolean } | null>(null);
  const initialized = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setLink(takeResetLink(window.location, (url) => window.history.replaceState({}, "", url)));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!link || pending.current) return;
    setError(""); setMessage("");
    if (link.token && password !== confirmation) { setError("Las contraseñas no coinciden."); return; }
    pending.current = true; setBusy(true);
    try {
      if (link.token) {
        await authApi.resetPassword(link.token, password);
        setPassword(""); setConfirmation(""); setLink({ token: "", invalid: false });
        setComplete(true);
        setMessage("Contraseña actualizada. Inicia sesión con tu nueva contraseña.");
      } else {
        await authApi.requestPasswordReset(email.trim());
        setMessage("Si el correo corresponde a una cuenta, recibirás un enlace para restablecer la contraseña. Revisa también spam.");
      }
    } catch (failure) { setError(recoveryError(failure)); }
    finally { pending.current = false; setBusy(false); }
  };

  if (!link) return <main className="max-w-md mx-auto p-6"><p role="status">Preparando recuperación…</p></main>;
  return (
    <main className="max-w-md mx-auto px-5 py-10 min-h-dvh">
      <button type="button" onClick={() => navigate("/")} className="btn-ghost h-11 px-4">Volver al inicio</button>
      <h1 className="font-disp font-bold text-2xl mt-6">{link.token ? "Elige tu nueva contraseña" : "Recuperar contraseña"}</h1>
      {link.invalid && <p role="alert" className="text-cor mt-4">El enlace ya fue utilizado o venció. Solicita uno nuevo.</p>}
      {message && <p role="status" className="card p-4 mt-5 text-pine">{message}</p>}
      {error && <p role="alert" className="card p-4 mt-5 text-cor">{error}</p>}
      {!complete && (
        <form onSubmit={submit} className="card p-5 mt-5">
          <fieldset disabled={busy} className="space-y-4">
            {link.token ? <>
              <label htmlFor="reset-password" className="block text-sm font-bold">Nueva contraseña
                <input id="reset-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-line p-3" />
              </label>
              <label htmlFor="reset-confirmation" className="block text-sm font-bold">Confirmar contraseña
                <input id="reset-confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 w-full rounded-xl border border-line p-3" />
              </label>
            </> : <label htmlFor="recovery-email" className="block text-sm font-bold">Correo electrónico
              <input id="recovery-email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-line p-3" />
            </label>}
          </fieldset>
          <button type="submit" disabled={busy} className="btn-pine h-12 w-full mt-5 disabled:opacity-50">{busy ? "Un momento…" : link.token ? "Guardar contraseña" : "Solicitar enlace"}</button>
        </form>
      )}
    </main>
  );
}
