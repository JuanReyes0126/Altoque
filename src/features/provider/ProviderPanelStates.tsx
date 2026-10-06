import type { ReactNode } from "react";
import { Icon } from "../../components/icons";

export type ProviderLoadStatus = "idle" | "loading" | "success" | "error";

export function ProviderAvailabilityControl({ available, verified, busy, onChange }: {
  available: boolean;
  verified: boolean;
  busy: boolean;
  onChange: (available: boolean) => void;
}) {
  return (
    <section className={`ncard mt-5 p-5 flex items-center gap-4 transition-colors ${available ? "border-[#2e5c43]" : ""}`}>
      <div className="flex-1">
        <h2 className="font-disp font-bold text-[1.2rem] leading-tight">¿Estás disponible?</h2>
        <p className={`text-[0.78rem] font-semibold mt-1 ${available ? "text-[#4ade80]" : "text-nmut"}`} aria-live="polite">
          {busy ? "Guardando disponibilidad…" : !verified ? "Disponible cuando tu perfil esté verificado" : available ? "Recibiendo solicitudes cerca de ti" : "Activa tu disponibilidad para recibir solicitudes"}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-label="Disponibilidad"
        aria-checked={available}
        aria-busy={busy}
        disabled={!verified || busy}
        onClick={() => onChange(!available)}
        className={`relative w-[4.4rem] h-10 rounded-full transition-colors duration-300 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${available ? "bg-ok" : "bg-nline"}`}
      >
        <span className={`absolute top-1 w-8 h-8 rounded-full bg-card shadow-md transition-transform duration-300 ${available ? "translate-x-[2.4rem]" : "translate-x-1"}`}>
          <span className={`w-full h-full grid place-items-center ${available ? "text-ok" : "text-soft"}`}>
            <Icon name={available ? "check" : "x"} className="w-3.5 h-3.5" strokeWidth={3} />
          </span>
        </span>
      </button>
    </section>
  );
}

export function ProviderInboxState({ verificationStatus, available, status, error, count, onRetry, children }: {
  verificationStatus: string;
  available: boolean;
  status: ProviderLoadStatus;
  error: string | null;
  count: number;
  onRetry: () => void;
  children?: ReactNode;
}) {
  if (verificationStatus !== "verified") {
    const unavailable = verificationStatus === "blocked" || verificationStatus === "suspended" || verificationStatus === "rejected";
    return (
      <div className="ncard p-8 text-center" role="status">
        <Icon name="shield" className="w-8 h-8 text-namber mx-auto" strokeWidth={1.7} />
        <p className="font-disp font-bold text-[1rem] mt-4">{unavailable ? "Tu perfil no está habilitado" : "Tu perfil está pendiente de verificación"}</p>
        <p className="text-[0.8rem] text-nmut font-medium mt-1">{unavailable ? "Revisa el estado de verificación en tu perfil antes de recibir trabajos." : "Podrás ponerte en línea y recibir solicitudes cuando el equipo apruebe tu perfil."}</p>
      </div>
    );
  }
  if (!available) {
    return (
      <div className="ncard p-8 text-center" role="status">
        <Icon name="bell" className="w-8 h-8 text-nmut mx-auto" strokeWidth={1.7} />
        <p className="font-disp font-bold text-[1rem] mt-4">Estás fuera de línea</p>
        <p className="text-[0.8rem] text-nmut font-medium mt-1">Activa tu disponibilidad para recibir trabajos.</p>
      </div>
    );
  }
  if (status === "loading" || status === "idle") {
    return <div className="ncard p-8 text-center text-nmut" role="status">Cargando solicitudes…</div>;
  }
  if (status === "error") {
    return (
      <div className="ncard p-6 text-center" role="alert">
        <p className="font-bold">No pudimos cargar las solicitudes</p>
        <p className="text-[0.8rem] text-nmut mt-2">{error || "Revisa tu conexión e inténtalo de nuevo."}</p>
        <button type="button" onClick={onRetry} className="btn-ghost-dark mt-4 h-11 px-5">Reintentar</button>
      </div>
    );
  }
  if (count === 0) {
    return (
      <div className="ncard p-8 text-center" role="status">
        <Icon name="radar" className="w-8 h-8 text-namber mx-auto" strokeWidth={1.7} />
        <p className="font-disp font-bold text-[1rem] mt-4">No hay solicitudes disponibles por ahora</p>
        <p className="text-[0.8rem] text-nmut font-medium mt-1">Sigues en línea. Te avisaremos cuando llegue un trabajo en tu zona.</p>
      </div>
    );
  }
  return <div className="space-y-4">{children}</div>;
}
