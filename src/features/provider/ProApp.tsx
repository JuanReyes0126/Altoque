import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/icons";
import { Face, FadeUp, JobPhoto, MapCard, Stars, useCountdown } from "../../components/ui/kit";
import { useToast } from "../../components/Toast";
import {
  catById, fmt,
  setRole, useApp, zoneById,
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
      <div className="min-h-dvh bg-night text-ntxt grid place-items-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-nsurf grid place-items-center mx-auto animate-pulse">
            <Icon name="wrench" className="w-8 h-8 text-nmut" strokeWidth={1.7} />
          </div>
          <p className="font-disp font-bold text-[1.1rem] text-ntxt mt-5">Cargando panel...</p>
        </div>
      </div>
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
          <button type="button" onClick={() => setProfileReload((value) => value + 1)} className="btn-ghost-dark w-full h-11 mt-5">Reintentar</button>
          <button type="button" onClick={backToProfile} className="btn-ghost-dark w-full h-11 mt-3">Volver a mi perfil</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-night text-ntxt pb-28">
      <div className="max-w-2xl mx-auto px-5">
        {/* header */}
        <header className="pt-6 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-nmut">Altoque Pro</p>
            <h1 className="font-disp font-bold text-[1.35rem] leading-tight truncate">{s.session?.name || "Proveedor"}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[0.68rem] font-extrabold rounded-full px-3 py-1.5 ${providerProfile?.is_available ? "bg-[#173526] text-[#4ade80]" : "bg-nsurf text-nmut"}`}>
              {providerProfile?.is_available ? "En línea" : "Fuera de línea"}
            </span>
            {providerProfile?.user && (
              <Face face={{ f: 1, q: 0 }} name={providerProfile.user.name} size="w-10 h-10" />
            )}
          </div>
        </header>

        {/* availability switch */}
        <FadeUp>
          <ProviderAvailabilityControl available={available} verified={verified} busy={availabilityBusy} onChange={handleToggleAvailability} />
        </FadeUp>

        {tab === "home" && (
          <>
            {activeJobStatus === "error" && (
              <div className="ncard mt-7 p-5" role="alert">
                <p className="font-bold">No pudimos comprobar tu trabajo activo</p>
                <p className="text-[0.8rem] text-nmut mt-2">{activeJobError}</p>
                <button type="button" onClick={() => setActiveJobReload((value) => value + 1)} className="btn-ghost-dark h-11 px-5 mt-3">Reintentar</button>
              </div>
            )}
            {/* active job */}
            {activeJob ? (
              <ActiveJob job={activeJob} onAdvance={handleAdvanceJob} busy={jobBusy || activeJobStatus !== "success"} />
            ) : verified && (activeJobStatus === "idle" || activeJobStatus === "loading") ? (
              <div className="ncard p-8 mt-7 text-center text-nmut" role="status">Comprobando trabajo activo…</div>
            ) : activeJobStatus === "error" ? null : (
              <>
                {/* incoming requests */}
                <section className="mt-7">
                  <div className="flex items-center justify-between mb-3.5">
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
                      <button type="button" disabled={jobBusy || inboxStatus === "loading" || inboxPage <= 1} onClick={() => setInboxPage((page) => page - 1)} className="btn-ghost-dark h-11 px-4">Anterior</button>
                      <span className="text-sm text-nmut">{inboxStatus === "loading" || inboxStatus === "error" ? `Página ${inboxPage}` : `${inboxPage} / ${inboxMeta?.pages ?? 1}`}</span>
                      <button type="button" disabled={jobBusy || inboxStatus === "loading" || !inboxMeta || inboxPage >= inboxMeta.pages} onClick={() => setInboxPage((page) => page + 1)} className="btn-ghost-dark h-11 px-4">Siguiente</button>
                    </nav>
                  )}
                </section>
              </>
            )}
          </>
        )}

        {tab === "activity" && <Activity providerId={providerProfile?.id} />}
        {tab === "me" && <ProMe profile={providerProfile} />}
      </div>

      {/* ETA sheet */}
      {etaFor && (
        <div className="fixed inset-0 z-[70] grid place-items-end sm:place-items-center p-0 sm:p-6">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-fadein" onClick={() => setEtaFor(null)} aria-label="Cerrar" />
          <div className="relative w-full sm:max-w-sm bg-ncard border border-nline rounded-t-3xl sm:rounded-3xl p-6 animate-slideup sm:animate-pop">
            <h3 className="font-disp font-bold text-[1.2rem] text-ntxt">¿Cuánto tardas en llegar?</h3>
            <p className="text-[0.8rem] text-nmut font-medium mt-1">El cliente verá esta estimación.</p>
            <div className="grid grid-cols-3 gap-3 mt-5">
              {ETAS.map((e) => (
                <button
                  key={e}
                  disabled={jobBusy}
                  onClick={() => handleAcceptJob(etaFor, e)}
                  className="ncard h-16 grid place-items-center hover:border-namber transition-colors group disabled:opacity-50"
                >
                  <span className="text-center">
                    <span className="block font-disp font-bold text-[1.15rem] text-ntxt group-hover:text-namber">{e}</span>
                    <span className="block text-[0.62rem] font-bold text-nmut uppercase tracking-wide">min</span>
                  </span>
                </button>
              ))}
            </div>
            <button onClick={() => setEtaFor(null)} className="w-full mt-4 h-11 text-[0.8rem] font-bold text-nmut hover:text-ntxt transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {/* bottom nav (provider) */}
      <nav className="fixed bottom-0 inset-x-0 z-50">
        <div className="mx-auto max-w-md px-4 pb-[max(0.8rem,env(safe-area-inset-bottom))]">
          <div className="rounded-[1.6rem] bg-ncard/95 backdrop-blur border border-nline shadow-2xl grid grid-cols-3 h-[4.2rem]">
            {([
              { k: "home", ic: "home", l: "Inicio" },
              { k: "activity", ic: "chart", l: "Actividad" },
              { k: "me", ic: "user", l: "Perfil" },
            ] as const).map((t) => {
              const on = tab === t.k;
              return (
                <button key={t.k} onClick={() => setTab(t.k)} className={`relative flex flex-col items-center justify-center gap-1 rounded-[1.2rem] mx-1 my-1.5 transition-colors ${on ? "bg-nsurf text-namber" : "text-nmut"}`} aria-label={t.l}>
                  <Icon name={t.ic as never} className="w-[1.3rem] h-[1.3rem]" strokeWidth={on ? 2.3 : 1.9} />
                  <span className="text-[0.6rem] font-extrabold">{t.l}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}

/* ── incoming request card ── */
function IncomingCard({ inc, delay, onAccept, onReject }: { inc: any; delay: number; onAccept: () => void; onReject: () => void }) {
  const cat = inc.category;
  const zone = inc.zone;

  return (
    <FadeUp d={delay}>
      <article className="ncard p-5 border border-nline">
        <div className="flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-xl bg-nsurf text-namber grid place-items-center shrink-0">
            <Icon name={cat?.icon as never || "wrench"} className="w-5 h-5" strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-disp font-bold text-[0.95rem] text-ntxt leading-tight truncate">{cat?.name || "Servicio"}</p>
            <p className="text-[0.7rem] text-nmut font-semibold flex items-center gap-1.5 mt-0.5">
              <Icon name="pin" className="w-3 h-3" strokeWidth={2.4} /> {zone?.name || "Zona"}
            </p>
          </div>
          <span className="font-disp font-bold text-[0.9rem] text-namber">{fmt(inc.price_estimate || 0)}</span>
        </div>

        <p className="text-[0.82rem] text-nmut font-medium leading-relaxed mt-3.5 bg-nsurf rounded-xl px-4 py-3">
          "{inc.description}"
        </p>

        <div className="flex items-center gap-2.5 mt-4">
          <span className="w-8 h-8 rounded-full bg-nsurf grid place-items-center text-[0.65rem] font-disp font-bold text-nmut">
            {inc.customer?.name?.charAt(0) || "C"}
          </span>
          <p className="text-[0.8rem] font-bold text-ntxt">{inc.customer?.name || "Cliente"}</p>

        </div>

        <div className="flex gap-3 mt-4">
          <button onClick={onReject} className="btn-ghost-dark flex-1 h-12 text-[0.85rem]">Rechazar</button>
          <button onClick={onAccept} className="flex-[2] h-12 rounded-[14px] bg-namber text-[#33230a] font-extrabold text-[0.88rem] active:scale-95 transition-transform">
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
  const actionLabel = job.status === "accepted" ? "Ir hacia el cliente" : job.status === "on_the_way" ? "He llegado" : job.status === "arrived" ? "Iniciar servicio" : "Completar servicio";

  return (
    <section className="mt-7">
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="font-disp font-bold text-[1.05rem]">Trabajo en curso</h3>
        <span className="text-[0.64rem] font-extrabold uppercase tracking-wide text-namber bg-[#332a14] rounded-full px-2.5 py-1">~{job.eta_min} min</span>
      </div>

      <FadeUp>
        <MapCard dark moving={job.status === "on_the_way"} label={zone?.name || "Zona"} />
      </FadeUp>

      <FadeUp d={80}>
        <div className="ncard p-5 mt-4">
          <div className="flex items-center gap-3.5">
            <span className="w-11 h-11 rounded-xl bg-nsurf text-namber grid place-items-center shrink-0">
              <Icon name={cat?.icon as never || "wrench"} className="w-5.5 h-5.5" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-disp font-bold text-[1rem] text-ntxt leading-tight truncate">{job.customer?.name || "Cliente"}</p>
              <p className="text-[0.72rem] text-nmut font-semibold truncate mt-0.5">{cat?.name || "Servicio"} · {zone?.name || "Zona"}</p>
            </div>
            <span className="font-disp font-bold text-[1rem] text-namber shrink-0">{fmt(job.price_estimate || 0)}</span>
          </div>

          <p className="text-[0.82rem] text-nmut font-medium leading-relaxed mt-3.5 bg-nsurf rounded-xl px-4 py-3">"{job.description}"</p>

          <div className="mt-4">
            <p className="text-[0.72rem] font-bold text-nmut">Dirección del servicio</p>
            <p className="text-[0.82rem] text-ntxt mt-1 whitespace-pre-wrap break-words">{job.address?.line || "El cliente todavía no proporcionó una dirección exacta. La zona indicada no sustituye la dirección del servicio."}</p>
          </div>

          {/* mini timeline */}
          <div className="flex items-center gap-1.5 mt-4">
            {steps.map((st, i) => (
              <span key={st.k} className={`h-1.5 flex-1 rounded-full ${i <= idx ? "bg-namber" : "bg-nline"}`} />
            ))}
          </div>
          <p className="text-[0.72rem] font-bold text-nmut mt-2.5 flex items-center gap-1.5">
            <Icon name={steps[idx]?.ic as never || "car"} className="w-3.5 h-3.5 text-namber" strokeWidth={2.2} />
            {steps[idx]?.l || "En progreso"}
          </p>

          <button onClick={onAdvance} disabled={busy} className="w-full h-13 py-3.5 mt-4 rounded-[14px] bg-namber text-[#33230a] font-extrabold text-[0.9rem] active:scale-95 transition-transform disabled:opacity-50">
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
                className="w-full btn-ghost-dark h-12 text-[0.85rem] text-namber border-namber/30 hover:border-namber/60"
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
  if (loading) return <p role="status" className="mt-7 text-nmut">Cargando actividad…</p>;
  if (error) return <section role="alert" className="ncard p-5 mt-7"><p>{error}</p><button onClick={() => setReload((value) => value + 1)} className="btn-ghost-dark h-11 px-4 mt-3">Reintentar</button></section>;
  return (
    <div className="mt-7 grid sm:grid-cols-2 gap-4">
      <section className="ncard p-5"><h2 className="text-sm text-nmut font-bold">Servicios esta semana</h2><p className="font-disp font-bold text-3xl mt-3">{earnings?.completedCount ?? 0}</p></section>
      <section className="ncard p-5"><h2 className="text-sm text-nmut font-bold">Ingresos registrados esta semana</h2><p className="font-disp font-bold text-2xl text-namber mt-3">{fmt(earnings?.earnings ?? 0)}</p><p className="text-xs text-nmut mt-3">El sistema de pagos todavía no está habilitado.</p></section>
    </div>
  );
}

/* ── me tab ── */
function ProMe({ profile }: { profile: any }) {
  const s = useApp();
  const nav = useNavigate();
  const toast = useToast();

  return (
    <div className="mt-7 space-y-5">
      <div className="ncard p-5 flex items-center gap-4">
        <Face face={{ f: 1, q: 0 }} name={profile?.user?.name || "Proveedor"} size="w-16 h-16" />
        <div>
          <p className="font-disp font-bold text-[1.1rem] text-ntxt">{profile?.user?.name || "Proveedor"}</p>
          <p className="text-[0.76rem] text-nmut font-semibold mt-0.5">{profile?.business_name || "Servicios profesionales"}</p>
          <p className="text-[0.72rem] font-bold text-namber mt-1 inline-flex items-center gap-1">
            {profile?.provider_service?.length || 0} servicios registrados
          </p>
        </div>
      </div>

      <div className="ncard p-5 border-namber/40">
        <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-namber">Estado de verificación</p>
        <p className="font-disp font-bold text-[1rem] text-ntxt mt-1.5">
          {profile?.verification_status === "verified" ? "✓ Verificado" : "Pendiente de verificación"}
        </p>
        <p className="text-[0.76rem] text-nmut font-medium mt-1">
          {profile?.verification_status === "verified"
            ? "Puedes recibir solicitudes de clientes"
            : "Tu perfil está siendo revisado por el equipo de Altoque"}
        </p>
      </div>

      <section className="ncard p-5">
        <h2 className="font-bold">Servicios y cobertura</h2>
        <p className="text-sm text-nmut mt-3">{profile?.provider_service?.map((item: any) => item.category.name).join(" · ") || "Sin servicios registrados"}</p>
        <p className="text-sm text-nmut mt-2">{profile?.provider_zone?.map((item: any) => item.zone.name).join(" · ") || "Sin zonas registradas"}</p>
        <p className="text-xs text-nmut mt-4">La edición del perfil, el portfolio y los horarios todavía no están disponibles.</p>
      </section>

      <button onClick={() => { setRole("customer"); nav(PATHS.app); }} className="w-full ncard card-h p-5 flex items-center gap-4 text-left">
        <span className="w-11 h-11 rounded-xl bg-pine text-white grid place-items-center shrink-0"><Icon name="user" className="w-5.5 h-5.5" strokeWidth={1.8} /></span>
        <span className="flex-1">
          <span className="block font-disp font-bold text-[0.95rem] text-ntxt">Volver al modo cliente</span>
          <span className="block text-[0.74rem] text-nmut font-semibold">Ver la app como la ve un cliente</span>
        </span>
        <Icon name="arrow" className="w-4.5 h-4.5 text-namber shrink-0" strokeWidth={2.2} />
      </button>

      <button
        onClick={async () => {
          try { await endCurrentSession(); nav(PATHS.home); }
          catch { toast.showToast("error", "No pudimos cerrar la sesión. Inténtalo nuevamente."); }
        }}
        className="w-full ncard card-h p-5 flex items-center gap-4 text-left border-cor/40"
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
