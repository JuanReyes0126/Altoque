import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/icons";
import { Face, FadeUp, JobPhoto, MapCard, Stars, Toggle, useCountdown } from "../../components/ui/kit";
import { useToast } from "../../components/Toast";
import {
  catById, clearSession, fmt,
  setRole, useApp, zoneById,
} from "../../lib/state";
import { api, authApi } from "../../lib/api";
import { PATHS } from "../../lib/router";
import { ProDisputeModal } from "./ProDisputeModal";
import { ProDisputeView } from "./ProDisputeView";

type ProTab = "home" | "activity" | "me";
const ETAS = [10, 15, 20, 30, 45, 60];

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

  // F3: Cargar perfil del proveedor desde el backend
  useEffect(() => {
    api.providers.getMe()
      .then((profile) => {
        setProviderProfile(profile);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // F3: Cargar inbox de solicitudes
  useEffect(() => {
    const loadInbox = async () => {
      try {
        const res = await api.providers.getInbox();
        setInbox(res.data);
      } catch (error) {
        toast.showToast("error", "Error al cargar solicitudes disponibles");
      }
    };

    loadInbox();
    const interval = setInterval(loadInbox, 10000);
    return () => clearInterval(interval);
  }, []);

  // F3: Cargar trabajo activo si existe
  useEffect(() => {
    const loadActiveJob = async () => {
      try {
        const res = await api.providers.getActiveJob();
        if (res.data) setActiveJob(res.data);
      } catch (error) {
        // No hay trabajo activo
      }
    };

    loadActiveJob();
    const interval = setInterval(loadActiveJob, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleAvailability = async () => {
    if (!providerProfile) return;
    try {
      const newAvailability = !providerProfile.is_available;
      await api.providers.setAvailability(newAvailability);
      setProviderProfile({ ...providerProfile, is_available: newAvailability });
    } catch (error) {
      toast.showToast("error", "Error al cambiar disponibilidad");
    }
  };

  const handleAcceptJob = async (requestId: string, eta: number) => {
    try {
      await api.providers.claim(requestId, eta);
      setEtaFor(null);
      toast.showToast("success", "Trabajo aceptado correctamente");
      // Recargar inbox y trabajo activo
      const [inboxRes, activeRes] = await Promise.all([
        api.providers.getInbox(),
        api.providers.getActiveJob(),
      ]);
      setInbox(inboxRes.data);
      if (activeRes.data) setActiveJob(activeRes.data);
    } catch (error) {
      toast.showToast("error", "Error al aceptar el trabajo");
    }
  };

  const handleRejectJob = async (requestId: string) => {
    setInbox(inbox.filter((inc) => inc.id !== requestId));
  };

  const handleAdvanceJob = async () => {
    if (!activeJob) return;
    const statusMap: Record<string, string> = {
      accepted: "on_the_way",
      on_the_way: "arrived",
      arrived: "in_progress",
      in_progress: "completed",
    };
    const nextStatus = statusMap[activeJob.status];

    if (!nextStatus) return;

    try {
      await api.providers.updateStatus(activeJob.id, nextStatus);
      toast.showToast("success", "Estado actualizado correctamente");
      const res = await api.providers.getActiveJob();
      if (res.data) {
        setActiveJob(res.data);
      } else {
        setActiveJob(null);
      }
    } catch (error) {
      toast.showToast("error", "Error al actualizar el estado");
    }
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
          <section className={`ncard mt-5 p-5 flex items-center gap-4 transition-colors ${providerProfile?.is_available ? "border-[#2e5c43]" : ""}`}>
            <div className="flex-1">
              <h2 className="font-disp font-bold text-[1.2rem] leading-tight">¿Estás disponible?</h2>
              <p className={`text-[0.78rem] font-semibold mt-1 ${providerProfile?.is_available ? "text-[#4ade80]" : "text-nmut"}`}>
                {providerProfile?.is_available ? "Recibiendo solicitudes cerca de ti" : "No recibirás nuevas solicitudes"}
              </p>
            </div>
            <Toggle on={providerProfile?.is_available || false} onChange={handleToggleAvailability} label="Disponibilidad" />
          </section>
        </FadeUp>

        {tab === "home" && (
          <>
            {/* active job */}
            {activeJob ? (
              <ActiveJob job={activeJob} onAdvance={handleAdvanceJob} />
            ) : (
              <>
                {/* incoming requests */}
                <section className="mt-7">
                  <div className="flex items-center justify-between mb-3.5">
                    <h3 className="font-disp font-bold text-[1.05rem]">Solicitudes cerca de ti</h3>
                    <span className="text-[0.7rem] font-extrabold text-namber bg-[#332a14] rounded-full px-2.5 py-1">{inbox.length} nuevas</span>
                  </div>

                  {!providerProfile?.is_available ? (
                    <div className="ncard p-8 text-center">
                      <span className="w-14 h-14 rounded-2xl bg-nsurf text-nmut grid place-items-center mx-auto"><Icon name="bell" className="w-7 h-7" strokeWidth={1.7} /></span>
                      <p className="font-disp font-bold text-[1rem] mt-4">Estás fuera de línea</p>
                      <p className="text-[0.8rem] text-nmut font-medium mt-1">Activa tu disponibilidad para recibir trabajos.</p>
                    </div>
                  ) : inbox.length === 0 ? (
                    <div className="ncard p-8 text-center">
                      <span className="w-14 h-14 rounded-2xl bg-nsurf text-namber grid place-items-center mx-auto animate-ride"><Icon name="radar" className="w-7 h-7" strokeWidth={1.7} /></span>
                      <p className="font-disp font-bold text-[1rem] mt-4">Buscando solicitudes…</p>
                      <p className="text-[0.8rem] text-nmut font-medium mt-1">Te avisaremos apenas llegue un trabajo en tu zona.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {inbox.map((inc, i) => (
                        <IncomingCard
                          key={inc.id}
                          inc={inc}
                          delay={i * 80}
                          onAccept={() => setEtaFor(inc.id)}
                          onReject={() => handleRejectJob(inc.id)}
                        />
                      ))}
                    </div>
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
                  onClick={() => handleAcceptJob(etaFor, e)}
                  className="ncard h-16 grid place-items-center hover:border-namber transition-colors group"
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
  const cat = catById(inc.category_id);
  const zone = zoneById(inc.zone_id);

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
          <span className="text-[0.72rem] text-nmut font-semibold inline-flex items-center gap-0.5"><span className="text-namber">★</span>4.8</span>
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
function ActiveJob({ job, onAdvance }: { job: any; onAdvance: () => void }) {
  const cat = catById(job.category_id);
  const zone = zoneById(job.zone_id);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeExists, setDisputeExists] = useState(false);
  const [disputeKey, setDisputeKey] = useState(0);
  const steps = [
    { k: "on_the_way", l: "Ir hacia el cliente", ic: "car" },
    { k: "arrived", l: "He llegado", ic: "pin" },
    { k: "in_progress", l: "Servicio en curso", ic: "wrench" },
    { k: "completed", l: "Completado", ic: "check" },
  ];
  const idx = steps.findIndex((x) => x.k === job.status);
  const actionLabel = job.status === "on_the_way" ? "He llegado" : job.status === "arrived" ? "Iniciar servicio" : "Completar servicio";

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

          <button onClick={onAdvance} className="w-full h-13 py-3.5 mt-4 rounded-[14px] bg-namber text-[#33230a] font-extrabold text-[0.9rem] active:scale-95 transition-transform">
            {actionLabel}
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

  useEffect(() => {
    if (providerId) {
      api.providers.getEarnings("week").then(setEarnings).catch(() => toast.showToast("error", "Error al cargar estadísticas"));
    }
  }, [providerId]);

  return (
    <div className="mt-7 space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="ncard p-5">
          <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-nmut">Servicios hoy</p>
          <p className="font-disp font-bold text-[1.8rem] text-ntxt mt-1.5 leading-none">{earnings?.completedCount || 0}</p>
        </div>
        <div className="ncard p-5">
          <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-nmut">Ganancias hoy</p>
          <p className="font-disp font-bold text-[1.4rem] text-namber mt-1.5 leading-none">{fmt(earnings?.earnings || 0)}</p>
        </div>
      </div>

      <div className="ncard p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-nmut">Tasa de aceptación</p>
          <p className="font-disp font-bold text-[1rem] text-ntxt">96%</p>
        </div>
        <div className="h-2 rounded-full bg-nsurf overflow-hidden mt-2">
          <div className="h-full rounded-full bg-[#4ade80]" style={{ width: "96%" }} />
        </div>
      </div>

      <section>
        <h3 className="font-disp font-bold text-[1.05rem] mb-3.5">Reseñas recientes</h3>
        <div className="ncard p-4 text-center text-nmut">
          <p className="text-[0.8rem]">Las reseñas aparecerán aquí cuando completes servicios.</p>
        </div>
      </section>
    </div>
  );
}

/* ── me tab ── */
function ProMe({ profile }: { profile: any }) {
  const s = useApp();
  const nav = useNavigate();

  return (
    <div className="mt-7 space-y-5">
      <div className="ncard p-5 flex items-center gap-4">
        <Face face={{ f: 1, q: 0 }} name={profile?.user?.name || "Proveedor"} size="w-16 h-16" />
        <div>
          <p className="font-disp font-bold text-[1.1rem] text-ntxt">{profile?.user?.name || "Proveedor"}</p>
          <p className="text-[0.76rem] text-nmut font-semibold mt-0.5">{profile?.business_name || "Servicios profesionales"}</p>
          <p className="text-[0.72rem] font-bold text-namber mt-1 inline-flex items-center gap-1">
            <span>★</span>4.9 · {profile?.completed_jobs || 0} trabajos
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

      <div className="ncard divide-y divide-nline">
        {[
          { ic: "wrench", l: "Mis servicios y zonas" },
          { ic: "camera", l: "Portfolio y fotos" },
          { ic: "clock", l: "Horarios de trabajo" },
          { ic: "shield", l: "Verificación" },
        ].map((r) => (
          <button key={r.l} className="w-full flex items-center gap-3.5 px-5 py-4 text-left hover:bg-nsurf/50 transition-colors">
            <span className="w-9 h-9 rounded-xl bg-nsurf text-nmut grid place-items-center shrink-0"><Icon name={r.ic as never} className="w-4.5 h-4.5" strokeWidth={2} /></span>
            <span className="flex-1 text-[0.86rem] font-bold text-ntxt">{r.l}</span>
            <Icon name="chevr" className="w-4 h-4 text-nmut" strokeWidth={2.4} />
          </button>
        ))}
      </div>

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
          await authApi.signOut().catch(() => {});
          clearSession();
          nav(PATHS.home);
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