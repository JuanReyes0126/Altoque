import { useEffect, useState } from "react";
import { Icon } from "../../components/icons";
import { Face, FadeUp, JobPhoto, MapCard, Stars, Toggle, useCountdown } from "../bits";
import {
  acceptIncoming, advanceProJob, catById, dismissIncoming, fmt, getState, jobUrl, proById, setProAvailable,
  setRole, spawnInbox, tickInbox, useApp, zoneById, CARLOS_ID,
} from "../store";

type ProTab = "home" | "activity" | "me";
const ETAS = [10, 15, 20, 30, 45, 60];

export function ProApp() {
  const s = useApp();
  const [tab, setTab] = useState<ProTab>("home");
  const [etaFor, setEtaFor] = useState<string | null>(null); // incoming id awaiting ETA
  const me = proById(CARLOS_ID);

  useEffect(() => {
    const boot = setTimeout(() => {
      const st = getState();
      if (st.proAvailable && st.inbox.length === 0) spawnInbox();
    }, 1500);
    const t = setInterval(tickInbox, 1000);
    const sp = setInterval(() => {
      const st = getState();
      if (st.role === "pro" && st.proAvailable && !st.proActive && st.inbox.filter((i) => !i.jobId).length < 2) spawnInbox();
    }, 11000);
    return () => { clearTimeout(boot); clearInterval(t); clearInterval(sp); };
  }, []);

  const active = s.proActive;

  return (
    <div className="min-h-dvh bg-night text-ntxt pb-28">
      <div className="max-w-2xl mx-auto px-5">
        {/* header */}
        <header className="pt-6 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-nmut">Modo profesional</p>
            <h1 className="font-disp font-bold text-[1.35rem] leading-tight truncate">{me.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[0.68rem] font-extrabold rounded-full px-3 py-1.5 ${s.proAvailable ? "bg-[#173526] text-[#4ade80]" : "bg-nsurf text-nmut"}`}>
              {s.proAvailable ? "En línea" : "Fuera de línea"}
            </span>
            <Face face={me.face} name={me.name} size="w-10 h-10" />
          </div>
        </header>

        {/* availability switch */}
        <FadeUp>
          <section className={`ncard mt-5 p-5 flex items-center gap-4 transition-colors ${s.proAvailable ? "border-[#2e5c43]" : ""}`}>
            <div className="flex-1">
              <h2 className="font-disp font-bold text-[1.2rem] leading-tight">¿Estás disponible?</h2>
              <p className={`text-[0.78rem] font-semibold mt-1 ${s.proAvailable ? "text-[#4ade80]" : "text-nmut"}`}>
                {s.proAvailable ? "Recibiendo solicitudes cerca de ti" : "No recibirás nuevas solicitudes"}
              </p>
            </div>
            <Toggle on={s.proAvailable} onChange={setProAvailable} label="Disponibilidad" />
          </section>
        </FadeUp>

        {tab === "home" && (
          <>
            {/* active job */}
            {active ? (
              <ActiveJob key={active.id} />
            ) : (
              <>
                {/* incoming requests */}
                <section className="mt-7">
                  <div className="flex items-center justify-between mb-3.5">
                    <h3 className="font-disp font-bold text-[1.05rem]">Solicitudes cerca de ti</h3>
                    <span className="text-[0.7rem] font-extrabold text-namber bg-[#332a14] rounded-full px-2.5 py-1">{s.inbox.length} nuevas</span>
                  </div>

                  {!s.proAvailable ? (
                    <div className="ncard p-8 text-center">
                      <span className="w-14 h-14 rounded-2xl bg-nsurf text-nmut grid place-items-center mx-auto"><Icon name="bell" className="w-7 h-7" strokeWidth={1.7} /></span>
                      <p className="font-disp font-bold text-[1rem] mt-4">Estás fuera de línea</p>
                      <p className="text-[0.8rem] text-nmut font-medium mt-1">Activa tu disponibilidad para recibir trabajos.</p>
                    </div>
                  ) : s.inbox.length === 0 ? (
                    <div className="ncard p-8 text-center">
                      <span className="w-14 h-14 rounded-2xl bg-nsurf text-namber grid place-items-center mx-auto animate-ride"><Icon name="radar" className="w-7 h-7" strokeWidth={1.7} /></span>
                      <p className="font-disp font-bold text-[1rem] mt-4">Buscando solicitudes…</p>
                      <p className="text-[0.8rem] text-nmut font-medium mt-1">Te avisaremos apenas llegue un trabajo en tu zona.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {s.inbox.map((inc, i) => (
                        <IncomingCard key={inc.id} id={inc.id} delay={i * 80} onEta={() => setEtaFor(inc.id)} />
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}

        {tab === "activity" && <Activity />}
        {tab === "me" && <ProMe />}
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
                  onClick={() => { acceptIncoming(etaFor, e); setEtaFor(null); }}
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
function IncomingCard({ id, delay, onEta }: { id: string; delay: number; onEta: () => void }) {
  const s = useApp();
  const inc = s.inbox.find((i) => i.id === id)!;
  const cat = catById(inc.catId);
  const { str } = useCountdown(inc.expiresIn);
  const isLinked = !!inc.jobId;

  return (
    <FadeUp d={delay}>
      <article className={`ncard p-5 border ${isLinked ? "border-namber/60" : "border-nline"}`}>
        <div className="flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-xl bg-nsurf text-namber grid place-items-center shrink-0">
            <Icon name={cat.icon as never} className="w-5 h-5" strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-disp font-bold text-[0.95rem] text-ntxt leading-tight truncate">{cat.name}</p>
            <p className="text-[0.7rem] text-nmut font-semibold flex items-center gap-1.5 mt-0.5">
              <Icon name="pin" className="w-3 h-3" strokeWidth={2.4} /> {zoneById(inc.zoneId).name} · {inc.km} km
            </p>
          </div>
          {isLinked ? (
            <span className="text-[0.6rem] font-extrabold uppercase tracking-wide text-namber bg-[#332a14] rounded-full px-2.5 py-1 shrink-0">Tu cliente</span>
          ) : (
            <span className="font-disp font-bold text-[0.9rem] text-nmut tabular-nums shrink-0">{str}</span>
          )}
        </div>

        {/* client */}
        <div className="flex items-center gap-2.5 mt-4">
          <span className="w-8 h-8 rounded-full bg-nsurf grid place-items-center text-[0.65rem] font-disp font-bold text-nmut">
            {inc.client.split(" ").map((w) => w[0]).join("")}
          </span>
          <p className="text-[0.8rem] font-bold text-ntxt">{inc.client}</p>
          <span className="text-[0.72rem] text-nmut font-semibold inline-flex items-center gap-0.5"><span className="text-namber">★</span>{inc.clientRating.toFixed(1)}</span>
          <span className="ml-auto font-disp font-bold text-[0.9rem] text-namber">{fmt(inc.price)}</span>
        </div>

        <p className="text-[0.82rem] text-nmut font-medium leading-relaxed mt-3.5 bg-nsurf rounded-xl px-4 py-3">
          “{inc.problem}”
        </p>

        {inc.photos.length > 0 && (
          <div className="flex gap-2 mt-3">
            {inc.photos.map((pi) => (
              <span key={pi} className="w-14 h-14 rounded-xl overflow-hidden bg-nsurf shrink-0"><JobPhoto i={pi} /></span>
            ))}
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button onClick={() => dismissIncoming(inc.id)} className="btn-ghost-dark flex-1 h-12 text-[0.85rem]">Rechazar</button>
          <button onClick={onEta} className="flex-[2] h-12 rounded-[14px] bg-namber text-[#33230a] font-extrabold text-[0.88rem] active:scale-95 transition-transform">
            Aceptar
          </button>
        </div>
      </article>
    </FadeUp>
  );
}

/* ── active job (in progress) ── */
function ActiveJob() {
  const s = useApp();
  const a = s.proActive!;
  const cat = catById(a.catId);
  const steps = [
    { k: "enroute", l: "Ir hacia el cliente", ic: "car" },
    { k: "arrived", l: "He llegado", ic: "pin" },
    { k: "started", l: "Servicio en curso", ic: "wrench" },
    { k: "done", l: "Completado", ic: "check" },
  ];
  const idx = steps.findIndex((x) => x.k === a.status);
  const next = steps[idx + 1];
  const actionLabel = a.status === "enroute" ? "He llegado" : a.status === "arrived" ? "Iniciar servicio" : "Completar servicio";

  return (
    <section className="mt-7">
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="font-disp font-bold text-[1.05rem]">Trabajo en curso</h3>
        <span className="text-[0.64rem] font-extrabold uppercase tracking-wide text-namber bg-[#332a14] rounded-full px-2.5 py-1">~{a.etaMin} min</span>
      </div>

      <FadeUp>
        <MapCard dark moving={a.status === "enroute"} label={zoneById(a.zoneId).name} />
      </FadeUp>

      <FadeUp d={80}>
        <div className="ncard p-5 mt-4">
          <div className="flex items-center gap-3.5">
            <span className="w-11 h-11 rounded-xl bg-nsurf text-namber grid place-items-center shrink-0">
              <Icon name={cat.icon as never} className="w-5.5 h-5.5" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-disp font-bold text-[1rem] text-ntxt leading-tight truncate">{a.client}</p>
              <p className="text-[0.72rem] text-nmut font-semibold truncate mt-0.5">{cat.name} · {zoneById(a.zoneId).name}</p>
            </div>
            <span className="font-disp font-bold text-[1rem] text-namber shrink-0">{fmt(a.price)}</span>
          </div>

          <p className="text-[0.82rem] text-nmut font-medium leading-relaxed mt-3.5 bg-nsurf rounded-xl px-4 py-3">“{a.problem}”</p>

          {/* mini timeline */}
          <div className="flex items-center gap-1.5 mt-4">
            {steps.map((st, i) => (
              <span key={st.k} className={`h-1.5 flex-1 rounded-full ${i <= idx ? "bg-namber" : "bg-nline"}`} />
            ))}
          </div>
          <p className="text-[0.72rem] font-bold text-nmut mt-2.5 flex items-center gap-1.5">
            <Icon name={steps[idx].ic as never} className="w-3.5 h-3.5 text-namber" strokeWidth={2.2} />
            {steps[idx].l}
          </p>

          <button onClick={advanceProJob} className="w-full h-13 py-3.5 mt-4 rounded-[14px] bg-namber text-[#33230a] font-extrabold text-[0.9rem] active:scale-95 transition-transform">
            {actionLabel}
          </button>
        </div>
      </FadeUp>
    </section>
  );
}

/* ── activity tab ── */
function Activity() {
  const s = useApp();
  const me = proById(CARLOS_ID);
  const max = Math.max(...s.proStats.week, 1);
  const days = ["L", "M", "X", "J", "V", "S", "D"];
  return (
    <div className="mt-7 space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="ncard p-5">
          <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-nmut">Servicios hoy</p>
          <p className="font-disp font-bold text-[1.8rem] text-ntxt mt-1.5 leading-none">{s.proStats.today}</p>
        </div>
        <div className="ncard p-5">
          <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-nmut">Ganancias hoy</p>
          <p className="font-disp font-bold text-[1.4rem] text-namber mt-1.5 leading-none">{fmt(s.proStats.earnings)}</p>
        </div>
      </div>

      <div className="ncard p-5">
        <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-nmut mb-4">Esta semana</p>
        <div className="flex items-end gap-2.5 h-28">
          {s.proStats.week.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full rounded-t-lg bg-nsurf relative overflow-hidden" style={{ height: "100%" }}>
                <div className="absolute bottom-0 inset-x-0 rounded-t-lg bg-namber/80" style={{ height: `${(v / max) * 100}%` }} />
              </div>
              <span className="text-[0.62rem] font-bold text-nmut">{days[i]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ncard p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-nmut">Tasa de aceptación</p>
          <p className="font-disp font-bold text-[1rem] text-ntxt">{s.proStats.acceptRate}%</p>
        </div>
        <div className="h-2 rounded-full bg-nsurf overflow-hidden mt-2">
          <div className="h-full rounded-full bg-[#4ade80]" style={{ width: `${s.proStats.acceptRate}%` }} />
        </div>
      </div>

      <section>
        <h3 className="font-disp font-bold text-[1.05rem] mb-3.5">Reseñas recientes</h3>
        <div className="space-y-3.5">
          {me.reviewsList.map((r, i) => (
            <FadeUp key={i} d={i * 70}>
              <div className="ncard p-4">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-nsurf text-nmut grid place-items-center text-[0.62rem] font-disp font-bold">
                    {r.name.split(" ").map((w) => w[0]).join("")}
                  </span>
                  <p className="text-[0.82rem] font-bold text-ntxt flex-1">{r.name}</p>
                  <Stars n={r.rating} />
                </div>
                <p className="text-[0.78rem] text-nmut font-medium leading-relaxed mt-2.5">{r.text}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ── me tab ── */
function ProMe() {
  const s = useApp();
  const me = proById(CARLOS_ID);
  return (
    <div className="mt-7 space-y-5">
      <div className="ncard p-5 flex items-center gap-4">
        <Face face={me.face} name={me.name} size="w-16 h-16" />
        <div>
          <p className="font-disp font-bold text-[1.1rem] text-ntxt">{me.name}</p>
          <p className="text-[0.76rem] text-nmut font-semibold mt-0.5">{me.tagline}</p>
          <p className="text-[0.72rem] font-bold text-namber mt-1 inline-flex items-center gap-1"><span>★</span>{me.rating.toFixed(1)} · {me.jobs} trabajos</p>
        </div>
      </div>

      <div className="ncard p-5 border-namber/40">
        <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-namber">Proveedor fundador</p>
        <p className="font-disp font-bold text-[1rem] text-ntxt mt-1.5">Plan Pro gratis · {`2 meses restantes`}</p>
        <p className="text-[0.76rem] text-nmut font-medium mt-1">Refiere colegas verificados y gana más meses.</p>
        <div className="h-2 rounded-full bg-nsurf overflow-hidden mt-3">
          <div className="h-full rounded-full bg-namber" style={{ width: "66%" }} />
        </div>
        <p className="text-[0.68rem] font-bold text-nmut mt-2">2 de 3 referidos para +1 mes</p>
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

      <button onClick={() => setRole("client")} className="w-full ncard card-h p-5 flex items-center gap-4 text-left">
        <span className="w-11 h-11 rounded-xl bg-pine text-white grid place-items-center shrink-0"><Icon name="user" className="w-5.5 h-5.5" strokeWidth={1.8} /></span>
        <span className="flex-1">
          <span className="block font-disp font-bold text-[0.95rem] text-ntxt">Volver al modo cliente</span>
          <span className="block text-[0.74rem] text-nmut font-semibold">Ver la app como la ve un cliente</span>
        </span>
        <Icon name="arrow" className="w-4.5 h-4.5 text-namber shrink-0" strokeWidth={2.2} />
      </button>

      <p className="text-center text-[0.64rem] text-nmut font-semibold pt-2">
        Altoque Pro · hecho en Santiago, RD
      </p>
    </div>
  );
}
