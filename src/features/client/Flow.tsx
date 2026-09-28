import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/icons";
import { AvailDot, Face, FadeUp, JobPhoto, MapCard, ProListItem, Radar, RowHead, Stars, Verif, useFakeLoad } from "../../components/ui/kit";
import { useToast } from "../../components/Toast";
import {
  CATS, JOB_IMGS, PROBLEMS, ZONES, catById, clearSession, fmt, proById, prosByCat,
  setRole, toggleFav, useApp, zoneById, type Tab, type View,
} from "../../lib/state";
import { api, authApi } from "../../lib/api";
import { PATHS } from "../../lib/router";
import { DisputeModal } from "./DisputeModal";
import { DisputeView } from "./DisputeView";

// Mapeo centralizado de estados del backend al frontend
function mapBackendStatus(backendStatus: string): string {
  const mapping: Record<string, string> = {
    on_the_way: "enroute",
    in_progress: "started",
    completed: "done",
  };
  return mapping[backendStatus] || backendStatus;
}

/* ════════════════ REQUEST WIZARD ════════════════ */
export function RequestWizard({ catId: initCat, proId, go }: { catId?: string; proId?: string; go: (v: View) => void }) {
  const s = useApp();
  const toast = useToast();
  const prePro = proId ? proById(proId) : null;
  const [catId, setCatId] = useState(initCat ?? prePro?.cats[0] ?? "");
  const [problem, setProblem] = useState("");
  const [photos, setPhotos] = useState<Array<{ id: string; blob_key: string; preview: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [when, setWhen] = useState<"now" | "later" | "quote">("now");
  const [zoneId, setZoneId] = useState(s.zoneId);
  const [sched, setSched] = useState({ date: "", hora: "" });
  const [selPro, setSelPro] = useState(proId ?? "");
  const [step, setStep] = useState(initCat || prePro ? 1 : 0);

  const steps = ["Categoría", "Problema", "Cuándo", "Ubicación", "Confirmar"];
  const cat = catId ? catById(catId) : null;
  const suggestions = catId ? PROBLEMS[catId] ?? [] : [];
  const matches = useMemo(
    () => (catId ? prosByCat(catId).filter((p) => p.available).sort((a, b) => b.rating - a.rating) : []),
    [catId],
  );

  const canNext =
    step === 0 ? !!catId :
    step === 1 ? problem.trim().length > 0 :
    step === 2 ? when !== "later" || (sched.date && sched.hora) :
    step === 3 ? true :
    when === "quote" ? true : (!!selPro || matches.length === 0);

  const submit = async () => {
    try {
      // F2: Crear solicitud real en el backend
      const realRequest = await api.requests.create({
        category_id: catId,
        zone_id: zoneId,
        description: problem.trim(),
        when_type: when === "later" ? "scheduled" : when,
        scheduled_at: when === "later" && sched.date && sched.hora
          ? new Date(`${sched.date}T${sched.hora}`).toISOString()
          : undefined,
        photos: photos.map((p, i) => ({ blob_key: p.blob_key, sort: i })),
      });

      // Navegar al tracking usando el ID real del backend
      go({ t: "track", jobId: realRequest.id });
    } catch (error) {
      toast.showToast("error", "Error al crear la solicitud. Intenta nuevamente.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-5 pb-32">
      {/* header + progress */}
      <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-md pt-3 pb-3 border-b border-line2 -mx-5 px-5">
        <div className="flex items-center gap-3">
          <button onClick={() => (step === 0 || (step === 1 && (initCat || prePro)) ? go({ t: "home" }) : setStep(step - 1))} className="w-10 h-10 grid place-items-center rounded-full card shrink-0" aria-label="Atrás">
            <Icon name="chevl" className="w-4.5 h-4.5" strokeWidth={2.4} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-disp font-bold text-[1rem] text-ink leading-tight truncate">
              {cat ? cat.name : "Solicitar servicio"}
            </p>
            <p className="text-[0.68rem] text-soft font-bold">Paso {step + 1} de {steps.length} · {steps[step]}</p>
          </div>
        </div>
        <div className="flex gap-1.5 mt-3">
          {steps.map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= step ? "bg-pine" : "bg-line"}`} />
          ))}
        </div>
      </header>

      {/* STEP 0 · categoría */}
      {step === 0 && (
        <section className="mt-6 animate-fadein">
          <h2 className="font-disp font-bold text-[1.4rem] text-ink">¿Qué necesitas?</h2>
          <p className="text-[0.85rem] text-mut font-medium mt-1">Elige la categoría del servicio.</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-5">
            {CATS.map((c) => (
              <button
                key={c.id}
                onClick={() => { setCatId(c.id); setStep(1); }}
                className={`card card-h p-4 flex flex-col items-center gap-2 text-center ${catId === c.id ? "border-pine" : ""}`}
              >
                <span className="w-12 h-12 rounded-xl bg-pinesoft text-pine grid place-items-center">
                  <Icon name={c.icon as never} className="w-6 h-6" strokeWidth={1.8} />
                </span>
                <span className="text-[0.72rem] font-bold text-ink leading-tight">{c.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* STEP 1 · problema */}
      {step === 1 && (
        <section className="mt-6 animate-fadein">
          <h2 className="font-disp font-bold text-[1.4rem] text-ink">¿Qué ocurrió?</h2>
          <p className="text-[0.85rem] text-mut font-medium mt-1">Describe el problema para que el pro llegue preparado.</p>

          {suggestions.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar mt-4 -mx-5 px-5 sm:mx-0 sm:px-0">
              {suggestions.map((sg) => (
                <button key={sg} onClick={() => setProblem(sg)} className={`chip h-9 px-4 text-[0.76rem] shrink-0 ${problem === sg ? "chip-on" : ""}`}>{sg}</button>
              ))}
            </div>
          )}

          <textarea
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="Ej: Tengo una fuga debajo del fregadero desde esta mañana…"
            rows={4}
            className="mt-4 w-full card p-4 text-[0.9rem] font-medium text-ink placeholder:text-soft outline-none focus:border-pine/50 resize-none transition-colors"
            aria-label="Descripción del problema"
          />

          <p className="text-[0.78rem] font-bold text-ink mt-5 mb-2.5">Fotografías <span className="text-soft font-semibold">(opcional, máx 3)</span></p>
          <div className="flex gap-3 overflow-x-auto no-scrollbar">
            {photos.map((photo) => (
              <div key={photo.id} className="relative shrink-0 w-20 h-20 rounded-2xl overflow-hidden">
                <img src={photo.preview} alt="Foto" className="w-full h-full object-cover" />
                <button onClick={() => setPhotos(photos.filter((x) => x.id !== photo.id))} className="absolute top-1 right-1 w-6 h-6 grid place-items-center rounded-full bg-ink/70 text-white" aria-label="Quitar foto">
                  <Icon name="x" className="w-3 h-3" strokeWidth={2.6} />
                </button>
              </div>
            ))}
            {photos.length < 3 && !uploading && (
              <label className="shrink-0 w-20 h-20 rounded-2xl border-2 border-dashed border-line grid place-items-center text-soft hover:border-pine hover:text-pine transition-colors cursor-pointer">
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    try {
                      const result = await api.uploads.requestPhoto(file);
                      const preview = URL.createObjectURL(file);
                      setPhotos([...photos, { id: result.id, blob_key: result.blob_key, preview }]);
                    } catch (error) {
                      toast.showToast("error", "Error al subir la foto. Intenta nuevamente.");
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
                {uploading ? (
                  <div className="w-6 h-6 border-2 border-pine border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Icon name="camera" className="w-6 h-6" strokeWidth={1.8} />
                )}
              </label>
            )}
          </div>
        </section>
      )}

      {/* STEP 2 · cuándo */}
      {step === 2 && (
        <section className="mt-6 animate-fadein">
          <h2 className="font-disp font-bold text-[1.4rem] text-ink">¿Cuándo lo necesitas?</h2>
          <div className="space-y-3 mt-5">
            {([
              { k: "now", ic: "bolt", t: "Ahora", d: "Necesito alguien cuanto antes", tone: "sun" },
              { k: "later", ic: "calendar", t: "Programar", d: "Elige una fecha y hora", tone: "sky" },
              { k: "quote", ic: "doc", t: "Cotizar", d: "Describe y recibe propuestas", tone: "pine" },
            ] as const).map((o) => (
              <button
                key={o.k}
                onClick={() => setWhen(o.k)}
                className={`w-full card card-h p-4 flex items-center gap-4 text-left border-2 ${when === o.k ? "border-pine bg-pinesoft/50" : "border-line2"}`}
              >
                <span className={`w-12 h-12 rounded-xl grid place-items-center shrink-0 ${o.tone === "sun" ? "bg-sunsoft text-sun2" : o.tone === "sky" ? "bg-skysoft text-sky" : "bg-pinesoft text-pine"}`}>
                  <Icon name={o.ic as never} className="w-6 h-6" strokeWidth={1.9} />
                </span>
                <span className="flex-1">
                  <span className="block font-disp font-bold text-[1rem] text-ink">{o.t}</span>
                  <span className="block text-[0.76rem] text-mut font-semibold">{o.d}</span>
                </span>
                <span className={`w-5 h-5 rounded-full border-2 grid place-items-center shrink-0 ${when === o.k ? "border-pine bg-pine" : "border-line"}`}>
                  {when === o.k && <Icon name="check" className="w-2.5 h-2.5 text-white" strokeWidth={3.4} />}
                </span>
              </button>
            ))}
          </div>

          {when === "later" && (
            <div className="grid grid-cols-2 gap-3 mt-4 animate-rise">
              <input type="date" value={sched.date} onChange={(e) => setSched({ ...sched, date: e.target.value })} className="card h-12 px-4 text-[0.85rem] font-bold text-ink outline-none focus:border-pine/50" aria-label="Fecha" />
              <input type="time" value={sched.hora} onChange={(e) => setSched({ ...sched, hora: e.target.value })} className="card h-12 px-4 text-[0.85rem] font-bold text-ink outline-none focus:border-pine/50" aria-label="Hora" />
            </div>
          )}
        </section>
      )}

      {/* STEP 3 · ubicación */}
      {step === 3 && (
        <section className="mt-6 animate-fadein">
          <h2 className="font-disp font-bold text-[1.4rem] text-ink">¿Dónde?</h2>
          <p className="text-[0.85rem] text-mut font-medium mt-1">Confirma tu ubicación para buscar pros cercanos.</p>
          <div className="mt-4"><MapCard label={zoneById(zoneId).name} /></div>
          <div className="mt-4 space-y-2">
            {ZONES.slice(0, 6).map((z) => (
              <button key={z.id} onClick={() => setZoneId(z.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all ${zoneId === z.id ? "border-pine bg-pinesoft" : "border-line2 bg-card"}`}>
                <Icon name="pin" className={`w-4.5 h-4.5 ${zoneId === z.id ? "text-pine" : "text-soft"}`} strokeWidth={2.1} />
                <span className="flex-1 text-[0.88rem] font-bold text-ink">{z.name}</span>
                {zoneId === z.id && <Icon name="check" className="w-4.5 h-4.5 text-pine" strokeWidth={2.6} />}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* STEP 4 · confirmar / elegir pro */}
      {step === 4 && (
        <section className="mt-6 animate-fadein">
          {when === "quote" ? (
            <>
              <h2 className="font-disp font-bold text-[1.4rem] text-ink">Recibe cotizaciones</h2>
              <p className="text-[0.85rem] text-mut font-medium mt-1">Enviaremos tu solicitud a {matches.length || 5} profesionales de {cat?.name}.</p>
              <div className="card p-5 mt-5 space-y-3">
                <SummaryRow l="Servicio" v={cat?.name ?? ""} />
                <SummaryRow l="Problema" v={problem} />
                <SummaryRow l="Ubicación" v={zoneById(zoneId).name} />
                <SummaryRow l="Fotos" v={photos.length ? `${photos.length} adjunta${photos.length > 1 ? "s" : ""}` : "Sin fotos"} />
              </div>
            </>
          ) : (
            <>
              <h2 className="font-disp font-bold text-[1.4rem] text-ink">
                {prePro || selPro ? "Confirma tu profesional" : "Elige un profesional"}
              </h2>
              <p className="text-[0.85rem] text-mut font-medium mt-1">
                {matches.length} disponibles cerca de {zoneById(zoneId).name}.
              </p>
              <div className="mt-5 space-y-3.5">
                {matches.map((p) => {
                  const sel = selPro === p.id;
                  return (
                    <div key={p.id} className={`relative rounded-[20px] border-2 transition-all ${sel ? "border-pine shadow-lift" : "border-transparent"}`}>
                      <button onClick={() => setSelPro(p.id)} className="absolute -top-1.5 -right-1.5 z-10 w-8 h-8 grid place-items-center rounded-full bg-pine text-white shadow-lift" aria-label={`Elegir a ${p.name}`}>
                        <Icon name={sel ? "check" : "plus"} className="w-4 h-4" strokeWidth={2.8} />
                      </button>
                      <ProListItem p={p} onOpen={() => {}} onRequest={() => setSelPro(p.id)} />
                    </div>
                  );
                })}
                {matches.length === 0 && (
                  <div className="card p-6 text-center">
                    <p className="font-disp font-bold text-ink">No hay pros disponibles ahora</p>
                    <p className="text-[0.8rem] text-mut font-medium mt-1">Crea la solicitud y te avisaremos cuando alguno acepte.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {/* bottom action */}
      <div className="fixed bottom-0 inset-x-0 z-50 pb-[max(5.4rem,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-paper via-paper/90 to-transparent pointer-events-none">
        <div className="max-w-2xl mx-auto px-5 pointer-events-auto flex gap-3">
          {step > 0 && !(step === 1 && (initCat || prePro)) && (
            <button onClick={() => setStep(step - 1)} className="btn-ghost h-14 px-5 text-[0.85rem] shrink-0">Atrás</button>
          )}
          {step < 4 ? (
            <button onClick={() => setStep(step + 1)} disabled={!canNext} className="btn-pine flex-1 h-14 text-[0.92rem]">
              Continuar <Icon name="arrow" className="w-4.5 h-4.5" strokeWidth={2.2} />
            </button>
          ) : (
            <button onClick={submit} disabled={!canNext} className="btn-pine flex-1 h-14 text-[0.92rem]">
              <Icon name={when === "quote" ? "doc" : "bolt"} className="w-5 h-5" strokeWidth={2.2} />
              {when === "quote" ? "Enviar solicitud" : "Solicitar servicio"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ l, v }: { l: string; v: string }) {
  return (
    <div className="flex gap-3 text-[0.82rem]">
      <span className="w-24 shrink-0 font-bold text-soft">{l}</span>
      <span className="flex-1 font-semibold text-ink">{v}</span>
    </div>
  );
}

/* ════════════════ TRACKING ════════════════ */
const STATUS_STEPS = [
  { k: "accepted", l: "Solicitud aceptada", ic: "check" },
  { k: "enroute", l: "En camino", ic: "car" },
  { k: "arrived", l: "Llegó", ic: "pin" },
  { k: "started", l: "Servicio iniciado", ic: "wrench" },
  { k: "done", l: "Servicio completado", ic: "star" },
] as const;

function Timeline({ status }: { status: string }) {
  const order = ["accepted", "enroute", "arrived", "started", "done"];
  const idx = order.indexOf(status);
  return (
    <div className="space-y-0">
      {STATUS_STEPS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s.k} className="flex gap-3.5">
            <div className="flex flex-col items-center">
              <span className={`w-8 h-8 rounded-full grid place-items-center shrink-0 transition-all duration-300 ${done ? "bg-pine text-white" : active ? "bg-sun text-[#33230a] shadow-lift" : "bg-tint text-soft border border-line"}`}>
                {done ? <Icon name="check" className="w-3.5 h-3.5" strokeWidth={3} /> : <Icon name={s.ic as never} className="w-4 h-4" strokeWidth={2.2} />}
              </span>
              {i < STATUS_STEPS.length - 1 && <span className={`w-[2.5px] h-7 rounded-full ${done ? "bg-pine" : "bg-line"}`} />}
            </div>
            <p className={`pt-1.5 text-[0.82rem] font-bold ${done ? "text-ink" : active ? "text-ink" : "text-soft"}`}>
              {s.l}
              {active && <span className="ml-2 text-[0.64rem] font-extrabold text-sun2 bg-sunsoft rounded-full px-2 py-0.5 uppercase tracking-wide">ahora</span>}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function TrackingView({ jobId, go, jump }: { jobId: string; go: (v: View) => void; jump: (t: Tab) => void }) {
  const s = useApp();
  const toast = useToast();
  const localJob = s.jobs.find((j) => j.id === jobId);
  const [backendJob, setBackendJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeKey, setDisputeKey] = useState(0); // Para forzar recarga de DisputeView

  // F2: Cargar datos reales del backend
  useEffect(() => {
    let cancelled = false;
    const loadJob = async () => {
      try {
        const data = await api.requests.getById(jobId);
        if (!cancelled) {
          setBackendJob(data);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error loading job from backend:", error);
        if (!cancelled) setLoading(false);
      }
    };

    loadJob();
    // Polling cada 5 segundos para actualizar estado
    const interval = setInterval(loadJob, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [jobId]);

  // Usar datos del backend si están disponibles, sino usar estado local
  const job = backendJob ? {
    id: backendJob.id,
    catId: backendJob.category_id,
    problem: backendJob.description,
    photos: [],
    when: backendJob.when_type === "scheduled" ? "later" : backendJob.when_type,
    zoneId: backendJob.zone_id,
    note: "",
    proId: backendJob.provider_id,
    status: mapBackendStatus(backendJob.status),
    etaMin: backendJob.eta_min,
    etaLeft: undefined,
    scheduledFor: backendJob.scheduled_at,
    rating: backendJob.review?.rating,
    reviewText: backendJob.review?.comment,
    createdAt: new Date(backendJob.created_at).getTime(),
  } : localJob;

  useEffect(() => { window.scrollTo({ top: 0 }); }, [job?.status]);

  if (loading || !job) {
    return (
      <div className="max-w-2xl mx-auto px-5 pb-32">
        <div className="mt-14 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-pinesoft grid place-items-center animate-pulse">
            <Icon name="doc" className="w-8 h-8 text-pine" strokeWidth={1.7} />
          </div>
          <p className="font-disp font-bold text-[1.1rem] text-ink mt-5">Cargando solicitud…</p>
        </div>
      </div>
    );
  }

  const pro = job.proId ? proById(job.proId) : null;
  const cat = catById(job.catId);
  const searching = job.status === "searching";
  const moving = job.status === "enroute";

  return (
    <div className="max-w-2xl mx-auto px-5 pb-32">
      <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-md pt-3 pb-3 border-b border-line2 -mx-5 px-5">
        <div className="flex items-center gap-3">
          <button onClick={() => jump("jobs")} className="w-10 h-10 grid place-items-center rounded-full card shrink-0" aria-label="Mis solicitudes">
            <Icon name="chevl" className="w-4.5 h-4.5" strokeWidth={2.4} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-disp font-bold text-[1rem] text-ink leading-tight truncate">{cat.name}</p>
            <p className="text-[0.68rem] text-soft font-bold truncate">{job.problem}</p>
          </div>
          <span className={`shrink-0 text-[0.64rem] font-extrabold uppercase tracking-wide rounded-full px-2.5 py-1 ${searching ? "bg-sunsoft text-sun2" : job.status === "done" ? "bg-oksoft text-ok" : "bg-pinesoft text-pine"}`}>
            {searching ? "Buscando" : job.status === "done" ? "Completado" : "En curso"}
          </span>
        </div>
      </header>

      {/* searching */}
      {searching && (
        <section className="mt-14 flex flex-col items-center text-center animate-fadein">
          <Radar />
          <h2 className="font-disp font-bold text-[1.5rem] text-ink mt-7">Buscando profesionales…</h2>
          <p className="text-[0.88rem] text-mut font-medium mt-2 max-w-xs leading-relaxed">
            Estamos avisando a los pros de <strong className="text-ink">{cat.name}</strong> cerca de {zoneById(job.zoneId).name}.
          </p>
          <button onClick={() => jump("jobs")} className="btn-ghost h-11 px-5 text-[0.8rem] mt-8">Volver a mis solicitudes</button>
        </section>
      )}

      {/* quoted */}
      {job.status === "quoted" && (
        <section className="mt-8 animate-fadein">
          <h2 className="font-disp font-bold text-[1.4rem] text-ink">Cotización enviada</h2>
          <p className="text-[0.85rem] text-mut font-medium mt-1">Recibirás propuestas de hasta 5 profesionales. Te avisaremos aquí.</p>
          <div className="card p-5 mt-5 space-y-3">
            <SummaryRow l="Servicio" v={cat.name} />
            <SummaryRow l="Problema" v={job.problem} />
            <SummaryRow l="Ubicación" v={zoneById(job.zoneId).name} />
          </div>
          <button onClick={() => jump("jobs")} className="btn-pine w-full h-13 py-3.5 text-[0.88rem] mt-6">Entendido</button>
        </section>
      )}

      {/* active / done */}
      {!searching && job.status !== "quoted" && (
        <>
          {/* map */}
          <FadeUp>
            <div className="mt-5"><MapCard moving={moving} label={zoneById(job.zoneId).name} /></div>
          </FadeUp>

          {/* pro card + ETA */}
          {pro && (
            <FadeUp d={80}>
              <section className="card p-6 mt-5">
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <Face face={pro.face} name={pro.name} size="w-20 h-20" />
                    <span className="absolute bottom-0.5 right-0.5"><AvailDot /></span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.14em] text-pine">
                      {job.status === "done" ? "Servicio completado" : moving ? "Tu profesional está en camino" : job.status === "arrived" ? "Tu profesional llegó" : job.status === "started" ? "Servicio en curso" : "Solicitud aceptada"}
                    </p>
                    <h2 className="font-disp font-bold text-[1.25rem] text-ink leading-tight mt-1 truncate">{pro.name}</h2>
                    <p className="text-[0.78rem] text-mut font-semibold mt-0.5 flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-0.5 text-ink font-bold"><span className="text-sun">★</span>{pro.rating.toFixed(1)}</span>
                      <Verif />
                    </p>
                  </div>
                </div>

                {moving && job.etaMin && (
                  <div className="mt-5 rounded-2xl bg-pinesoft px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.14em] text-pine">Llegada estimada</p>
                      <p className="font-disp font-bold text-[2rem] text-ink leading-none mt-1">{job.etaMin} <span className="text-[1rem]">min</span></p>
                    </div>
                    <span className="w-12 h-12 rounded-2xl bg-pine text-white grid place-items-center animate-ride">
                      <Icon name="car" className="w-6 h-6" strokeWidth={1.8} />
                    </span>
                  </div>
                )}

                {(job.status === "arrived" || job.status === "started") && (
                  <div className="mt-5 rounded-2xl bg-oksoft px-5 py-4 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full bg-ok text-white grid place-items-center shrink-0"><Icon name="check" className="w-5 h-5" strokeWidth={2.6} /></span>
                    <p className="text-[0.88rem] font-bold text-ok">{job.status === "arrived" ? "Tu profesional llegó a tu ubicación" : "El servicio está en curso"}</p>
                  </div>
                )}

                <div className="flex gap-3 mt-5">
                  <button className="btn-ghost flex-1 h-12 text-[0.82rem]"><Icon name="phone" className="w-4 h-4" strokeWidth={2.2} /> Contactar</button>
                  {job.status !== "done" && job.status !== "started" && (
                    <button onClick={() => setCancelOpen(true)} className="btn-ghost flex-1 h-12 text-[0.82rem] text-cor border-cor/30 hover:border-cor/60">Cancelar</button>
                  )}
                </div>
              </section>
            </FadeUp>
          )}

          {/* timeline */}
          <FadeUp d={140}>
            <section className="card p-6 mt-5">
              <p className="text-[0.68rem] font-extrabold tracking-[0.18em] text-soft uppercase mb-4">Estado del servicio</p>
              <Timeline status={job.status} />
            </section>
          </FadeUp>

          {/* review */}
          {job.status === "done" && (
            <FadeUp d={200}>
              <section className="card p-6 mt-5 border-pine/30">
                {sent || job.rating ? (
                  <div className="text-center py-4">
                    <span className="w-14 h-14 rounded-full bg-oksoft text-ok grid place-items-center mx-auto"><Icon name="check" className="w-7 h-7" strokeWidth={2.4} /></span>
                    <h3 className="font-disp font-bold text-[1.2rem] text-ink mt-4">¡Gracias por tu reseña!</h3>
                    <p className="text-[0.82rem] text-mut font-medium mt-1">Ayudaste a otros a elegir con confianza.</p>
                    <button onClick={() => go({ t: "home" })} className="btn-pine h-12 px-6 text-[0.85rem] mt-6">Volver al inicio</button>
                  </div>
                ) : (
                  <>
                    <h3 className="font-disp font-bold text-[1.2rem] text-ink">¿Cómo lo hizo {pro?.name.split(" ")[0]}?</h3>
                    <p className="text-[0.82rem] text-mut font-medium mt-1">Tu reseña está vinculada a un servicio real.</p>
                    <div className="flex justify-center gap-2 mt-5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <button key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} onClick={() => setRating(i)} className="transition-transform active:scale-90" aria-label={`${i} estrellas`}>
                          <svg viewBox="0 0 24 24" className={`w-10 h-10 transition-colors ${i <= (hover || rating) ? "text-sun" : "text-line"}`} fill="currentColor">
                            <path d="m12 3.2 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.4l5.9-.8L12 3.2Z" />
                          </svg>
                        </button>
                      ))}
                    </div>
                    <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Cuéntanos cómo fue el servicio…" rows={3} className="mt-4 w-full card p-4 text-[0.88rem] font-medium text-ink placeholder:text-soft outline-none focus:border-pine/50 resize-none" />
                    <button onClick={async () => {
                      try {
                        await api.requests.review(job.id, { rating, comment: text });
                        setSent(true);
                        toast.showToast("success", "¡Reseña enviada correctamente!");
                      } catch (error) {
                        toast.showToast("error", "Error al enviar la reseña. Intenta nuevamente.");
                      }
                    }} disabled={!rating} className="btn-pine w-full h-13 py-3.5 text-[0.88rem] mt-4">
                      Enviar reseña
                    </button>
                  </>
                )}
              </section>
            </FadeUp>
          )}

          {/* Disputa - solo para solicitudes completadas/confirmadas/revisadas */}
          {(job.status === "done" || job.status === "confirmed" || job.status === "reviewed") && (
            <FadeUp d={260}>
              <DisputeView requestId={job.id} key={disputeKey} />
              
              {/* Botón para abrir disputa si no existe una */}
              <div className="mt-4">
                <button
                  onClick={() => setDisputeOpen(true)}
                  className="w-full btn-ghost h-12 text-[0.85rem] text-cor border-cor/30 hover:border-cor/60"
                >
                  <Icon name="alert" className="w-4 h-4" strokeWidth={2.2} />
                  Abrir disputa sobre este servicio
                </button>
              </div>
            </FadeUp>
          )}
        </>
      )}

      {/* dispute modal */}
      {disputeOpen && (
        <DisputeModal
          requestId={job.id}
          onClose={() => setDisputeOpen(false)}
          onSuccess={() => {
            setDisputeOpen(false);
            setDisputeKey(k => k + 1); // Forzar recarga de DisputeView
          }}
        />
      )}

      {/* cancel sheet */}
      {cancelOpen && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-6">
          <button className="absolute inset-0 bg-ink/45 backdrop-blur-[2px] animate-fadein" onClick={() => setCancelOpen(false)} aria-label="Cerrar" />
          <div className="relative card p-6 max-w-sm w-full animate-pop">
            <h3 className="font-disp font-bold text-[1.15rem] text-ink">¿Cancelar solicitud?</h3>
            <p className="text-[0.82rem] text-mut font-medium mt-2 leading-relaxed">Si el profesional ya va en camino, cancelar podría generar un cargo en el futuro.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setCancelOpen(false)} className="btn-ghost flex-1 h-12 text-[0.85rem]">Seguir</button>
              <button onClick={async () => {
                try {
                  await api.requests.cancel(job.id);
                  setCancelOpen(false);
                  toast.showToast("success", "Solicitud cancelada correctamente");
                  jump("jobs");
                } catch (error) {
                  toast.showToast("error", "Error al cancelar la solicitud. Intenta nuevamente.");
                }
              }} className="flex-1 h-12 rounded-[14px] bg-cor text-white font-bold text-[0.85rem] active:scale-95 transition-transform">Cancelar servicio</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════ SOLICITUDES (tab) ════════════════ */
export function RequestsTab({ go }: { go: (v: View) => void }) {
  const s = useApp();
  const [backendJobs, setBackendJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // F2: Cargar solicitudes reales del backend
  useEffect(() => {
    let cancelled = false;
    const loadJobs = async () => {
      try {
        const res = await api.requests.list();
        if (!cancelled) {
          setBackendJobs(res.data);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error loading jobs from backend:", error);
        if (!cancelled) setLoading(false);
      }
    };

    loadJobs();
    // Polling cada 10 segundos para actualizar lista
    const interval = setInterval(loadJobs, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Combinar datos del backend con estado local (fallback)
  const allJobs = backendJobs.length > 0
    ? backendJobs.map((bj) => ({
        id: bj.id,
        catId: bj.category_id,
        problem: bj.description,
        photos: [],
        when: bj.when_type === "scheduled" ? "later" : bj.when_type,
        zoneId: bj.zone_id,
        note: "",
        proId: bj.provider_id,
        status: mapBackendStatus(bj.status),
        etaMin: bj.eta_min,
        etaLeft: undefined,
        scheduledFor: bj.scheduled_at,
        rating: bj.review?.rating,
        reviewText: bj.review?.comment,
        createdAt: new Date(bj.created_at).getTime(),
      }))
    : s.jobs;

  const active = allJobs.filter((j) => j.status !== "done" || !j.rating);
  const done = allJobs.filter((j) => j.status === "done" && j.rating);

  return (
    <div className="max-w-2xl mx-auto px-5 pb-10">
      <h1 className="font-disp font-bold text-[1.5rem] text-ink pt-6">Mis solicitudes</h1>
      {loading ? (
        <div className="space-y-3.5 mt-5">
          {[0, 1].map((i) => (
            <div key={i} className="card p-5"><div className="skel h-4 w-1/2" /><div className="skel h-3 w-2/3 mt-3" /><div className="skel h-9 w-full mt-4" /></div>
          ))}
        </div>
      ) : allJobs.length === 0 ? (
        <div className="text-center py-24">
          <span className="w-16 h-16 rounded-2xl bg-pinesoft text-pine grid place-items-center mx-auto"><Icon name="doc" className="w-8 h-8" strokeWidth={1.7} /></span>
          <p className="font-disp font-bold text-[1.1rem] text-ink mt-5">Aún no tienes solicitudes</p>
          <p className="text-[0.85rem] text-mut font-medium mt-1">Pide tu primer servicio y síguelo en tiempo real.</p>
          <button onClick={() => go({ t: "home" })} className="btn-pine h-12 px-6 text-[0.85rem] mt-6">Explorar servicios</button>
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {active.length > 0 && (
            <section>
              <p className="text-[0.68rem] font-extrabold tracking-[0.18em] text-soft uppercase mb-3">En curso</p>
              <div className="space-y-3.5">
                {active.map((j) => (
                  <JobCard key={j.id} job={j} go={go} />
                ))}
              </div>
            </section>
          )}
          {done.length > 0 && (
            <section>
              <p className="text-[0.68rem] font-extrabold tracking-[0.18em] text-soft uppercase mb-3">Completadas</p>
              <div className="space-y-3.5">
                {done.map((j) => (
                  <JobCard key={j.id} job={j} go={go} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function JobCard({ job, go }: { job: any; go: (v: View) => void }) {
  const j = job;
  const cat = catById(j.catId);
  const pro = j.proId ? proById(j.proId) : null;
  const label = j.status === "searching" ? "Buscando pro…" : j.status === "accepted" ? "Aceptada" : j.status === "enroute" ? "En camino" : j.status === "arrived" ? "Llegó" : j.status === "started" ? "En curso" : j.status === "quoted" ? "Cotizando" : "Completada";
  const active = j.status !== "done";
  return (
    <button onClick={() => go({ t: "track", jobId: j.id })} className="w-full card card-h p-5 text-left">
      <div className="flex items-center gap-3.5">
        <span className="w-11 h-11 rounded-xl bg-pinesoft text-pine grid place-items-center shrink-0">
          <Icon name={cat.icon as never} className="w-5.5 h-5.5" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-disp font-bold text-[0.95rem] text-ink truncate">{cat.name}</p>
          <p className="text-[0.72rem] text-mut font-semibold truncate mt-0.5">{j.problem}</p>
        </div>
        <span className={`shrink-0 text-[0.64rem] font-extrabold uppercase tracking-wide rounded-full px-2.5 py-1 ${active ? (j.status === "searching" ? "bg-sunsoft text-sun2" : "bg-pinesoft text-pine") : "bg-oksoft text-ok"}`}>
          {label}
        </span>
      </div>
      {pro && (
        <div className="flex items-center gap-2.5 mt-3.5 pt-3.5 border-t border-line2">
          <Face face={pro.face} name={pro.name} size="w-8 h-8" />
          <p className="text-[0.78rem] font-bold text-ink">{pro.name}</p>
          <span className="text-[0.72rem] text-mut font-semibold inline-flex items-center gap-0.5"><span className="text-sun">★</span>{pro.rating.toFixed(1)}</span>
          <Icon name="chevr" className="w-4 h-4 text-soft ml-auto" strokeWidth={2.4} />
        </div>
      )}
    </button>
  );
}

/* ════════════════ FAVORITOS (tab) ════════════════ */
export function FavoritesTab({ go }: { go: (v: View) => void }) {
  const s = useApp();
  const favs = s.favorites.map((id) => proById(id));
  return (
    <div className="max-w-2xl mx-auto px-5 pb-10">
      <h1 className="font-disp font-bold text-[1.5rem] text-ink pt-6">Favoritos</h1>
      <p className="text-[0.85rem] text-mut font-medium mt-1">Tus profesionales de confianza, a un toque.</p>
      {favs.length === 0 ? (
        <div className="text-center py-24">
          <span className="w-16 h-16 rounded-2xl bg-corsoft text-cor grid place-items-center mx-auto"><Icon name="heart" className="w-8 h-8" strokeWidth={1.7} /></span>
          <p className="font-disp font-bold text-[1.1rem] text-ink mt-5">Sin favoritos todavía</p>
          <p className="text-[0.85rem] text-mut font-medium mt-1">Guarda a los pros que te gusten para pedirles rápido.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-3.5">
          {favs.map((p, i) => (
            <ProListItem
              key={p.id} p={p} delay={i * 60}
              fav onFav={() => toggleFav(p.id)}
              onOpen={() => go({ t: "pro", id: p.id })}
              onRequest={() => go({ t: "request", proId: p.id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════ PERFIL (tab) ════════════════ */
export function MeTab({ go, jump }: { go: (v: View) => void; jump: (t: Tab) => void }) {
  const s = useApp();
  const nav = useNavigate();
  const doneCount = s.jobs.filter((j) => j.status === "done").length;
  const myName = s.session?.name ?? "María Peralta";
  return (
    <div className="max-w-2xl mx-auto px-5 pb-10">
      <h1 className="font-disp font-bold text-[1.5rem] text-ink pt-6">Mi perfil</h1>
      <section className="card p-6 mt-5 flex items-center gap-4">
        <Face face={{ f: 3, q: 3 }} name={myName} size="w-16 h-16" />
        <div>
          <p className="font-disp font-bold text-[1.15rem] text-ink">{myName}</p>
          <p className="text-[0.78rem] text-mut font-semibold mt-0.5">{zoneById(s.zoneId).name} · Santiago</p>
          <p className="text-[0.7rem] text-soft font-bold mt-1">{doneCount} servicios · miembro nuevo</p>
        </div>
      </section>

      <section className="card mt-4 divide-y divide-line2">
        {[
          { ic: "pin", l: "Mis direcciones", fn: () => {} },
          { ic: "clip", l: "Historial de servicios", fn: () => jump("jobs") },
          { ic: "heart", l: "Favoritos", fn: () => jump("favs") },
          { ic: "shield", l: "Seguridad y privacidad", fn: () => {} },
        ].map((r) => (
          <button key={r.l} onClick={r.fn} className="w-full flex items-center gap-3.5 px-5 py-4 text-left hover:bg-tint/50 transition-colors">
            <span className="w-9 h-9 rounded-xl bg-tint text-mut grid place-items-center shrink-0"><Icon name={r.ic as never} className="w-4.5 h-4.5" strokeWidth={2} /></span>
            <span className="flex-1 text-[0.88rem] font-bold text-ink">{r.l}</span>
            <Icon name="chevr" className="w-4 h-4 text-soft" strokeWidth={2.4} />
          </button>
        ))}
      </section>

      <button onClick={() => { setRole("provider"); nav(PATHS.pro); }} className="w-full card card-h mt-4 p-5 flex items-center gap-4 text-left border-pine/30">
        <span className="w-11 h-11 rounded-xl bg-pine text-white grid place-items-center shrink-0"><Icon name="wrench" className="w-5.5 h-5.5" strokeWidth={1.8} /></span>
        <span className="flex-1">
          <span className="block font-disp font-bold text-[0.95rem] text-ink">¿Eres profesional?</span>
          <span className="block text-[0.74rem] text-mut font-semibold">Cambia al modo profesional y consigue clientes</span>
        </span>
        <Icon name="arrow" className="w-4.5 h-4.5 text-pine shrink-0" strokeWidth={2.2} />
      </button>

      <button
        onClick={async () => {
          // F1.8: logout REAL — revoca la sesión en el servidor (cookie HttpOnly)
          await authApi.signOut().catch(() => {});
          clearSession(); // limpia SOLO el estado cliente derivado de la sesión
          nav(PATHS.home);
        }}
        className="w-full card card-h mt-4 p-5 flex items-center gap-4 text-left border-cor/30"
      >
        <span className="w-11 h-11 rounded-xl bg-corsoft text-cor grid place-items-center shrink-0"><Icon name="logout" className="w-5 h-5" strokeWidth={1.9} /></span>
        <span className="flex-1">
          <span className="block font-disp font-bold text-[0.95rem] text-ink">Cerrar sesión</span>
          <span className="block text-[0.74rem] text-mut font-semibold">Volver a la página de inicio de Altoque</span>
        </span>
        <Icon name="arrow" className="w-4.5 h-4.5 text-cor shrink-0" strokeWidth={2.2} />
      </button>

      <p className="text-center text-[0.66rem] text-soft font-semibold mt-8">
        Altoque · hecho en Santiago, RD
      </p>
    </div>
  );
}
