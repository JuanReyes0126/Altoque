import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/icons";
import { FadeUp, MapCard } from "../../components/ui/kit";
import { useToast } from "../../components/Toast";
import {
  fmt, setRole, useApp,
} from "../../lib/state";
import { api } from "../../lib/api";
import { endCurrentSession } from "../../lib/session-actions";
import { ApiHttpError } from "../../lib/http";
import { PATHS } from "../../lib/router";
import { ProDisputeModal } from "./ProDisputeModal";
import { ProDisputeView } from "./ProDisputeView";
import { ProviderAvailabilityControl, ProviderInboxState, type ProviderLoadStatus } from "./ProviderPanelStates";
import { ProviderProfileSetup } from "./ProviderProfileSetup";

type ProTab = "home" | "activity" | "me";
const ETAS = [10, 15, 20, 30, 45, 60];
const INBOX_PAGE_LIMIT = 20;
const PRO_FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-namber";
const estimateLabel = (value: unknown) => {
  const amount = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(amount) ? fmt(amount) : "Por confirmar";
};
interface InboxPageMeta { page: number; limit: number; total: number; pages: number }
const loadErrorMessage = (error: unknown, fallback: string) => error instanceof ApiHttpError ? error.message : fallback;

export function ProApp() {
  const s = useApp();
  const nav = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState<ProTab>("home");
  const [providerProfile, setProviderProfile] = useState<any>(null);
  const [inbox, setInbox] = useState<any[]>([]);
  const [activeJob, setActiveJob] = useState<any>(null);
  const [etaFor, setEtaFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<{ missing: boolean; message: string } | null>(null);
  const [profileReload, setProfileReload] = useState(0);
  const [inboxStatus, setInboxStatus] = useState<ProviderLoadStatus>("idle");
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [inboxReload, setInboxReload] = useState(0);
  const [inboxPage, setInboxPage] = useState(1);
  const [inboxMeta, setInboxMeta] = useState<InboxPageMeta | null>(null);
  const [activeJobStatus, setActiveJobStatus] = useState<ProviderLoadStatus>("idle");
  const [activeJobError, setActiveJobError] = useState<string | null>(null);
  const [activeJobReload, setActiveJobReload] = useState(0);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const availabilityPending = useRef(false);
  const [jobBusy, setJobBusy] = useState(false);
  const jobPending = useRef(false);
  const providerId = providerProfile?.id;
  const verified = providerProfile?.verification_status === "verified";
  const available = !!providerProfile?.is_available;

  // El perfil persistido decide qué operaciones están habilitadas.
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setProfileError(null);
    api.providers.getMe()
      .then((profile) => {
        if (!mounted) return;
        setProviderProfile(profile);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setProviderProfile(null);
        setProfileError({
          missing: error instanceof ApiHttpError && error.status === 404,
          message: loadErrorMessage(error, "No pudimos cargar tu perfil profesional."),
        });
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [profileReload]);

  // Un inbox vacío es éxito; nunca consulta mientras falta el perfil o su aprobación.
  useEffect(() => {
    let mounted = true;
    let pending = false;
    setInbox([]);
    setInboxError(null);
    setInboxStatus("idle");
    if (!providerId || !verified || !available) {
      setInboxPage(1);
      setInboxMeta(null);
      return;
    }
    setInboxStatus("loading");
    const loadInbox = async () => {
      if (pending) return;
      pending = true;
      try {
        const res = await api.providers.getInbox({ page: inboxPage, limit: INBOX_PAGE_LIMIT });
        if (mounted) {
          const meta = res?.meta as InboxPageMeta | undefined;
          if (!Array.isArray(res?.data) || !meta ||
            ![meta.page, meta.limit, meta.total, meta.pages].every(Number.isSafeInteger) ||
            meta.page !== inboxPage || meta.limit !== INBOX_PAGE_LIMIT || meta.total < 0 ||
            meta.pages !== Math.max(1, Math.ceil(meta.total / INBOX_PAGE_LIMIT)) ||
            res.data.length > Math.max(0, Math.min(INBOX_PAGE_LIMIT, meta.total - (inboxPage - 1) * INBOX_PAGE_LIMIT))) {
            throw new Error("INVALID_PROVIDER_INBOX_PAGE");
          }
          setInboxMeta(meta);
          if (inboxPage > meta.pages) {
            setInboxPage(meta.pages);
            setInboxStatus("loading");
            return;
          }
          setInbox(res.data);
          setInboxError(null);
          setInboxStatus("success");
        }
      } catch (error: unknown) {
        if (mounted) {
          setInboxError(loadErrorMessage(error, "Revisa tu conexión e inténtalo de nuevo."));
          setInboxStatus("error");
        }
      } finally {
        pending = false;
      }
    };

    void loadInbox();
    const interval = setInterval(loadInbox, 10000);
    return () => { mounted = false; clearInterval(interval); };
  }, [providerId, verified, available, inboxPage, inboxReload]);

  // No confundir un error al comprobar el trabajo activo con una respuesta job:null.
  useEffect(() => {
    let mounted = true;
    let pending = false;
    setActiveJobError(null);
    setActiveJobStatus("idle");
    if (!providerId || !verified) return;
    setActiveJobStatus("loading");
    const loadActiveJob = async () => {
      if (pending) return;
      pending = true;
      try {
        const res = await api.providers.getActiveJob();
        if (mounted) {
          setActiveJob(res.data.job);
          setActiveJobError(null);
          setActiveJobStatus("success");
        }
      } catch (error: unknown) {
        if (mounted) {
          setActiveJobError(loadErrorMessage(error, "No pudimos comprobar tu trabajo activo."));
          setActiveJobStatus("error");
        }
      } finally {
        pending = false;
      }
    };

    void loadActiveJob();
    const interval = setInterval(loadActiveJob, 5000);
    return () => { mounted = false; clearInterval(interval); };
  }, [providerId, verified, activeJobReload]);

  const handleToggleAvailability = async (newAvailability: boolean) => {
    if (!providerProfile || !verified || availabilityPending.current) return;
    availabilityPending.current = true;
    setAvailabilityBusy(true);
    try {
      const saved = await api.providers.setAvailability(newAvailability);
      setProviderProfile((current: any) => current ? { ...current, is_available: saved.is_available } : current);
    } catch (error: unknown) {
      toast.showToast("error", loadErrorMessage(error, "Error al cambiar disponibilidad"));
    } finally {
      availabilityPending.current = false;
      setAvailabilityBusy(false);
    }
  };

  const handleAcceptJob = async (requestId: string, eta: number) => {
    if (jobPending.current) return;
    jobPending.current = true;
    setJobBusy(true);
    try {
      await api.providers.claim(requestId, eta);
    } catch (error: unknown) {
      toast.showToast("error", loadErrorMessage(error, "Error al aceptar el trabajo"));
      return;
    } finally {
      jobPending.current = false;
      setJobBusy(false);
    }
    setEtaFor(null);
    toast.showToast("success", "Trabajo aceptado correctamente");
    setActiveJobStatus("loading");
    setInboxReload((value) => value + 1);
    setActiveJobReload((value) => value + 1);
  };

  const handleRejectJob = async (requestId: string) => {
    setInbox((current) => current.filter((inc) => inc.id !== requestId));
  };

  const handleAdvanceJob = async () => {
    if (!activeJob || jobPending.current || activeJobStatus !== "success") return;
    const statusMap: Record<string, string> = {
      accepted: "on_the_way",
      on_the_way: "arrived",
      arrived: "in_progress",
      in_progress: "completed",
    };
    const nextStatus = statusMap[activeJob.status];

    if (!nextStatus) return;

    jobPending.current = true;
    setJobBusy(true);
    try {
      await api.providers.updateStatus(activeJob.id, nextStatus);
    } catch (error: unknown) {
      toast.showToast("error", loadErrorMessage(error, "Error al actualizar el estado"));
      return;
    } finally {
      jobPending.current = false;
      setJobBusy(false);
    }
    toast.showToast("success", "Estado actualizado correctamente");
    setActiveJobStatus("loading");
    setActiveJobReload((value) => value + 1);
  };

  if (loading) {
    return (
      <main className="min-h-dvh bg-night text-ntxt grid place-items-center px-5">
        <div className="text-center" role="status" aria-busy="true">
          <div className="w-16 h-16 rounded-2xl border border-nline bg-nsurf grid place-items-center mx-auto animate-pulse motion-reduce:animate-none" aria-hidden="true">
            <Icon name="wrench" className="w-8 h-8 text-nmut" strokeWidth={1.7} />
          </div>
          <p className="font-disp font-bold text-[1.1rem] text-ntxt mt-5">Cargando panel...</p>
          <p className="text-sm text-nmut mt-2">Estamos preparando tu espacio profesional.</p>
        </div>
      </main>
    );
  }

  if (!providerProfile) {
    const backToProfile = () => { setRole("customer"); nav(`${PATHS.app}/perfil`); };
    if (profileError?.missing) {
      return <ProviderProfileSetup onCreated={() => setProfileReload((value) => value + 1)} onBack={backToProfile} />;
    }
    return (
      <div className="min-h-dvh bg-night text-ntxt grid place-items-center px-5">
        <div className="ncard p-8 text-center max-w-md" role="alert">
          <Icon name="wrench" className="w-8 h-8 text-namber mx-auto" strokeWidth={1.7} />
          <h1 className="font-disp font-bold text-xl mt-4">No pudimos cargar tu panel</h1>
          <p className="text-[0.85rem] text-nmut mt-3">{profileError?.message}</p>
          <button type="button" onClick={() => setProfileReload((value) => value + 1)} className={`btn-ghost-dark w-full h-12 mt-5 ${PRO_FOCUS}`}>Reintentar</button>
          <button type="button" onClick={backToProfile} className={`btn-ghost-dark w-full h-12 mt-3 ${PRO_FOCUS}`}>Volver a mi perfil</button>
        </div>
      </div>
    );
  }

  return (
    <div data-theme="dark" className="min-h-dvh bg-night text-ntxt pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-5 sm:pt-8">
        {/* header */}
        <header className="rounded-3xl border border-nline bg-gradient-to-br from-nsurf to-ncard px-5 sm:px-7 py-6 flex items-center gap-3 sm:gap-5">
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.18em] text-namber">Altoque Pro</p>
            <h1 className="font-disp font-bold text-[1.4rem] sm:text-[1.75rem] leading-tight break-words mt-2">{s.session?.name || "Proveedor"}</h1>
            <p className="text-[0.78rem] leading-relaxed text-nmut mt-2">Tus servicios, tu zona, tu próximo trabajo.</p>
          </div>
          <div className="shrink-0 flex flex-col-reverse sm:flex-row items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 text-[0.65rem] sm:text-[0.7rem] font-extrabold rounded-full border border-white/5 px-2.5 sm:px-3 py-1.5 ${providerProfile?.is_available ? "bg-[#173526] text-[#85e3a6]" : "bg-night/50 text-nmut"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${available ? "bg-[#85e3a6]" : "bg-nmut"}`} aria-hidden="true" />
              {providerProfile?.is_available ? "En línea" : "Fuera de línea"}
            </span>
            <ProviderAvatar name={providerProfile?.user?.name || s.session?.name || "Profesional"} image={providerProfile?.user?.image} size="w-11 h-11" />
          </div>
        </header>

        {/* availability switch */}
        <FadeUp>
          <ProviderAvailabilityControl available={available} verified={verified} busy={availabilityBusy} onChange={handleToggleAvailability} />
        </FadeUp>

        <div className="mt-8 mb-4">
          <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-nmut">{tab === "home" ? "Tu jornada" : tab === "activity" ? "Tu actividad" : "Tu presencia profesional"}</p>
          <h2 className="font-disp font-bold text-[1.4rem] leading-tight mt-1">{tab === "home" ? "Tu panel de trabajo" : tab === "activity" ? "Cada servicio cuenta" : "Tu perfil profesional"}</h2>
        </div>

        {tab === "home" && (
          <>
            {activeJobStatus === "error" && (
              <div className="ncard mt-7 p-5" role="alert">
                <p className="font-bold">No pudimos comprobar tu trabajo activo</p>
                <p className="text-[0.8rem] text-nmut mt-2">{activeJobError}</p>
                <button type="button" onClick={() => setActiveJobReload((value) => value + 1)} className={`btn-ghost-dark h-11 px-5 mt-3 ${PRO_FOCUS}`}>Reintentar</button>
              </div>
            )}
            {/* active job */}
            {activeJob ? (
              <ActiveJob job={activeJob} onAdvance={handleAdvanceJob} busy={jobBusy || activeJobStatus !== "success"} />
            ) : verified && (activeJobStatus === "idle" || activeJobStatus === "loading") ? (
              <div className="ncard p-8 mt-5 text-center" role="status" aria-busy="true"><span className="w-12 h-12 rounded-2xl bg-nsurf grid place-items-center mx-auto" aria-hidden="true"><Icon name="wrench" className="w-6 h-6 text-namber animate-pulse motion-reduce:animate-none" /></span><p className="text-sm text-nmut mt-4">Comprobando trabajo activo…</p></div>
            ) : activeJobStatus === "error" ? null : (
              <>
                {/* incoming requests */}
                <section className="mt-5" aria-label="Solicitudes cerca de ti">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <h3 className="font-disp font-bold text-[1.05rem]">Solicitudes cerca de ti</h3>
                    {inboxStatus === "success" && <span className="text-[0.7rem] font-extrabold text-namber bg-[#332a14] rounded-full px-2.5 py-1">{inboxMeta?.total ?? inbox.length} solicitudes</span>}
                  </div>

                  <ProviderInboxState
                    verificationStatus={providerProfile.verification_status}
                    available={available}
                    status={inboxStatus}
                    error={inboxError}
                    count={inbox.length}
                    onRetry={() => setInboxReload((value) => value + 1)}
                  >
                      {inbox.map((inc, i) => (
                        <IncomingCard
                          key={inc.id}
                          inc={inc}
                          delay={i * 80}
                          onAccept={() => setEtaFor(inc.id)}
                          onReject={() => handleRejectJob(inc.id)}
                        />
                      ))}
                  </ProviderInboxState>
                  {verified && available && (inboxPage > 1 || (inboxMeta?.pages ?? 1) > 1) && (
                    <nav aria-label="Páginas de solicitudes disponibles" aria-busy={inboxStatus === "loading"} className="flex flex-wrap items-center gap-3 mt-4">
                      <button type="button" disabled={jobBusy || inboxStatus === "loading" || inboxPage <= 1} onClick={() => setInboxPage((page) => page - 1)} className={`btn-ghost-dark h-11 px-4 disabled:opacity-45 disabled:cursor-not-allowed ${PRO_FOCUS}`}>Anterior</button>
                      <span className="text-sm text-nmut" aria-live="polite">{inboxStatus === "loading" || inboxStatus === "error" ? `Página ${inboxPage}` : `${inboxPage} / ${inboxMeta?.pages ?? 1}`}</span>
                      <button type="button" disabled={jobBusy || inboxStatus === "loading" || !inboxMeta || inboxPage >= inboxMeta.pages} onClick={() => setInboxPage((page) => page + 1)} className={`btn-ghost-dark h-11 px-4 disabled:opacity-45 disabled:cursor-not-allowed ${PRO_FOCUS}`}>Siguiente</button>
                    </nav>
                  )}
                </section>
              </>
            )}
          </>
        )}

        {tab === "activity" && <Activity providerId={providerProfile?.id} />}
        {tab === "me" && <ProMe profile={providerProfile} />}
      </main>

      {/* ETA sheet */}
      {etaFor && (
        <EstimateSheet busy={jobBusy} onClose={() => setEtaFor(null)} onConfirm={(eta) => handleAcceptJob(etaFor, eta)} />
      )}

      {/* bottom nav (provider) */}
      <nav className="fixed bottom-0 inset-x-0 z-50" aria-label="Navegación profesional">
        <div className="mx-auto max-w-md px-4 pb-[max(0.8rem,env(safe-area-inset-bottom))]">
          <div className="rounded-[1.6rem] bg-ncard/95 backdrop-blur border border-nline shadow-2xl grid grid-cols-3 h-[4.2rem]">
            {([
              { k: "home", ic: "home", l: "Inicio" },
              { k: "activity", ic: "chart", l: "Actividad" },
              { k: "me", ic: "user", l: "Perfil" },
            ] as const).map((t) => {
              const on = tab === t.k;
              return (
                <button type="button" key={t.k} onClick={() => setTab(t.k)} className={`relative min-h-11 flex flex-col items-center justify-center gap-1 rounded-[1.2rem] mx-1 my-1.5 transition-colors ${PRO_FOCUS} ${on ? "bg-nsurf text-namber" : "text-nmut hover:text-ntxt"}`} aria-label={t.l} aria-current={on ? "page" : undefined}>
                  <Icon name={t.ic as never} className="w-[1.3rem] h-[1.3rem]" strokeWidth={on ? 2.3 : 1.9} aria-hidden="true" />
                  <span className="text-[0.65rem] font-extrabold">{t.l}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}

function ProviderAvatar({ name, image, size }: { name: string; image?: string | null; size: string }) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toLocaleUpperCase("es") || "P";
  const source = typeof image === "string" && (/^https?:\/\//i.test(image) || /^\/(?!\/)/.test(image)) ? image : null;
  return (
    <span role="img" aria-label={`Avatar de ${name}`} className={`${size} relative shrink-0 overflow-hidden rounded-2xl border border-namber/20 bg-namber/10 text-namber grid place-items-center font-disp font-bold`}>
      <span aria-hidden="true">{initials}</span>
      {source && failedImage !== source && <img src={source} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedImage(source)} className="absolute inset-0 w-full h-full object-cover" />}
    </span>
  );
}

function EstimateSheet({ busy, onClose, onConfirm }: { busy: boolean; onClose: () => void; onConfirm: (eta: number) => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element || typeof document === "undefined") return;
    const previous = document.activeElement as HTMLElement | null;
    element.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
    return () => { if (previous?.isConnected) previous.focus?.(); };
  }, []);
  useEffect(() => {
    const element = dialog.current;
    if (!element || typeof document === "undefined") return;
    const focused = document.activeElement as HTMLButtonElement | null;
    if (!element.querySelector("button:not([disabled])") || (element.contains(focused) && focused?.disabled)) {
      element.focus();
    }
  }, [busy]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab") return;
    const buttons = [...(dialog.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? [])];
    const first = buttons[0], last = buttons.at(-1);
    const outsideControls = !buttons.some((button) => button === document.activeElement);
    if (!first) {
      event.preventDefault(); dialog.current?.focus();
    } else if (event.shiftKey && (document.activeElement === first || outsideControls)) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && (document.activeElement === last || outsideControls)) {
      event.preventDefault(); first?.focus();
    }
  };
  return (
    <div className="fixed inset-0 z-[70] grid items-end justify-items-center sm:place-items-center p-0 sm:p-6">
      <button type="button" tabIndex={-1} className="absolute inset-0 bg-black/65 backdrop-blur-[3px] animate-fadein motion-reduce:animate-none" onClick={onClose} aria-label="Cerrar selección de llegada" />
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="provider-eta-title" aria-describedby="provider-eta-description" aria-busy={busy} tabIndex={-1} onKeyDown={onKeyDown} className="relative w-full sm:max-w-md max-h-[90dvh] overflow-y-auto bg-ncard text-ntxt border border-nline rounded-t-3xl sm:rounded-3xl px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl animate-slideup sm:animate-pop motion-reduce:animate-none">
        <div className="w-10 h-1 rounded-full bg-nline mx-auto mb-5 sm:hidden" aria-hidden="true" />
        <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-namber">Aceptar solicitud</p>
        <h3 id="provider-eta-title" className="font-disp font-bold text-[1.35rem] leading-tight mt-2">¿Cuánto tardas en llegar?</h3>
        <p id="provider-eta-description" className="text-[0.83rem] text-nmut leading-relaxed mt-2">El cliente verá esta estimación. Elige el tiempo que realmente necesitas para llegar.</p>
        <div className="grid grid-cols-3 gap-3 mt-6">
          {ETAS.map((eta) => (
            <button type="button" key={eta} disabled={busy} aria-label={`Estimar llegada en ${eta} minutos`} onClick={() => onConfirm(eta)} className={`ncard h-18 grid place-items-center hover:border-namber hover:bg-namber/5 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed ${PRO_FOCUS}`}>
              <span className="text-center"><span className="block font-disp font-bold text-[1.35rem] text-ntxt group-hover:text-namber">{eta}</span><span className="block text-[0.65rem] font-bold text-nmut uppercase tracking-wide mt-0.5">min</span></span>
            </button>
          ))}
        </div>
        {busy && <p role="status" className="text-sm text-namber text-center mt-4">Aceptando trabajo…</p>}
        <button type="button" onClick={onClose} className={`btn-ghost-dark w-full mt-5 h-12 text-[0.85rem] ${PRO_FOCUS}`}>Cancelar</button>
      </div>
    </div>
  );
}

/* ── incoming request card ── */
function IncomingCard({ inc, delay, onAccept, onReject }: { inc: any; delay: number; onAccept: () => void; onReject: () => void }) {
  const cat = inc.category;
  const zone = inc.zone;

  return (
    <FadeUp d={delay}>
      <article className="ncard p-5 sm:p-6 border border-nline transition-colors hover:border-namber/30">
        <div className="flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-xl bg-nsurf text-namber grid place-items-center shrink-0">
            <Icon name={cat?.icon as never || "wrench"} className="w-5 h-5" strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <h4 className="font-disp font-bold text-[1.05rem] text-ntxt leading-tight break-words">{cat?.name || "Servicio"}</h4>
            <p className="text-[0.7rem] text-nmut font-semibold flex items-center gap-1.5 mt-0.5">
              <Icon name="pin" className="w-3 h-3" strokeWidth={2.4} /> {zone?.name || "Zona"}
            </p>
          </div>
          <span className="shrink-0 text-right"><span className="block text-[0.6rem] font-bold text-nmut uppercase tracking-wide">Estimación</span><span className="block font-disp font-bold text-[0.9rem] text-namber mt-1">{estimateLabel(inc.price_estimate)}</span></span>
        </div>

        <p className="text-[0.85rem] text-nmut font-medium leading-relaxed whitespace-pre-wrap break-words mt-4 bg-nsurf rounded-xl px-4 py-3">
          "{inc.description}"
        </p>

        <div className="flex items-center gap-2.5 mt-4">
          <span className="w-8 h-8 shrink-0 rounded-full bg-nsurf grid place-items-center text-[0.65rem] font-disp font-bold text-nmut">
            {inc.customer?.name?.charAt(0) || "C"}
          </span>
          <p className="text-[0.8rem] font-bold text-ntxt break-words min-w-0">{inc.customer?.name || "Cliente"}</p>

        </div>

        <div className="flex gap-3 mt-4">
          <button type="button" onClick={onReject} className={`btn-ghost-dark flex-1 min-w-0 h-12 text-[0.85rem] ${PRO_FOCUS}`}>Rechazar</button>
          <button type="button" onClick={onAccept} className={`flex-[2] min-w-0 h-12 rounded-[14px] bg-namber text-[#33230a] font-extrabold text-[0.88rem] active:scale-[0.98] transition-transform motion-reduce:transition-none ${PRO_FOCUS}`}>
            Aceptar
          </button>
        </div>
      </article>
    </FadeUp>
  );
}

/* ── active job (in progress) ── */
function ActiveJob({ job, onAdvance, busy }: { job: any; onAdvance: () => void; busy: boolean }) {
  const cat = job.category;
  const zone = job.zone;
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeExists, setDisputeExists] = useState(true);
  const [disputeKey, setDisputeKey] = useState(0);
  const steps = [
    { k: "on_the_way", l: "Ir hacia el cliente", ic: "car" },
    { k: "arrived", l: "He llegado", ic: "pin" },
    { k: "in_progress", l: "Servicio en curso", ic: "wrench" },
    { k: "completed", l: "Completado", ic: "check" },
  ];
  const idx = steps.findIndex((x) => x.k === job.status);
  const completed = job.status === "completed";
  const actionLabel = job.status === "accepted" ? "Ir hacia el cliente" : job.status === "on_the_way" ? "He llegado" : job.status === "arrived" ? "Iniciar servicio" : completed ? "Esperando confirmación del cliente" : "Completar servicio";

  return (
    <section className="mt-7">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="font-disp font-bold text-[1.05rem]">Trabajo en curso</h3>
        <span className="text-[0.64rem] font-extrabold uppercase tracking-wide text-namber bg-[#332a14] rounded-full px-3 py-1.5">{job.eta_min != null && Number.isFinite(Number(job.eta_min)) && Number(job.eta_min) > 0 ? `Llegada estimada: ${job.eta_min} min` : "Llegada sin confirmar"}</span>
      </div>

      <FadeUp>
        <figure className="ncard overflow-hidden p-2">
          <div aria-hidden="true"><MapCard dark label={zone?.name || "Zona"} /></div>
          <figcaption className="px-3 py-3 text-[0.73rem] leading-relaxed text-nmut"><span className="font-bold text-ntxt">Esquema de zona · sin seguimiento GPS.</span> Usa la dirección del servicio para ubicar al cliente; esta ilustración no señala su ubicación exacta.</figcaption>
        </figure>
      </FadeUp>

      <FadeUp d={80}>
        <div className="ncard p-5 sm:p-6 mt-4">
          <div className="flex items-center gap-3.5">
            <span className="w-11 h-11 rounded-xl bg-nsurf text-namber grid place-items-center shrink-0">
              <Icon name={cat?.icon as never || "wrench"} className="w-5.5 h-5.5" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-disp font-bold text-[1.1rem] text-ntxt leading-tight break-words">{job.customer?.name || "Cliente"}</p>
              <p className="text-[0.75rem] leading-relaxed text-nmut font-semibold break-words mt-1">{cat?.name || "Servicio"} · {zone?.name || "Zona"}</p>
            </div>
            <span className="font-disp font-bold text-[0.9rem] text-namber shrink-0">{estimateLabel(job.price_estimate)}</span>
          </div>

          <p className="text-[0.85rem] text-nmut font-medium leading-relaxed whitespace-pre-wrap break-words mt-4 bg-nsurf rounded-xl px-4 py-3">"{job.description}"</p>

          <div className="mt-4 rounded-xl border border-nline px-4 py-3">
            <p className="text-[0.72rem] font-bold text-nmut">Dirección del servicio</p>
            <p className="text-[0.82rem] text-ntxt mt-1 whitespace-pre-wrap break-words">{job.address?.line || "El cliente todavía no proporcionó una dirección exacta. La zona indicada no sustituye la dirección del servicio."}</p>
          </div>

          {/* mini timeline */}
          <div className="flex items-center gap-1.5 mt-5" role="progressbar" aria-label="Progreso del servicio" aria-valuemin={0} aria-valuemax={4} aria-valuenow={idx + 1} aria-valuetext={job.status === "accepted" ? "Trabajo aceptado" : steps[idx]?.l || "Estado del servicio"}>
            {steps.map((st, i) => (
              <span key={st.k} className={`h-1.5 flex-1 rounded-full ${i <= idx ? "bg-namber" : "bg-nline"}`} />
            ))}
          </div>
          <p className="text-[0.72rem] font-bold text-nmut mt-2.5 flex items-center gap-1.5">
            <Icon name={steps[idx]?.ic as never || "car"} className="w-3.5 h-3.5 text-namber" strokeWidth={2.2} />
            {job.status === "accepted" ? "Trabajo aceptado" : steps[idx]?.l || "En progreso"}
          </p>

          <button type="button" onClick={onAdvance} disabled={busy || completed} aria-busy={busy} className={`w-full min-h-13 py-3.5 px-4 mt-5 rounded-[14px] bg-namber text-[#33230a] font-extrabold text-[0.9rem] active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed ${PRO_FOCUS}`}>
            {busy ? "Actualizando trabajo…" : actionLabel}
          </button>
        </div>
      </FadeUp>

      {/* Disputa - solo para trabajos completados */}
      {job.status === "completed" && (
        <FadeUp d={160}>
          <ProDisputeView 
            requestId={job.id} 
            key={disputeKey}
            onDisputeExists={setDisputeExists}
          />
          
          {/* Botón para abrir disputa solo si NO existe una */}
          {!disputeExists && (
            <div className="mt-4">
              <button
                onClick={() => setDisputeOpen(true)}
                type="button"
                className={`w-full btn-ghost-dark min-h-12 px-4 py-3 text-[0.85rem] text-namber border-namber/30 hover:border-namber/60 ${PRO_FOCUS}`}
              >
                <Icon name="alert" className="w-4 h-4" strokeWidth={2.2} />
                Abrir disputa sobre este servicio
              </button>
            </div>
          )}
        </FadeUp>
      )}

      {/* dispute modal */}
      {disputeOpen && (
        <ProDisputeModal
          requestId={job.id}
          onClose={() => setDisputeOpen(false)}
          onSuccess={() => {
            setDisputeOpen(false);
            setDisputeKey(k => k + 1);
          }}
        />
      )}
    </section>
  );
}

/* ── activity tab ── */
function Activity({ providerId }: { providerId?: string }) {
  const [earnings, setEarnings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError("");
    if (!providerId) { setLoading(false); return; }
    api.providers.getEarnings("week")
      .then((result) => { if (alive) setEarnings(result); })
      .catch(() => { if (alive) setError("No pudimos cargar las estadísticas."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [providerId, reload]);
  if (loading) return <section role="status" aria-busy="true" className="ncard p-7 mt-5"><p className="text-sm text-nmut">Cargando actividad…</p><div className="grid grid-cols-2 gap-4 mt-5 animate-pulse motion-reduce:animate-none" aria-hidden="true"><div className="h-18 rounded-xl bg-nsurf" /><div className="h-18 rounded-xl bg-nsurf" /></div></section>;
  if (error) return <section role="alert" className="ncard p-6 mt-5"><Icon name="alert" className="w-6 h-6 text-namber" aria-hidden="true" /><p className="font-bold mt-3">{error}</p><button type="button" onClick={() => setReload((value) => value + 1)} className={`btn-ghost-dark h-11 px-5 mt-4 ${PRO_FOCUS}`}>Reintentar</button></section>;
  return (
    <div className="mt-5 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <section className="ncard p-6"><span className="w-10 h-10 rounded-xl bg-nsurf grid place-items-center text-namber" aria-hidden="true"><Icon name="check" className="w-5 h-5" /></span><h3 className="text-sm text-nmut font-bold mt-5">Servicios esta semana</h3><p className="font-disp font-bold text-4xl mt-2">{earnings?.completedCount ?? "—"}</p></section>
        <section className="ncard p-6"><span className="w-10 h-10 rounded-xl bg-nsurf grid place-items-center text-namber" aria-hidden="true"><Icon name="chart" className="w-5 h-5" /></span><h3 className="text-sm text-nmut font-bold mt-5">Ingresos registrados esta semana</h3><p className="font-disp font-bold text-3xl text-namber mt-2">{earnings?.earnings != null ? fmt(earnings.earnings) : "—"}</p><p className="text-xs text-nmut leading-relaxed mt-4">El sistema de pagos todavía no está habilitado.</p></section>
      </div>
      {earnings?.completedCount === 0 && <section className="ncard p-6 flex items-start gap-4" role="status"><span className="w-10 h-10 shrink-0 rounded-xl bg-nsurf grid place-items-center text-namber" aria-hidden="true"><Icon name="wrench" className="w-5 h-5" /></span><div><h3 className="font-disp font-bold">Tu actividad empieza con el próximo servicio</h3><p className="text-sm text-nmut leading-relaxed mt-2">Aún no hay servicios completados esta semana. Cuando finalices un trabajo, aparecerá en estas estadísticas.</p></div></section>}
    </div>
  );
}

/* ── me tab ── */
function ProMe({ profile }: { profile: any }) {
  const s = useApp();
  const nav = useNavigate();
  const toast = useToast();
  const displayName = profile?.user?.name || s.session?.name || "Profesional";
  const verificationCopy: Record<string, { title: string; description: string }> = {
    verified: { title: "Verificado", description: "Puedes recibir solicitudes de clientes." },
    pending_verification: { title: "Pendiente de verificación", description: "Tu perfil está siendo revisado por el equipo de Altoque." },
    draft: { title: "Perfil sin enviar a revisión", description: "Tu perfil aún no está habilitado para recibir trabajos." },
    rejected: { title: "Perfil no aprobado", description: "Tu perfil no está habilitado para recibir trabajos. Revisa la información de tu verificación." },
    suspended: { title: "Perfil suspendido", description: "Tu disponibilidad está restringida mientras tu perfil permanezca suspendido." },
    blocked: { title: "Perfil bloqueado", description: "Tu perfil no está habilitado para recibir trabajos." },
  };
  const verification = verificationCopy[profile?.verification_status] ?? { title: "Estado de verificación sin confirmar", description: "No podemos confirmar si tu perfil está habilitado para recibir trabajos." };

  return (
    <div className="mt-5 space-y-5">
      <section className="ncard p-5 sm:p-6 flex items-center gap-4">
        <ProviderAvatar name={displayName} image={profile?.user?.image} size="w-16 h-16" />
        <div className="min-w-0">
          <h3 className="font-disp font-bold text-[1.15rem] text-ntxt leading-tight break-words">{displayName}</h3>
          <p className="text-[0.8rem] text-nmut font-semibold mt-1 break-words">{profile?.business_name || "Servicios profesionales"}</p>
          <p className="text-[0.72rem] font-bold text-namber mt-1 inline-flex items-center gap-1">
            {profile?.provider_service?.length || 0} servicios registrados
          </p>
        </div>
      </section>

      <section className="ncard p-5 sm:p-6 border-namber/30">
        <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-namber">Estado de verificación</p>
        <h3 className="font-disp font-bold text-[1.1rem] text-ntxt mt-3 flex items-center gap-2"><Icon name="shield" className="w-5 h-5 text-namber" aria-hidden="true" />{verification.title}</h3>
        <p className="text-[0.82rem] text-nmut leading-relaxed font-medium mt-2">{verification.description}</p>
      </section>

      <section className="ncard p-5">
        <h3 className="font-disp text-lg font-bold">Servicios y cobertura</h3>
        <p className="text-xs font-bold text-nmut uppercase tracking-wide mt-5">Servicios</p>
        <p className="text-sm text-ntxt leading-relaxed break-words mt-2">{profile?.provider_service?.map((item: any) => item.category.name).join(" · ") || "Sin servicios registrados"}</p>
        <p className="text-xs font-bold text-nmut uppercase tracking-wide mt-5">Zonas</p>
        <p className="text-sm text-ntxt leading-relaxed break-words mt-2">{profile?.provider_zone?.map((item: any) => item.zone.name).join(" · ") || "Sin zonas registradas"}</p>
        <p className="text-xs text-nmut mt-4">La edición del perfil, el portfolio y los horarios todavía no están disponibles.</p>
      </section>

      <button type="button" onClick={() => { setRole("customer"); nav(PATHS.app); }} className={`w-full ncard card-h p-5 flex items-center gap-4 text-left ${PRO_FOCUS}`}>
        <span className="w-11 h-11 rounded-xl bg-pine text-white grid place-items-center shrink-0"><Icon name="user" className="w-5.5 h-5.5" strokeWidth={1.8} /></span>
        <span className="flex-1">
          <span className="block font-disp font-bold text-[0.95rem] text-ntxt">Volver al modo cliente</span>
          <span className="block text-[0.74rem] text-nmut font-semibold">Ver la app como la ve un cliente</span>
        </span>
        <Icon name="arrow" className="w-4.5 h-4.5 text-namber shrink-0" strokeWidth={2.2} />
      </button>

      <button
        type="button"
        onClick={async () => {
          try { await endCurrentSession(); nav(PATHS.home); }
          catch { toast.showToast("error", "No pudimos cerrar la sesión. Inténtalo nuevamente."); }
        }}
        className={`w-full ncard card-h p-5 flex items-center gap-4 text-left border-cor/40 ${PRO_FOCUS}`}
      >
        <span className="w-11 h-11 rounded-xl bg-[#3a1f1a] text-[#ff8a70] grid place-items-center shrink-0"><Icon name="logout" className="w-5 h-5" strokeWidth={1.9} /></span>
        <span className="flex-1">
          <span className="block font-disp font-bold text-[0.95rem] text-ntxt">Cerrar sesión</span>
          <span className="block text-[0.74rem] text-nmut font-semibold">Volver a la página de inicio de Altoque</span>
        </span>
        <Icon name="arrow" className="w-4.5 h-4.5 text-[#ff8a70] shrink-0" strokeWidth={2.2} />
      </button>

      <p className="text-center text-[0.64rem] text-nmut font-semibold pt-2">
        Altoque Pro · hecho en Santiago, RD
      </p>
    </div>
  );
}
