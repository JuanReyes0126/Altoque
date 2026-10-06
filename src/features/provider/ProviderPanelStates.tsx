import { useId, type ReactNode } from "react";
import { Icon, type IconName } from "../../components/icons";

export type ProviderLoadStatus = "idle" | "loading" | "success" | "error";

export function ProviderAvailabilityControl({ available, verified, busy, onChange }: {
  available: boolean;
  verified: boolean;
  busy: boolean;
  onChange: (available: boolean) => void;
}) {
  const descriptionId = useId();
  return (
    <section className={`ncard mt-6 p-5 sm:p-6 flex items-center gap-4 sm:gap-6 transition-colors ${available ? "border-[#2e5c43] bg-gradient-to-br from-[#182c20] to-ncard" : ""}`}>
      <div className="flex-1 min-w-0">
        <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-nmut mb-2">Tu disponibilidad</p>
        <h2 className="font-disp font-bold text-[1.15rem] sm:text-[1.3rem] leading-tight">¿Estás disponible?</h2>
        <p id={descriptionId} className={`text-[0.8rem] leading-relaxed font-medium mt-2 ${available ? "text-[#85e3a6]" : "text-nmut"}`} aria-live="polite">
          {busy ? "Guardando disponibilidad…" : !verified ? "Disponible cuando tu perfil esté verificado" : available ? "Recibiendo solicitudes cerca de ti" : "Activa tu disponibilidad para recibir solicitudes"}
        </p>
      </div>
      <div className="shrink-0 flex flex-col items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-label="Disponibilidad"
        aria-describedby={descriptionId}
        aria-checked={available}
        aria-busy={busy}
        disabled={!verified || busy}
        onClick={() => onChange(!available)}
        className={`relative w-20 h-11 rounded-full ring-1 ring-inset ring-white/10 transition-colors duration-200 shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-namber disabled:opacity-50 disabled:cursor-not-allowed ${available ? "bg-ok" : "bg-nline"}`}
      >
        <span aria-hidden="true" className={`absolute top-1 left-1 w-9 h-9 rounded-full bg-card shadow-md transition-transform duration-200 motion-reduce:transition-none ${available ? "translate-x-9" : "translate-x-0"}`}>
          <span className={`w-full h-full grid place-items-center ${available ? "text-ok" : "text-soft"}`}>
            <Icon name={available ? "check" : "x"} className="w-3.5 h-3.5" strokeWidth={3} />
          </span>
        </span>
      </button>
      <span className={`text-[0.65rem] font-extrabold tracking-wide ${available ? "text-[#85e3a6]" : "text-nmut"}`} aria-hidden="true">{available ? "En línea" : "Offline"}</span>
      </div>
    </section>
  );
}

function InboxMessage({ icon, title, description, alert = false, loading = false, children }: {
  icon: IconName;
  title: string;
  description: string;
  alert?: boolean;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="ncard p-7 sm:p-9 text-center" role={alert ? "alert" : "status"} aria-busy={loading || undefined}>
      <span className={`w-16 h-16 rounded-2xl border border-nline bg-nsurf grid place-items-center mx-auto ${loading ? "animate-pulse motion-reduce:animate-none" : ""}`} aria-hidden="true">
        <Icon name={icon} className="w-7 h-7 text-namber" strokeWidth={1.7} />
      </span>
      <h3 className="font-disp font-bold text-[1.05rem] leading-snug mt-5">{title}</h3>
      <p className="text-[0.82rem] text-nmut leading-relaxed max-w-sm mx-auto mt-2">{description}</p>
      {children}
    </div>
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
      <InboxMessage icon="shield" title={unavailable ? "Tu perfil no está habilitado" : "Tu perfil está pendiente de verificación"}
        description={unavailable ? "Revisa el estado de verificación en tu perfil antes de recibir trabajos." : "Podrás ponerte en línea y recibir solicitudes cuando el equipo apruebe tu perfil."} />
    );
  }
  if (!available) {
    return (
      <InboxMessage icon="bell" title="Estás fuera de línea" description="Cuando quieras recibir trabajos, activa tu disponibilidad desde la tarjeta de arriba." />
    );
  }
  if (status === "loading" || status === "idle") {
    return <InboxMessage icon="radar" title="Cargando solicitudes…" description="Estamos consultando las solicitudes disponibles para tus servicios y zonas." loading />;
  }
  if (status === "error") {
    return (
      <InboxMessage icon="alert" title="No pudimos cargar las solicitudes" description={error || "Revisa tu conexión e inténtalo de nuevo."} alert>
        <button type="button" onClick={onRetry} className="btn-ghost-dark mt-5 h-11 px-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-namber">Reintentar</button>
      </InboxMessage>
    );
  }
  if (count === 0) {
    return (
      <InboxMessage icon="radar" title="No hay solicitudes disponibles por ahora" description="Sigues en línea. Las nuevas solicitudes aparecerán aquí cuando estén disponibles en tu zona." />
    );
  }
  return <div className="space-y-4">{children}</div>;
}
