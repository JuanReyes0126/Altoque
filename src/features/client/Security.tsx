import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/icons";
import { authApi } from "../../lib/api";
import { ApiHttpError } from "../../lib/http";
import { useApp } from "../../lib/state";

export function securityError(error: unknown): string {
  if (error instanceof ApiHttpError) {
    if (error.code === "INVALID_PASSWORD") return "La contraseña actual no es correcta.";
    if (["UNAUTHORIZED", "UNAUTHENTICATED", "SESSION_NOT_FRESH", "SESSION_EXPIRED"].includes(error.code)) return "Vuelve a iniciar sesión para realizar esta operación.";
    if (error.code === "PASSWORD_TOO_SHORT") return "La nueva contraseña debe tener al menos 8 caracteres.";
    if (error.code === "PASSWORD_TOO_LONG") return "La nueva contraseña es demasiado larga.";
    if (error.code === "CREDENTIAL_ACCOUNT_NOT_FOUND") return "Esta cuenta no tiene una contraseña local que puedas cambiar.";
    if (error.code === "RATE_LIMITED" || error.status === 429) return "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
    if (error.status === 0) return error.message;
  }
  return "No pudimos completar la operación. Inténtalo nuevamente.";
}

export function SecurityPage() {
  const navigate = useNavigate();
  const { session } = useApp();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [sessionMessage, setSessionMessage] = useState("");
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [busy, setBusy] = useState<"password" | "sessions" | null>(null);

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setPasswordError("");
    setPasswordMessage("");
    if (newPassword !== confirmation) {
      setPasswordError("Las contraseñas nuevas no coinciden.");
      return;
    }
    setBusy("password");
    try {
      await authApi.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setPasswordMessage("Contraseña actualizada. Las demás sesiones se cerraron.");
    } catch (error) {
      setPasswordError(securityError(error));
    } finally {
      setBusy(null);
    }
  };

  const revokeOthers = async () => {
    if (busy) return;
    setSessionError("");
    setSessionMessage("");
    setBusy("sessions");
    try {
      await authApi.revokeOtherSessions();
      setConfirmRevoke(false);
      setSessionMessage("Las otras sesiones se cerraron. Esta sesión sigue activa.");
    } catch (error) {
      setSessionError(securityError(error));
    } finally {
      setBusy(null);
    }
  };

  const inputClass = "mt-2 w-full rounded-xl border border-line2 bg-card p-3 text-ink focus:outline-none focus:ring-2 focus:ring-pine";
  return (
    <main className="max-w-2xl mx-auto px-5 pb-10 pt-6">
      <button className="btn-ghost h-11 px-4 mb-4" onClick={() => navigate("/app/perfil")}><Icon name="chevl" className="w-4 h-4" /> Volver al perfil</button>
      <h1 className="font-disp font-bold text-2xl">Seguridad y privacidad</h1>
      <section className="card p-5 mt-5">
        <h2 className="font-disp font-bold text-lg">Tu cuenta</h2>
        <p className="text-sm text-mut mt-2 break-words">{session?.email}</p>
        <p className={`text-sm font-semibold mt-2 ${session?.emailVerified ? "text-ok" : "text-mut"}`}>{session?.emailVerified ? "Correo verificado" : "Correo pendiente de verificación"}</p>
        <p className="text-sm text-mut mt-3">Tu sesión se mantiene mediante una cookie protegida. Tus direcciones guardadas son privadas y solo tú puedes gestionarlas.</p>
      </section>

      <form onSubmit={changePassword} className="card p-5 mt-4">
        <h2 className="font-disp font-bold text-lg">Cambiar contraseña</h2>
        <p className="text-sm text-mut mt-2">Al cambiarla, se cerrarán las sesiones de los demás dispositivos.</p>
        <fieldset disabled={busy !== null} className="space-y-4 mt-4">
          <label className="block text-sm font-bold" htmlFor="current-password">Contraseña actual
            <input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required className={inputClass} />
          </label>
          <label className="block text-sm font-bold" htmlFor="new-password">Nueva contraseña
            <input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} maxLength={128} required className={inputClass} />
          </label>
          <label className="block text-sm font-bold" htmlFor="confirm-password">Confirmar nueva contraseña
            <input id="confirm-password" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={8} maxLength={128} required className={inputClass} />
          </label>
        </fieldset>
        {passwordError && <p role="alert" className="text-sm text-cor mt-4">{passwordError}</p>}
        {passwordMessage && <p role="status" className="text-sm text-ok mt-4">{passwordMessage}</p>}
        <button type="submit" disabled={busy !== null} className="btn-pine h-11 px-5 mt-5 disabled:opacity-50">{busy === "password" ? "Actualizando…" : "Actualizar contraseña"}</button>
      </form>

      <section className="card p-5 mt-4">
        <h2 className="font-disp font-bold text-lg">Accesos en otros dispositivos</h2>
        <p className="text-sm text-mut mt-2">Cierra las otras sesiones de tu cuenta y conserva el acceso en este dispositivo.</p>
        {sessionError && <p role="alert" className="text-sm text-cor mt-4">{sessionError}</p>}
        {sessionMessage && <p role="status" className="text-sm text-ok mt-4">{sessionMessage}</p>}
        {confirmRevoke ? (
          <div className="mt-4">
            <p className="text-sm font-semibold">¿Cerrar todas las demás sesiones?</p>
            <div className="flex gap-3 mt-3">
              <button onClick={revokeOthers} disabled={busy !== null} className="btn-ghost h-11 px-4">{busy === "sessions" ? "Cerrando…" : "Sí, cerrar otras sesiones"}</button>
              <button onClick={() => setConfirmRevoke(false)} disabled={busy !== null} className="btn-ghost h-11 px-4">Cancelar</button>
            </div>
          </div>
        ) : <button onClick={() => { setSessionMessage(""); setConfirmRevoke(true); }} disabled={busy !== null} className="btn-ghost h-11 px-4 mt-4">Cerrar otras sesiones</button>}
      </section>
    </main>
  );
}
