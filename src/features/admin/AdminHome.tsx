/* ════════════════════════════════════════════════════════════════
   ALTOQUE · Admin (F4)
   Placeholder de la zona administrativa. El módulo completo
   (dashboard, usuarios, proveedores, solicitudes, auditoría…)
   se construye en F4 sobre datos REALES de PostgreSQL.
   ════════════════════════════════════════════════════════════════ */
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/icons";
import { clearSession, useApp } from "../../lib/state";
import { authApi } from "../../lib/api";
import { PATHS } from "../../lib/router";

export function AdminHome() {
  const nav = useNavigate();
  const { session } = useApp();

  return (
    <div className="min-h-dvh grid place-items-center px-5">
      <div className="card p-8 sm:p-10 max-w-md w-full text-center">
        <span className="w-16 h-16 rounded-2xl bg-night text-namber grid place-items-center mx-auto">
          <Icon name="lock" className="w-8 h-8" strokeWidth={1.8} />
        </span>
        <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.22em] text-soft mt-6">Zona privilegiada</p>
        <h1 className="font-disp font-bold text-2xl text-ink mt-2">Altoque Control</h1>
        <p className="text-[0.9rem] text-mut font-medium leading-relaxed mt-3">
          El panel administrativo se habilita en la fase F4, conectado a información real de PostgreSQL:
          usuarios, proveedores pendientes, solicitudes con timeline, categorías, disputas y auditoría.
        </p>
        <p className="text-[0.74rem] text-soft font-semibold mt-4">
          Sesión: <strong className="text-ink">{session?.name}</strong> · rol <strong className="text-ink">{session?.role}</strong>
        </p>
        <div className="grid gap-2.5 mt-7">
          <button onClick={() => nav(PATHS.home)} className="btn-pine h-12 text-[0.9rem]">Volver al inicio</button>
          <button
            onClick={async () => {
              await authApi.signOut().catch(() => {});
              clearSession();
              nav(PATHS.home);
            }}
            className="btn-ghost h-12 text-[0.9rem]"
          >Cerrar sesión</button>
        </div>
      </div>
    </div>
  );
}
