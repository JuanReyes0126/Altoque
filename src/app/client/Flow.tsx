import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/icons";
import { Face, FadeUp, FavBtn, MapCard, ProCard, ProListItem, Radar, Sheet, Stars, useFakeLoad } from "../bits";
import {
  CATS, JOB_IMGS, PROBLEMS, ZONES, advanceJob, catById, createJob, fmt, jobUrl, proById, prosByCat, rateJob,
  setRole, setZone, useApp, zoneById, type Job, type View, type When,
} from "../store";

/* ─────────────────────────── ASISTENTE DE SOLICITUD ─────────────────────────── */
export function RequestWizard({ catId: initCat, proId, go }: { catId?: string; proId?: string; go: (v: View) => void }) {
  const s = useApp();
  const [step, setStep] = useState(proId ? 2 : 1);
  const [catId, setCatId] = useState(initCat ?? (proId ? proById(proId).cats[0] : ""));
  const [problem, setProblem] = useState("");
  const [photos, setPhotos] = useState<number[]>([]);
  const [when, setWhen] = useState<When>("now");
  const [sched, setSched] = useState({ date: "", hora: "Mañana" });
  const [zoneId, setZoneId] = useState(s.zoneId);
  const [matching, setMatching] = useState(false);
  const [selPro, setSelPro] = useState<string | null>(proId ?? null);
  const c = catId ? catById(catId) : null;
  const max = proId ? 4 : 5;

  const canNext =
    step === 1 ? !!catId :
    step === 2 ? problem.trim().length >= 6 :
    step === 3 ? (when !== "later" || !!sched.date) :
    true;

  const submit = () => {
    const id = createJob({
      catId, problem: problem.trim(), photos, when, zoneId,
      note: "", scheduledFor: when === "later" ? `${sched.date} · ${sched.hora}` : undefined,
      proId: selPro ?? undefined,
    });
    go({ t: "track", jobId: id });
  };

  return (
    <div className="max-w-2xl mx-auto px-5 pb-40">
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur-md pt-4 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={() => (step > 1 && !matching ? setStep(step - 1) : go({ t: "home" }))} className="w-10 h-10 grid place-items-center rounded-full card" aria-label="Atrás">
            <Icon name="chevl" className="w-4.5 h-4.5" strokeWidth={2.4} />
          </button>
          <div className="flex-1">
            <p className="font-disp font-bold">{step < max ? "Nueva solicitud" : "Confirmar profesional"}</p>
            <div className="flex gap-1.5 mt-1.5">
              {Array.from({ length: max }).map((_, i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i < step ? "bg-grn" : "bg-edge"}`} />
              ))}
            </div>
          </div>
          <span className="font-disp font-bold text-sm text-mut">{step}/{max}</span>
        </div>
      </header>

      {/* PASO 1 · categoría */}
      {step === 1 && (
        <FadeUp key="s1">
          <h1 className="font-disp font-bold text-2xl sm:text-3xl">¿Qué necesitas?</h1>
          <p className="text-mut mt-1.5 text-sm">Elige la categoría del servicio</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-6">
            {CATS.slice(0, 12).map((cc) => (
              <button
                key={cc.id}
                onClick={() => { setCatId(cc.id); setStep(2); }}
                className={`card card-h p-4 flex flex-col items-center gap-2 text-center transition-all ${catId === cc.id ? "!border-grn ring-2 ring-grn/25" : ""}`}
              >
                <span className="w-12 h-12 rounded-2xl bg-grnsoft text-grn grid place-items-center">
                  <Icon name={cc.icon as never} className="w-6 h-6" strokeWidth={1.8} />
                </span>
                <span className="text-xs font-bold leading-tight">{cc.name}</span>
              </button>
            ))}
          </div>
        </FadeUp>
      )}

      {/* PASO 2 · problema + fotos */}
      {step === 2 && c && (
        <FadeUp key="s2">
          <h1 className="font-disp font-bold text-2xl sm:text-3xl">Cuéntanos el problema</h1>
          <p className="text-mut mt-1.5 text-sm">Mientras más detalle, más rápido y preciso será el servicio</p>
          <div className="flex flex-wrap gap-2 mt-5">
            {(PROBLEMS[c.id] ?? ["Revisión general", "Instalación", "Reparación urgente"]).map((q) => (
              <button key={q} onClick={() => setProblem(q)} className={`rounded-full border px-4 py-2.5 text-sm font-bold transition-all active:scale-95 ${problem === q ? "chip-on" : "border-edge bg-card text-mut hover:border-grn/50"}`}>
                {q}
              </button>
            ))}
          </div>
          <textarea
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            rows={3}
            placeholder="Ej.: Tengo una fuga debajo del fregadero desde anoche…"
            className="mt-4 w-full card p-4 text-[0.95rem] font-semibold outline-none focus:border-grn/60 transition-colors resize-none placeholder:text-mut2"
          />
          <p className="text-[0.65rem] font-extrabold tracking-[0.18em] text-mut2 uppercase mt-6 mb-2.5">Agrega fotografías (opcional)</p>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5">
            {JOB_IMGS.map((img, i) => {
              const on = photos.includes(i);
              return (
                <button
                  key={i}
                  onClick={() => setPhotos(on ? photos.filter((x) => x !== i) : photos.length < 3 ? [...photos, i] : photos)}
                  className={`relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 border-2 transition-all ${on ? "border-grn ring-2 ring-grn/30" : "border-transparent opacity-80 hover:opacity-100"}`}
                  aria-label={`Foto ${img.label}`}
                >
                  <img
                    src={jobUrl(i)} alt={img.label}
                    className="w-[200%] h-[200%] object-cover"
                    style={{ position: "absolute", left: img.q % 2 === 1 ? "-100%" : "0", top: img.q >= 2 ? "-100%" : "0" }}
                    onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                  />
                  {on && (
                    <span className="absolute inset-0 grid place-items-center bg-grn/30">
                      <span className="w-6 h-6 rounded-full bg-grn text-white grid place-items-center animate-pop"><Icon name="check" className="w-3.5 h-3.5" strokeWidth={3} /></span>
                    </span>
                  )}
                </button>
              );
            })}
            <span className="w-20 h-20 rounded-2xl border-2 border-dashed border-edge grid place-items-center text-mut2 shrink-0">
              <Icon name="cam" className="w-6 h-6" strokeWidth={1.8} />
            </span>
          </div>
          {photos.length > 0 && <p className="text-xs font-bold text-grn mt-2">{photos.length} foto{photos.length > 1 ? "s" : ""} adjunta{photos.length > 1 ? "s" : ""}</p>}
        </FadeUp>
      )}

      {/* PASO 3 · cuándo */}
      {step === 3 && (
        <FadeUp key="s3">
          <h1 className="font-disp font-bold text-2xl sm:text-3xl">¿Cuándo lo necesitas?</h1>
          <div className="space-y-3 mt-6">
            {([
              { k: "now", icon: "bolt", t: "Lo necesito ahora", d: "Un profesional disponible irá a tu ubicación", hot: true },
              { k: "later", icon: "calendar", t: "Quiero programarlo", d: "Elige día y hora que te convengan" },
              { k: "quote", icon: "doc", t: "Solicitar cotización", d: "Hasta 5 profesionales te envían precio" },
            ] as const).map((o) => (
              <button
                key={o.k}
                onClick={() => setWhen(o.k)}
                className={`w-full card card-h p-5 flex items-center gap-4 text-left transition-all ${when === o.k ? "!border-grn ring-2 ring-grn/25" : ""}`}
              >
                <span className={`w-13 h-13 rounded-2xl grid place-items-center shrink-0 py-3 px-3 ${o.k === "now" ? "bg-fire text-white" : "bg-tint text-grn"}`}>
                  <Icon name={o.icon as never} className="w-6 h-6" strokeWidth={2} />
                </span>
                <span className="flex-1">
                  <span className="block font-disp font-bold text-lg leading-tight">{o.t}</span>
                  <span className="block text-sm text-mut font-semibold mt-0.5">{o.d}</span>
                </span>
                <span className={`w-6 h-6 rounded-full border-2 grid place-items-center shrink-0 transition-all ${when === o.k ? "border-grn bg-grn" : "border-edge"}`}>
                  {when === o.k && <Icon name="check" className="w-3 h-3 text-white" strokeWidth={3.4} />}
                </span>
              </button>
            ))}
          </div>
          {when === "later" && (
            <div className="card p-5 mt-4 animate-pop">
              <p className="text-[0.65rem] font-extrabold tracking-[0.18em] text-mut2 uppercase mb-3">Programar visita</p>
              <input
                type="date" value={sched.date} min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setSched({ ...sched, date: e.target.value })}
                className="w-full rounded-xl border border-edge px-4 h-12 font-bold text-sm outline-none focus:border-grn/60 bg-card"
              />
              <div className="flex gap-2 mt-3">
                {["Mañana", "Tarde", "Noche"].map((h) => (
                  <button key={h} onClick={() => setSched({ ...sched, hora: h })} className={`flex-1 rounded-xl border py-2.5 text-sm font-bold transition-all ${sched.hora === h ? "chip-on" : "border-edge text-mut"}`}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}
        </FadeUp>
      )}

      {/* PASO 4 · ubicación */}
      {step === 4 && (
        <FadeUp key="s4">
          <h1 className="font-disp font-bold text-2xl sm:text-3xl">¿Dónde?</h1>
          <p className="text-mut mt-1.5 text-sm">Tu dirección exacta se comparte solo cuando el profesional acepta</p>
          <div className="mt-5"><MapCard zoneId={zoneId} h="h-48" /></div>
          <div className="flex items-center gap-3 card p-4 mt-4">
            <span className="w-10 h-10 rounded-full bg-grnsoft text-grn grid place-items-center shrink-0"><Icon name="pin" className="w-5 h-5" strokeWidth={2.1} /></span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{zoneById(zoneId).name}, Santiago</p>
              <p className="text-[0.65rem] text-mut2 font-semibold">Ubicación seleccionada</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {ZONES.slice(0, 6).map((z) => (
              <button key={z.id} onClick={() => setZoneId(z.id)} className={`rounded-xl border px-3.5 py-3 text-left text-xs font-bold transition-all ${zoneId === z.id ? "border-grn bg-grnsoft text-grn" : "border-edge bg-card text-mut hover:border-grn/40"}`}>
                <Icon name="pin" className="w-3 h-3 inline mr-1" strokeWidth={2.4} />{z.name}
              </button>
            ))}
          </div>
        </FadeUp>
      )}

      {/* PASO 5 · matching */}
      {step === 5 && c && !matching && (
        <FadeUp key="s5" className="text-center py-6">
          <div className="flex justify-center"><Radar size={190}><Icon name={c.icon as never} className="w-10 h-10 text-grn" strokeWidth={1.7} /></Radar></div>
          <h1 className="font-disp font-bold text-2xl mt-5">Buscando {c.name.toLowerCase()} cerca de ti…</h1>
          <p className="text-mut text-sm mt-1.5">Priorizando disponibilidad, zona y calificación</p>
          <button onClick={() => setMatching(true)} className="btn-ghost h-12 px-6 mt-6 text-sm">Mostrar resultados</button>
        </FadeUp>
      )}
      {step === 5 && matching && (
        <FadeUp key="s5b">
          <h1 className="font-disp font-bold text-2xl">Profesionales disponibles</h1>
          <p className="text-mut text-sm mt-1 mb-4">{prosByCat(catId).filter((p) => p.available).length} pueden atenderte ahora en {zoneById(zoneId).name}</p>
          <div className="space-y-3.5">
            {prosByCat(catId).sort((a, b) => Number(b.available) - Number(a.available) || b.rating - a.rating).map((p, i) => (
              <ProListItem key={p.id} p={p} delay={i * 60} onOpen={() => go({ t: "pro", id: p.id })} onRequest={() => setSelPro(p.id)} />
            ))}
          </div>
        </FadeUp>
      )}

      {/* barra inferior */}
      <div className="fixed bottom-20 inset-x-0 z-40">
        <div className="max-w-2xl mx-auto px-5">
          <div className="card p-3 flex items-center gap-3 shadow-xl">
            {c && step > 1 && (
              <span className="hidden sm:flex items-center gap-2 rounded-full bg-tint px-3 py-1.5 text-xs font-bold text-mut shrink-0">
                <Icon name={c.icon as never} className="w-3.5 h-3.5 text-grn" strokeWidth={2} /> {c.name}
              </span>
            )}
            {selPro && step >= 2 && (
              <span className="flex items-center gap-2 rounded-full bg-grnsoft text-grn2 px-3 py-1.5 text-xs font-extrabold shrink-0">
                <Face face={proById(selPro).face} name={proById(selPro).name} size="w-5 h-5" /> {proById(selPro).name.split(" ")[0]}
              </span>
            )}
            <button
              disabled={!canNext}
              onClick={() => (step < max ? (step === 4 && !proId ? setStep(5) : setStep(step + 1)) : submit())}
              className="btn-prime flex-1 h-13 text-base disabled:opacity-40 disabled:shadow-none py-3"
            >
              {step < max ? "Continuar" : when === "quote" ? "Solicitar cotizaciones" : when === "later" ? "Programar servicio" : "Enviar solicitud"}
              <Icon name="arrow" className="w-4.5 h-4.5" strokeWidth={2.4} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── SEGUIMIENTO ─────────────────────────── */
const STEPS: { k: Job["status"]; l: string; icon: string }[] = [
  { k: "accepted", l: "Solicitud aceptada", icon: "check" },
  { k: "enroute", l: "En camino", icon: "car" },
  { k: "arrived", l: "Llegó a tu ubicación", icon: "pin" },
  { k: "started", l: "Servicio iniciado", icon: "wrench" },
  { k: "done", l: "Servicio completado", icon: "star" },
];
const ORDER: Record<string, number> = { searching: -1, quoted: 9, accepted: 0, enroute: 1, arrived: 2, started: 3, done: 4 };

export function TrackingView({ jobId, go, jump }: { jobId: string; go: (v: View) => void; jump: (t: "jobs") => void }) {
  const s = useApp();
  const job = s.jobs.find((j) => j.id === jobId);
  const [eta, setEta] = useState<number | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [thanks, setThanks] = useState(false);

  useEffect(() => { if (job?.etaLeft != null) setEta(job.etaLeft); }, [job?.etaLeft != null]);
  useEffect(() => {
    if (!job || job.status !== "enroute") return;
    const t = setInterval(() => setEta((v) => (v != null && v > 0 ? v - 1 : v)), 1000);
    return () => clearInterval(t);
  }, [job?.status]);

  if (!job) return null;
  const cat = catById(job.catId);
  const pro = job.proId ? proById(job.proId) : null;
  const idx = ORDER[job.status];

  /* cotización */
  if (job.status === "quoted") {
    return (
      <div className="max-w-xl mx-auto px-5 pt-10 pb-24 text-center">
        <FadeUp>
          <div className="flex justify-center"><Radar size={180}><Icon name="doc" className="w-10 h-10 text-grn" strokeWidth={1.7} /></Radar></div>
          <h1 className="font-disp font-bold text-2xl mt-5">Cotización solicitada</h1>
          <p className="text-mut mt-2 text-sm leading-relaxed">
            5 profesionales de <strong>{cat.name}</strong> recibieron tu descripción{job.photos.length > 0 && ` y tus ${job.photos.length} fotos`}.
            Te llegarán respuestas con precio y disponibilidad.
          </p>
          <div className="card p-4 mt-6 text-left space-y-3">
            {prosByCat(job.catId).slice(0, 3).map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <Face face={p.face} name={p.name} size="w-10 h-10" />
                <div className="flex-1">
                  <p className="font-bold text-sm">{p.name}</p>
                  <p className="text-[0.65rem] text-mut2 font-semibold">Respondió {["hace 4 min", "hace 11 min", "hace 19 min"][i]}</p>
                </div>
                <span className="font-disp font-bold text-grn">{fmt(p.price + (i + 1) * 350)}</span>
              </div>
            ))}
          </div>
          <button onClick={() => go({ t: "home" })} className="btn-prime h-13 px-8 mt-6 py-3">Entendido</button>
        </FadeUp>
      </div>
    );
  }

  /* programado */
  if (job.when === "later" && job.status === "searching") {
    return (
      <div className="max-w-xl mx-auto px-5 pt-10 pb-24 text-center">
        <FadeUp>
          <span className="text-5xl">📅</span>
          <h1 className="font-disp font-bold text-2xl mt-4">Servicio programado</h1>
          <p className="text-mut mt-2 text-sm">{cat.name} · <strong>{job.scheduledFor}</strong> en {zoneById(job.zoneId).name}.</p>
          <div className="card p-4 mt-6 text-left">
            <p className="text-sm font-semibold text-ink2/85">“{job.problem}”</p>
          </div>
          <p className="text-xs text-mut mt-4">Te notificaremos cuando un profesional confirme la visita.</p>
          <button onClick={() => go({ t: "home" })} className="btn-prime h-13 px-8 mt-6 py-3">Volver al inicio</button>
        </FadeUp>
      </div>
    );
  }

  const mins = eta != null ? Math.max(1, Math.ceil(eta / 60)) : job.etaMin ?? 0;

  return (
    <div className="max-w-xl mx-auto px-5 pb-24">
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur-md py-3 flex items-center gap-3">
        <button onClick={() => jump("jobs")} className="w-10 h-10 grid place-items-center rounded-full card" aria-label="Volver">
          <Icon name="chevl" className="w-4.5 h-4.5" strokeWidth={2.4} />
        </button>
        <div>
          <p className="font-disp font-bold">Seguimiento en vivo</p>
          <p className="text-[0.65rem] font-bold text-mut2 uppercase tracking-wider">{cat.name} · #{job.id.slice(-4).toUpperCase()}</p>
        </div>
      </header>

      {job.status === "searching" ? (
        <FadeUp className="text-center pt-8">
          <div className="flex justify-center"><Radar size={200}><Icon name={cat.icon as never} className="w-10 h-10 text-grn" strokeWidth={1.7} /></Radar></div>
          <h1 className="font-disp font-bold text-2xl mt-5">Buscando tu profesional…</h1>
          <p className="text-mut text-sm mt-2">Avisamos a los {cat.name.toLowerCase()} disponibles en {zoneById(job.zoneId).name}</p>
          <p className="text-xs text-mut2 font-bold mt-4 animate-blinkc">Normalmente aceptan en menos de 1 minuto</p>
        </FadeUp>
      ) : (
        <>
          {/* héroe de estado */}
          <FadeUp>
            <div className="card overflow-hidden mt-2">
              <div className={`p-5 text-white relative overflow-hidden ${job.status === "done" ? "bg-grn" : "bg-ink2"}`}>
                <div className="absolute inset-0 mapgrid-dark opacity-30" aria-hidden />
                <div className="relative flex items-center gap-4">
                  {pro && <Face face={pro.face} name={pro.name} size="w-16 h-16" ring />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.65rem] font-extrabold tracking-[0.18em] uppercase text-white/60">
                      {job.status === "done" ? "Servicio completado" : job.status === "started" ? "Servicio en curso" : job.status === "arrived" ? "Tu profesional llegó" : job.status === "enroute" ? "Viene en camino" : "Solicitud aceptada"}
                    </p>
                    <p className="font-disp font-bold text-xl truncate">{pro ? pro.name : "Asignando profesional"}</p>
                    {pro && (
                      <p className="flex items-center gap-1.5 text-sm text-white/80 font-semibold mt-0.5">
                        <Stars n={pro.rating} size="w-3 h-3" /> {pro.rating} · {cat.name}
                      </p>
                    )}
                  </div>
                  {pro && <FavBtn id={pro.id} className="!bg-white/10 !border-white/20 !text-white shrink-0" />}
                </div>
                {job.status !== "done" && job.status !== "started" && (
                  <div className="relative mt-5 flex items-end justify-between">
                    <div>
                      <p className="text-[0.65rem] font-extrabold tracking-[0.18em] uppercase text-white/60">Llegada estimada</p>
                      <p className="font-disp font-bold text-5xl leading-none mt-1">
                        {job.status === "arrived" ? "0:00" : `${mins}<span className="text-2xl"> min</span>`}
                      </p>
                    </div>
                    <div className="relative w-14 h-14 grid place-items-center">
                      {job.status === "enroute" && <span className="absolute inset-0 rounded-full bg-sun/30 animate-radar motion-reduce:hidden" />}
                      <span className="relative w-11 h-11 rounded-full bg-sun text-ink2 grid place-items-center">
                        <Icon name={job.status === "arrived" ? "pin" : "car"} className="w-5 h-5" strokeWidth={2} />
                      </span>
                    </div>
                  </div>
                )}
                {job.status === "started" && (
                  <p className="relative mt-4 text-sm font-bold text-white/85">
                    {pro?.name.split(" ")[0]} está trabajando en: <span className="text-sun">“{job.problem}”</span>
                  </p>
                )}
                {job.status === "done" && (
                  <div className="relative mt-5 flex items-center justify-between">
                    <p className="font-disp font-bold text-lg">Total acordado: {pro ? fmt(pro.price + 700) : "—"}</p>
                    <span className="rounded-full bg-sun text-ink2 text-xs font-extrabold px-3 py-1.5">PENDIENTE TU RESEÑA</span>
                  </div>
                )}
              </div>

              {/* pasos */}
              <div className="p-5">
                <ol className="space-y-0">
                  {STEPS.map((st, i) => {
                    const done = idx > i || job.status === "done";
                    const now = idx === i && job.status !== "done";
                    return (
                      <li key={st.k} className="flex gap-3.5">
                        <div className="flex flex-col items-center">
                          <span className={`w-9 h-9 rounded-full grid place-items-center shrink-0 transition-all duration-500 ${done ? "bg-grn text-white" : now ? "bg-sun text-ink2" : "bg-tint text-mut2"}`}>
                            {now ? (
                              <span className="relative w-2.5 h-2.5">
                                <span className="absolute inset-0 rounded-full bg-ink2 animate-ping opacity-40 motion-reduce:hidden" />
                                <span className="relative block w-2.5 h-2.5 rounded-full bg-ink2" />
                              </span>
                            ) : (
                              <Icon name={st.icon as never} className="w-4 h-4" strokeWidth={2.2} />
                            )}
                          </span>
                          {i < STEPS.length - 1 && <span className={`w-0.5 flex-1 min-h-6 transition-colors duration-500 ${done ? "bg-grn" : "bg-edge2"}`} />}
                        </div>
                        <div className="pb-5">
                          <p className={`font-bold text-sm leading-9 ${done || now ? "" : "text-mut2"}`}>{st.l}</p>
                          {now && st.k === "enroute" && (
                            <p className="text-xs text-mut font-semibold -mt-1.5">ETA indicada por el profesional · tracking GPS en V2</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>

                {job.status !== "done" && (
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => advanceJob(job.id)} className="btn-ghost flex-1 h-11 text-xs">
                      ⏩ Demo: avanzar estado
                    </button>
                    {job.status === "enroute" && eta != null && eta > 20 && (
                      <button onClick={() => setEta(15)} className="btn-ghost h-11 px-4 text-xs">Acelerar llegada</button>
                    )}
                  </div>
                )}
                {job.status === "done" && (
                  <button onClick={() => (job.rating ? setThanks(true) : setReviewOpen(true))} className="btn-prime w-full h-13 py-3 text-base mt-1">
                    <Icon name="star" className="w-4.5 h-4.5" strokeWidth={2} />
                    {job.rating ? `Calificaste con ${job.rating}★` : "Calificar servicio"}
                  </button>
                )}
              </div>
            </div>
          </FadeUp>

          {/* resumen */}
          <FadeUp d={120}>
            <div className="card p-5 mt-4">
              <p className="text-[0.65rem] font-extrabold tracking-[0.18em] text-mut2 uppercase mb-3">Resumen del servicio</p>
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-grnsoft text-grn grid place-items-center shrink-0"><Icon name={cat.icon as never} className="w-5 h-5" strokeWidth={1.9} /></span>
                <div className="flex-1">
                  <p className="font-bold text-sm">{cat.name}</p>
                  <p className="text-sm text-mut mt-0.5">“{job.problem}”</p>
                  {job.photos.length > 0 && (
                    <div className="flex gap-2 mt-2.5">
                      {job.photos.map((pi) => (
                        <span key={pi} className="relative w-12 h-12 rounded-xl overflow-hidden bg-tint">
                          <img src={jobUrl(pi)} alt="" className="w-[200%] h-[200%] object-cover" style={{ position: "absolute", left: JOB_IMGS[pi].q % 2 === 1 ? "-100%" : "0", top: JOB_IMGS[pi].q >= 2 ? "-100%" : "0" }} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-edge2 text-sm">
                <Icon name="pin" className="w-4 h-4 text-mut2" strokeWidth={2.1} />
                <span className="font-bold">{zoneById(job.zoneId).name}</span>
                <span className="text-mut2">· Santiago</span>
                <button className="ml-auto text-grn font-bold text-xs hover:underline underline-offset-4">Reportar problema</button>
              </div>
            </div>
          </FadeUp>
        </>
      )}

      {/* sheet de reseña */}
      <Sheet open={reviewOpen || thanks} onClose={() => { setReviewOpen(false); setThanks(false); }} title={thanks ? undefined : "¿Cómo lo hizo?"}>
        {thanks ? (
          <div className="text-center py-8 animate-pop">
            <span className="text-6xl">🎉</span>
            <h3 className="font-disp font-bold text-2xl mt-4">¡Gracias, María!</h3>
            <p className="text-mut text-sm mt-2">Tu reseña verificada ayuda a que otros vecinos elijan bien.</p>
            <button onClick={() => { setThanks(false); go({ t: "home" }); }} className="btn-prime h-13 px-8 mt-6 py-3">Volver al inicio</button>
          </div>
        ) : (
          <div>
            {pro && (
              <div className="flex items-center gap-3 mb-5">
                <Face face={pro.face} name={pro.name} size="w-12 h-12" />
                <div>
                  <p className="font-disp font-bold">{pro.name}</p>
                  <p className="text-xs text-mut font-semibold">{cat.name} · hoy</p>
                </div>
              </div>
            )}
            <div className="flex justify-center"><Stars n={stars} size="w-10 h-10" onSet={setStars} /></div>
            <p className="text-center text-sm font-bold mt-2 h-5 text-mut">
              {["", "Malo", "Regular", "Bien", "Muy bien", "¡Excelente!"][stars]}
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {["Puntual", "Ordenado", "Explicó bien", "Precio justo", "Trabajo impecable"].map((t) => (
                <button key={t} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])} className={`rounded-full border px-3.5 py-2 text-xs font-bold transition-all ${tags.includes(t) ? "chip-on" : "border-edge text-mut"}`}>
                  {t}
                </button>
              ))}
            </div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Cuenta cómo fue tu experiencia (opcional)…" className="mt-4 w-full card p-4 text-sm font-semibold outline-none focus:border-grn/60 resize-none placeholder:text-mut2" />
            <button
              disabled={stars === 0}
              onClick={() => { rateJob(job.id, stars, [tags.join(", "), text].filter(Boolean).join(" · ")); setReviewOpen(false); setThanks(true); }}
              className="btn-prime w-full h-13 py-3 mt-4 disabled:opacity-40 disabled:shadow-none"
            >
              Enviar calificación
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

/* ─────────────────────────── TAB: SOLICITUDES ─────────────────────────── */
const HISTORY = [
  { id: "h1", cat: "aire", problem: "Mantenimiento del split de la habitación", pro: "p3", date: "12 feb", rating: 5, price: 1500 },
  { id: "h2", cat: "electricidad", problem: "Instalación de 4 lámparas LED", pro: "p2", date: "28 ene", rating: 5, price: 1400 },
  { id: "h3", cat: "limpieza", problem: "Limpieza profunda post-mudanza", pro: "p5", date: "9 ene", rating: 5, price: 2400 },
];

export function RequestsTab({ go }: { go: (v: View) => void }) {
  const s = useApp();
  const active = s.jobs.filter((j) => j.status !== "done" || !j.rating);
  return (
    <div className="max-w-2xl mx-auto px-5 pb-10">
      <header className="pt-6 pb-4">
        <h1 className="font-disp font-bold text-2xl">Tus solicitudes</h1>
        <p className="text-mut text-sm mt-0.5">Activas e historial</p>
      </header>

      {active.length > 0 && (
        <section className="mb-8">
          <p className="text-[0.65rem] font-extrabold tracking-[0.18em] text-mut2 uppercase mb-3">En curso</p>
          <div className="space-y-3">
            {active.map((j) => {
              const c = catById(j.catId);
              const p = j.proId ? proById(j.proId) : null;
              const label = j.status === "quoted" ? "Cotizando" : j.when === "later" && j.status === "searching" ? "Programado" : { searching: "Buscando profesional", accepted: "Aceptada", enroute: "En camino", arrived: "Llegó", started: "En curso", done: "Pendiente de calificar" }[j.status as "accepted"];
              return (
                <button key={j.id} onClick={() => go({ t: "track", jobId: j.id })} className="w-full card card-h p-4 flex items-center gap-4 text-left">
                  <span className="w-13 h-13 rounded-2xl bg-grnsoft text-grn grid place-items-center shrink-0 py-3 px-3">
                    <Icon name={c.icon as never} className="w-6 h-6" strokeWidth={1.8} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-sm truncate">{j.problem}</span>
                    <span className="block text-xs text-mut font-semibold mt-0.5">{c.name} · {zoneById(j.zoneId).name}</span>
                    {p && (
                      <span className="flex items-center gap-1.5 mt-1.5 text-xs font-bold">
                        <Face face={p.face} name={p.name} size="w-5 h-5" /> {p.name.split(" ")[0]} · ★ {p.rating}
                      </span>
                    )}
                  </span>
                  <span className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`rounded-full px-3 py-1 text-[0.62rem] font-extrabold ${j.status === "done" ? "bg-sunsoft text-[#8a5a00]" : j.status === "quoted" ? "bg-skysoft text-sky" : "bg-grnsoft text-grn"}`}>{label}</span>
                    <Icon name="chevr" className="w-4 h-4 text-mut2" strokeWidth={2.4} />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <p className="text-[0.65rem] font-extrabold tracking-[0.18em] text-mut2 uppercase mb-3">Historial</p>
        {active.length === 0 && (
          <div className="card p-8 text-center mb-4">
            <span className="text-4xl">🧾</span>
            <p className="font-disp font-bold mt-3">Aún no tienes solicitudes activas</p>
            <p className="text-sm text-mut mt-1">Pide tu primer servicio en menos de un minuto.</p>
            <button onClick={() => go({ t: "home" })} className="btn-prime h-12 px-6 mt-4 text-sm">Explorar servicios</button>
          </div>
        )}
        <div className="space-y-3">
          {HISTORY.map((h) => {
            const c = catById(h.cat); const p = proById(h.pro);
            return (
              <div key={h.id} className="card p-4">
                <div className="flex items-center gap-4">
                  <Face face={p.face} name={p.name} size="w-12 h-12" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{h.problem}</p>
                    <p className="text-xs text-mut font-semibold mt-0.5">{p.name} · {h.date}</p>
                    <div className="flex items-center gap-2 mt-1"><Stars n={h.rating} size="w-3 h-3" /><span className="text-xs font-bold">{h.rating}.0</span></div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-disp font-bold text-grn">{fmt(h.price)}</p>
                    <button onClick={() => go({ t: "request", proId: h.pro })} className="text-xs font-extrabold text-grn hover:underline underline-offset-4 mt-1">Repetir</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────── TAB: FAVORITOS ─────────────────────────── */
export function FavoritesTab({ go }: { go: (v: View) => void }) {
  const s = useApp();
  const favs = s.favorites.map((id) => proById(id));
  return (
    <div className="max-w-5xl mx-auto px-5 pb-10">
      <header className="pt-6 pb-4">
        <h1 className="font-disp font-bold text-2xl">Tus favoritos</h1>
        <p className="text-mut text-sm mt-0.5">Los pros que ya conoces y recomiendas</p>
      </header>
      {favs.length === 0 ? (
        <div className="card p-10 text-center">
          <span className="text-5xl">💚</span>
          <p className="font-disp font-bold text-lg mt-4">Guarda a tus profesionales de confianza</p>
          <p className="text-sm text-mut mt-1 max-w-xs mx-auto">Toca el corazón en cualquier perfil para tenerlos a un toque la próxima vez.</p>
          <button onClick={() => go({ t: "explore" })} className="btn-prime h-12 px-6 mt-5 text-sm">Explorar profesionales</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {favs.map((p) => (
            <div key={p.id} className="card card-h p-4 flex flex-col">
              <div className="flex items-start justify-between">
                <Face face={p.face} name={p.name} size="w-14 h-14" ring />
                <FavBtn id={p.id} />
              </div>
              <button onClick={() => go({ t: "pro", id: p.id })} className="text-left mt-3">
                <p className="font-disp font-bold">{p.name}</p>
                <p className="text-xs text-mut font-semibold mt-0.5">{p.tagline}</p>
              </button>
              <div className="flex items-center gap-1.5 mt-2 text-xs"><Stars n={p.rating} size="w-3 h-3" /><span className="font-bold">{p.rating}</span><span className="text-mut2">({p.reviews})</span></div>
              <div className="flex gap-2 mt-4 pt-3 border-t border-edge2">
                <button onClick={() => go({ t: "pro", id: p.id })} className="btn-ghost flex-1 h-10 text-xs">Perfil</button>
                <button onClick={() => go({ t: "request", proId: p.id })} className="btn-prime flex-1 h-10 text-xs">Solicitar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── TAB: PERFIL ─────────────────────────── */
export function MeTab({ go, jump }: { go: (v: View) => void; jump: (t: "jobs") => void }) {
  const s = useApp();
  return (
    <div className="max-w-xl mx-auto px-5 pb-10">
      <header className="pt-6 pb-2"><h1 className="font-disp font-bold text-2xl">Tu cuenta</h1></header>

      <FadeUp>
        <div className="card p-5 flex items-center gap-4">
          <Face face={{ f: 3, q: 3 }} name="María Peralta" size="w-16 h-16" />
          <div className="flex-1">
            <p className="font-disp font-bold text-lg">María Peralta</p>
            <p className="text-sm text-mut font-semibold">+1 809 555 0142 · ★ 4.8 como cliente</p>
            <p className="text-xs text-mut2 font-bold mt-1 inline-flex items-center gap-1"><Icon name="pin" className="w-3 h-3" strokeWidth={2.4} /> {zoneById(s.zoneId).name}, Santiago</p>
          </div>
          <button className="btn-ghost h-10 px-4 text-xs" onClick={() => setZone(s.zoneId === "cerros" ? "jardines" : "cerros")}>Cambiar</button>
        </div>
      </FadeUp>

      <FadeUp d={90}>
        <div className="grid grid-cols-3 gap-px bg-edge2 rounded-2xl overflow-hidden border border-edge2 mt-4">
          {[
            { v: String(s.jobs.length + HISTORY.length), l: "solicitudes" },
            { v: String(s.favorites.length), l: "favoritos" },
            { v: "4", l: "reseñas dadas" },
          ].map((x) => (
            <div key={x.l} className="bg-card px-3 py-4 text-center">
              <p className="font-disp font-bold text-2xl text-grn">{x.v}</p>
              <p className="text-[0.62rem] font-bold text-mut uppercase tracking-wide">{x.l}</p>
            </div>
          ))}
        </div>
      </FadeUp>

      <FadeUp d={140}>
        <button onClick={() => setRole("pro")} className="w-full card card-h p-5 mt-4 flex items-center gap-4 text-left group">
          <span className="w-13 h-13 rounded-2xl bg-grn text-white grid place-items-center shrink-0 py-3 px-3 group-hover:scale-105 transition-transform">
            <Icon name="wrench" className="w-6 h-6" strokeWidth={1.8} />
          </span>
          <span className="flex-1">
            <span className="block font-disp font-bold">Cambiar a modo profesional</span>
            <span className="block text-sm text-mut font-semibold mt-0.5">Revisa solicitudes, gana clientes y gestiona tu disponibilidad</span>
          </span>
          <Icon name="chevr" className="w-5 h-5 text-mut2" strokeWidth={2.2} />
        </button>
      </FadeUp>

      <FadeUp d={180}>
        <div className="card mt-4 divide-y divide-edge2">
          {[
            { icon: "clip", l: "Historial de servicios", fn: () => jump("jobs") },
            { icon: "heart", l: "Favoritos", fn: () => go({ t: "home" }) },
            { icon: "shield", l: "Seguridad y privacidad", fn: () => undefined },
            { icon: "doc", l: "Blueprint técnico V1 (doc interna)", fn: () => { window.location.hash = "#/docs"; } },
          ].map((r) => (
            <button key={r.l} onClick={r.fn} className="w-full flex items-center gap-3.5 px-5 py-4 text-left hover:bg-tint/60 transition-colors">
              <Icon name={r.icon as never} className="w-5 h-5 text-mut" strokeWidth={1.9} />
              <span className="flex-1 font-bold text-sm">{r.l}</span>
              <Icon name="chevr" className="w-4 h-4 text-mut2" strokeWidth={2.2} />
            </button>
          ))}
        </div>
      </FadeUp>

      <p className="text-center text-[0.65rem] text-mut2 font-bold mt-6">AlToque · prototipo navegable v0.1 · Santiago de los Caballeros 🇩🇴</p>
    </div>
  );
}
