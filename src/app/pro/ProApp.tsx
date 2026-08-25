import { useEffect, useState } from "react";
import { Icon } from "../../components/icons";
import { BigToggle, Face, FadeUp, MapCard, Sheet, Stars } from "../bits";
import {
  CARLOS_ID, acceptIncoming, advanceProJob, catById, dismissIncoming, fmt, jobUrl, proById, setProAvailable,
  setRole, spawnInbox, tickInbox, useApp, zoneById, type Incoming,
} from "../store";

const ETAS = [10, 15, 20, 30, 45, 60];
const ME = proById(CARLOS_ID);

type ProTab = "home" | "activity" | "me";

export function ProApp() {
  const s = useApp();
  const [tab, setTab] = useState<ProTab>("home");
  const [pending, setPending] = useState<Incoming | null>(null);
  const [eta, setEta] = useState(15);

  useEffect(() => {
    const boot = setTimeout(() => {
      const st = getState();
      if (st.proAvailable && st.inbox.length === 0) spawnInbox();
    }, 1800);
    const t = setInterval(tickInbox, 1000);
    const sp = setInterval(() => {
      const st = getState();
      if (st.role === "pro" && st.proAvailable && !st.proActive && st.inbox.filter((i) => !i.jobId).length < 2) spawnInbox();
    }, 11000);
    return () => { clearTimeout(boot); clearInterval(t); clearInterval(sp); };
  }, []);

  const confirmEta = () => {
    if (pending) acceptIncoming(pending.id, eta);
    setPending(null);
  };

  return (
    <div className="min-h-dvh bg-night text-ntxt font-txt pb-24">
      {tab === "home" && <ProHome onAccept={(i) => { setPending(i); setEta(15); }} />}
      {tab === "activity" && <ProActivity />}
      {tab === "me" && <ProMe />}

      {/* sheet ETA */}
      <Sheet open={!!pending} onClose={() => setPending(null)} title="¿Cuánto tardas en llegar?">
        {pending && (
          <div>
            <div className="rounded-2xl bg-tint p-4 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-grnsoft text-grn grid place-items-center">
                <Icon name={catById(pending.catId).icon as never} className="w-5 h-5" strokeWidth={1.9} />
              </span>
              <div className="flex-1">
                <p className="font-bold text-sm text-ink2">{pending.client}</p>
                <p className="text-xs text-mut font-semibold">{zoneById(pending.zoneId).name} · {pending.km} km de ti</p>
              </div>
              <span className="font-disp font-bold text-grn text-ink2">{fmt(pending.price)}</span>
            </div>
            <p className="text-[0.65rem] font-extrabold tracking-[0.18em] text-mut2 uppercase mt-5 mb-2.5">Tiempo estimado de llegada</p>
            <div className="grid grid-cols-3 gap-2.5">
              {ETAS.map((e) => (
                <button key={e} onClick={() => setEta(e)} className={`rounded-2xl border py-3.5 font-disp font-bold text-lg transition-all active:scale-95 ${eta === e ? "border-grn bg-grn text-white shadow-lg" : "border-edge bg-card text-ink2"}`}>
                  {e}<span className="text-xs font-txt font-bold"> min</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-mut mt-3 text-center font-semibold">El cliente verá: “Llegada estimada: {eta} minutos”. Tracking GPS real llega en V2.</p>
            <button onClick={confirmEta} className="btn-prime w-full h-14 mt-4 text-base">
              Aceptar y notificar al cliente
            </button>
          </div>
        )}
      </Sheet>

      {/* bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-50">
        <div className="mx-auto max-w-md px-5 pb-[max(0.9rem,env(safe-area-inset-bottom))]">
          <div className="rounded-3xl bg-ncard/95 backdrop-blur border border-nline shadow-2xl grid grid-cols-3 h-16">
            {([
              { k: "home", icon: "home", l: "Inicio" },
              { k: "activity", icon: "clip", l: "Actividad" },
              { k: "me", icon: "user", l: "Perfil" },
            ] as const).map((t) => (
              <button key={t.k} onClick={() => setTab(t.k)} className={`flex flex-col items-center justify-center gap-1 rounded-2xl mx-1.5 my-1.5 transition-all ${tab === t.k ? "bg-nsurf text-sun" : "text-nmut hover:text-ntxt"}`}>
                <Icon name={t.icon as never} className="w-5 h-5" strokeWidth={2} />
                <span className="text-[0.6rem] font-extrabold">{t.l}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}
import { getState } from "../store";

/* ─────────────────────────── HOME PRO ─────────────────────────── */
function ProHome({ onAccept }: { onAccept: (i: Incoming) => void }) {
  const s = useApp();
  const linked = s.inbox.filter((i) => i.jobId);
  const others = s.inbox.filter((i) => !i.jobId);

  return (
    <div className="max-w-xl mx-auto px-5">
      {/* header */}
      <header className="pt-5 flex items-center gap-3">
        <Face face={ME.face} name={ME.name} size="w-11 h-11" />
        <div>
          <p className="font-disp font-bold leading-tight">{ME.name}</p>
          <p className="text-xs text-nmut font-semibold flex items-center gap-1"><Stars n={ME.rating} size="w-3 h-3" /> {ME.rating} · Plomería</p>
        </div>
        <span className="ml-auto font-disp font-bold text-lg tracking-tight text-sun">altoque<span className="text-ntxt">/pro</span></span>
      </header>

      {/* disponibilidad */}
      <FadeUp>
        <div className={`mt-5 rounded-3xl p-5 border transition-all duration-500 relative overflow-hidden ${s.proAvailable ? "bg-ncard border-grn/60 shadow-[0_0_50px_rgba(12,95,70,0.35)]" : "bg-ncard border-nline"}`}>
          {s.proAvailable && <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-grn/20 blur-2xl" aria-hidden />}
          <div className="relative flex items-center gap-4">
            <div className="flex-1">
              <p className={`font-disp font-extrabold text-2xl tracking-tight ${s.proAvailable ? "text-[#3ecf8e]" : "text-nmut"}`}>
                {s.proAvailable ? "🟢 DISPONIBLE" : "⚫ NO DISPONIBLE"}
              </p>
              <p className="text-sm text-nmut font-semibold mt-1">
                {s.proAvailable ? "Los clientes de tu zona pueden encontrarte" : "Estás oculto para nuevas solicitudes"}
              </p>
            </div>
            <BigToggle on={s.proAvailable} onChange={setProAvailable} />
          </div>
          {s.proActive && (
            <p className="relative mt-3 text-xs font-bold text-sun flex items-center gap-2">
              <Icon name="wrench" className="w-3.5 h-3.5" strokeWidth={2.2} /> Tienes un servicio activo — nuevas solicitudes en espera
            </p>
          )}
        </div>
      </FadeUp>

      {/* stats */}
      <FadeUp d={90}>
        <div className="grid grid-cols-4 gap-px bg-nline rounded-2xl overflow-hidden border border-nline mt-4">
          {[
            { v: String(s.proStats.today), l: "hoy" },
            { v: fmt(s.proStats.earnings), l: "ganancias", small: true },
            { v: `★ ${ME.rating}`, l: "rating" },
            { v: `${s.proStats.acceptRate}%`, l: "aceptación" },
          ].map((x) => (
            <div key={x.l} className="bg-ncard px-2 py-3.5 text-center">
              <p className={`font-disp font-bold ${x.small ? "text-[0.82rem]" : "text-lg"} text-sun`}>{x.v}</p>
              <p className="text-[0.58rem] font-bold text-nmut uppercase tracking-wider mt-0.5">{x.l}</p>
            </div>
          ))}
        </div>
      </FadeUp>

      {/* servicio activo */}
      {s.proActive ? <ActiveJobCard /> : (
        <>
          {/* inbox */}
          <section className="mt-7">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-disp font-bold text-xl">Solicitudes cerca de ti</h2>
              <span className="text-xs font-bold text-nmut">{s.inbox.length > 0 ? `${s.inbox.length} nueva${s.inbox.length > 1 ? "s" : ""}` : ""}</span>
            </div>

            {!s.proAvailable ? (
              <div className="rounded-3xl border border-dashed border-nline p-8 text-center">
                <span className="text-4xl">🌙</span>
                <p className="font-disp font-bold mt-3">Estás fuera de línea</p>
                <p className="text-sm text-nmut mt-1">Actívate para recibir solicitudes de tu zona.</p>
                <button onClick={() => setProAvailable(true)} className="mt-4 rounded-full bg-[#3ecf8e] text-night font-extrabold px-6 h-12 text-sm hover:brightness-110 transition-all active:scale-95">
                  Ponerme disponible
                </button>
              </div>
            ) : s.inbox.length === 0 ? (
              <div className="rounded-3xl border border-nline bg-ncard p-8 text-center relative overflow-hidden">
                <div className="absolute inset-0 mapgrid-dark opacity-50" aria-hidden />
                <div className="relative">
                  <span className="relative inline-flex w-12 h-12">
                    <span className="absolute inset-0 rounded-full bg-[#3ecf8e]/30 animate-radar motion-reduce:hidden" />
                    <span className="relative m-auto w-12 h-12 rounded-full bg-nsurf grid place-items-center"><Icon name="radar" className="w-5 h-5 text-[#3ecf8e]" strokeWidth={1.9} /></span>
                  </span>
                  <p className="font-disp font-bold mt-4">Escuchando solicitudes…</p>
                  <p className="text-sm text-nmut mt-1">Plomería · zona norte de Santiago · radio ~5 km</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                {linked.concat(others).map((i, idx) => (
                  <FadeUp key={i.id} d={idx * 80}>
                    <div className={`rounded-3xl bg-ncard border p-5 animate-pop ${i.jobId ? "border-sun/70 shadow-[0_0_36px_rgba(255,179,0,0.12)]" : "border-nline"}`}>
                      {i.jobId && (
                        <p className="text-[0.62rem] font-extrabold tracking-[0.16em] text-sun uppercase mb-3 flex items-center gap-1.5">
                          <Icon name="bolt" className="w-3 h-3" strokeWidth={2.6} /> Solicitud “Ahora” de la demo de cliente
                        </p>
                      )}
                      <div className="flex items-center gap-3">
                        <span className="w-12 h-12 rounded-2xl bg-nsurf text-[#3ecf8e] grid place-items-center shrink-0">
                          <Icon name={catById(i.catId).icon as never} className="w-6 h-6" strokeWidth={1.8} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-disp font-bold truncate">{catById(i.catId).name}</p>
                          <p className="text-xs text-nmut font-semibold flex items-center gap-1.5 mt-0.5">
                            <Icon name="pin" className="w-3 h-3" strokeWidth={2.4} /> {zoneById(i.zoneId).name} · {i.km} km
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-disp font-bold text-sun">{fmt(i.price)}</p>
                          <p className="text-[0.6rem] text-nmut font-bold">estimado</p>
                        </div>
                      </div>
                      <p className="text-sm text-ntxt/85 mt-3.5 leading-relaxed">“{i.problem}”</p>
                      {i.photos.length > 0 && (
                        <div className="flex gap-2 mt-2.5">
                          {i.photos.map((pi) => (
                            <JobThumb key={pi} pi={pi} />
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2.5 mt-4 pt-4 border-t border-nline">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-nmut">
                          <span className="w-6 h-6 rounded-full bg-nsurf grid place-items-center text-[0.6rem] font-extrabold text-ntxt">{i.client[0]}</span>
                          {i.client} · ★ {i.clientRating}
                        </span>
                        <span className={`ml-auto text-[0.68rem] font-extrabold rounded-full px-2.5 py-1 ${i.expiresIn <= 60 && i.expiresIn > 0 ? "bg-fire/20 text-fire animate-blinkc" : "bg-nsurf text-nmut"}`}>
                          {i.expiresIn > 60 ? "● asignada" : i.expiresIn > 0 ? `Expira en ${i.expiresIn}s` : "Por vencer"}
                        </span>
                      </div>
                      <div className="flex gap-2.5 mt-4">
                        <button onClick={() => dismissIncoming(i.id)} className="btn-ghost flex-1 h-12 text-sm !bg-nsurf !border-nline !text-nmut hover:!text-ntxt">
                          Rechazar
                        </button>
                        <button onClick={() => onAccept(i)} className="flex-1 h-12 rounded-full bg-[#3ecf8e] text-night font-extrabold text-sm hover:brightness-110 transition-all active:scale-95 shadow-[0_8px_24px_rgba(62,207,142,0.3)]">
                          Aceptar
                        </button>
                      </div>
                    </div>
                  </FadeUp>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function JobThumb({ pi }: { pi: number }) {
  return (
    <span className="relative w-12 h-12 rounded-xl overflow-hidden bg-nsurf">
      <img
        src={jobUrl(pi)} alt=""
        className="w-[200%] h-[200%] object-cover"
        style={{ position: "absolute", left: pi % 2 === 1 ? "-100%" : "0", top: pi >= 2 ? "-100%" : "0" }}
        onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
      />
    </span>
  );
}

function ActiveJobCard() {
  const s = useApp();
  const a = s.proActive!;
  const c = catById(a.catId);
  const meta: Record<string, { l: string; btn: string; icon: string }> = {
    enroute: { l: "Vas en camino", btn: "He llegado", icon: "pin" },
    arrived: { l: "Estás en la ubicación", btn: "Iniciar servicio", icon: "wrench" },
    started: { l: "Servicio en curso", btn: "Completar servicio", icon: "check" },
  };
  const m = meta[a.status] ?? meta.enroute;
  return (
    <section className="mt-7">
      <FadeUp>
        <div className="rounded-3xl bg-ncard border border-sun/40 overflow-hidden">
          <div className="p-5">
            <p className="text-[0.65rem] font-extrabold tracking-[0.2em] text-sun uppercase">{m.l} · ETA {a.etaMin} min</p>
            <div className="flex items-center gap-3.5 mt-3">
              <span className="w-12 h-12 rounded-full bg-nsurf grid place-items-center font-disp font-bold text-lg">{a.client[0]}</span>
              <div className="flex-1 min-w-0">
                <p className="font-disp font-bold text-lg leading-tight">{a.client} · ★ {a.clientRating}</p>
                <p className="text-sm text-nmut font-semibold">{c.name} · {zoneById(a.zoneId).name} · {a.km} km</p>
              </div>
              <p className="font-disp font-bold text-sun shrink-0">{fmt(a.price)}</p>
            </div>
            <p className="text-sm text-ntxt/85 mt-3.5">“{a.problem}”</p>
          </div>
          <div className="px-5 pb-3"><MapCard zoneId={a.zoneId} dark h="h-36" label={`${zoneById(a.zoneId).name} · ${a.km} km`} /></div>
          <div className="p-5 pt-2">
            <div className="flex gap-1.5 mb-4">
              {(["enroute", "arrived", "started", "done"] as const).map((st, i) => {
                const idx = ["enroute", "arrived", "started", "done"].indexOf(a.status);
                return <span key={st} className={`h-1.5 flex-1 rounded-full ${i <= idx ? "bg-sun" : "bg-nline"}`} />;
              })}
            </div>
            <button onClick={advanceProJob} className="w-full h-14 rounded-full bg-sun text-night font-extrabold text-base hover:brightness-105 transition-all active:scale-[0.98] shadow-[0_10px_30px_rgba(255,179,0,0.25)]">
              {m.btn}
            </button>
            <button onClick={advanceProJob} className="w-full text-center text-xs font-bold text-nmut mt-3 hover:text-ntxt transition-colors">
              (demo) el cliente ve cada cambio en vivo
            </button>
          </div>
        </div>
      </FadeUp>
    </section>
  );
}

/* ─────────────────────────── ACTIVIDAD ─────────────────────────── */
const WEEK_JOBS = [
  { cat: "plomeria", problem: "Destape de drenaje", price: 1400, when: "Hoy · 9:40 AM" },
  { cat: "plomeria", problem: "Instalación de lavabo", price: 2200, when: "Hoy · 8:15 AM" },
  { cat: "plomeria", problem: "Fuga en calentador", price: 1800, when: "Ayer · 5:30 PM" },
  { cat: "plomeria", problem: "Revisión de cisterna", price: 950, when: "Ayer · 11:00 AM" },
];

function ProActivity() {
  const s = useApp();
  const max = Math.max(...s.proStats.week, 1);
  const days = ["L", "M", "X", "J", "V", "S", "D"];
  return (
    <div className="max-w-xl mx-auto px-5">
      <header className="pt-6 pb-4">
        <h1 className="font-disp font-bold text-2xl">Tu actividad</h1>
        <p className="text-nmut text-sm mt-0.5">Ganancias y reseñas de tu trabajo</p>
      </header>

      <FadeUp>
        <div className="rounded-3xl bg-ncard border border-nline p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-[0.65rem] font-extrabold tracking-[0.18em] text-nmut uppercase">Ganancias de la semana</p>
            <p className="font-disp font-bold text-2xl text-sun">{fmt(s.proStats.week.reduce((a, b) => a + b, 0))}</p>
          </div>
          <div className="flex items-end gap-2.5 mt-5 h-28">
            {s.proStats.week.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[0.58rem] font-bold text-nmut">{v > 0 ? `${Math.round(v / 1000)}k` : ""}</span>
                <div
                  className={`w-full rounded-t-lg transition-all duration-700 ${v > 0 ? "bg-gradient-to-t from-grn to-[#3ecf8e]" : "bg-nline"}`}
                  style={{ height: `${Math.max(6, (v / max) * 80)}px` }}
                />
                <span className={`text-[0.6rem] font-extrabold ${i === 4 ? "text-sun" : "text-nmut"}`}>{days[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </FadeUp>

      <FadeUp d={100}>
        <section className="mt-6">
          <p className="text-[0.65rem] font-extrabold tracking-[0.18em] text-nmut uppercase mb-3">Servicios recientes</p>
          <div className="space-y-2.5">
            {WEEK_JOBS.map((j, i) => (
              <div key={i} className="rounded-2xl bg-ncard border border-nline p-4 flex items-center gap-3.5">
                <span className="w-10 h-10 rounded-xl bg-nsurf text-[#3ecf8e] grid place-items-center shrink-0">
                  <Icon name={catById(j.cat).icon as never} className="w-5 h-5" strokeWidth={1.9} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{j.problem}</p>
                  <p className="text-[0.68rem] text-nmut font-semibold mt-0.5">{j.when}</p>
                </div>
                <p className="font-disp font-bold text-[#3ecf8e] shrink-0">+{fmt(j.price)}</p>
              </div>
            ))}
          </div>
        </section>
      </FadeUp>

      <FadeUp d={160}>
        <section className="mt-6">
          <p className="text-[0.65rem] font-extrabold tracking-[0.18em] text-nmut uppercase mb-3">Últimas reseñas</p>
          <div className="space-y-2.5">
            {ME.reviewsList.slice(0, 2).map((r, i) => (
              <div key={i} className="rounded-2xl bg-ncard border border-nline p-4">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{r.name}</span>
                  <Stars n={r.rating} size="w-3 h-3" />
                  <span className="text-[0.62rem] text-nmut font-semibold ml-auto">{r.ago}</span>
                </div>
                <p className="text-sm text-ntxt/80 mt-2">“{r.text}”</p>
              </div>
            ))}
          </div>
        </section>
      </FadeUp>
    </div>
  );
}

/* ─────────────────────────── PERFIL PRO ─────────────────────────── */
function ProMe() {
  return (
    <div className="max-w-xl mx-auto px-5">
      <header className="pt-6 pb-4">
        <h1 className="font-disp font-bold text-2xl">Perfil profesional</h1>
      </header>

      <FadeUp>
        <div className="rounded-3xl bg-ncard border border-nline p-5 flex items-center gap-4">
          <Face face={ME.face} name={ME.name} size="w-16 h-16" />
          <div className="flex-1">
            <p className="font-disp font-bold text-lg">{ME.name}</p>
            <p className="text-sm text-nmut font-semibold">Plomería · 9 años · Santiago norte</p>
            <p className="flex items-center gap-1.5 mt-1"><Stars n={ME.rating} size="w-3 h-3" /><span className="text-xs font-bold">{ME.rating} ({ME.reviews})</span></p>
          </div>
        </div>
      </FadeUp>

      <FadeUp d={90}>
        <div className="rounded-3xl bg-ncard border border-nline p-5 mt-4">
          <p className="text-[0.65rem] font-extrabold tracking-[0.18em] text-nmut uppercase mb-3">Verificaciones</p>
          <div className="space-y-2.5">
            {[
              { l: "Identidad (cédula)", on: true },
              { l: "Teléfono verificado", on: true },
              { l: "Profesional verificado", on: true },
              { l: "Antecedentes (opcional V2)", on: false },
            ].map((v) => (
              <div key={v.l} className="flex items-center gap-3">
                <span className={`w-7 h-7 rounded-full grid place-items-center ${v.on ? "bg-[#3ecf8e]/15 text-[#3ecf8e]" : "bg-nsurf text-nmut"}`}>
                  <Icon name={v.on ? "check" : "clock"} className="w-3.5 h-3.5" strokeWidth={2.6} />
                </span>
                <span className={`text-sm font-bold ${v.on ? "" : "text-nmut"}`}>{v.l}</span>
              </div>
            ))}
          </div>
        </div>
      </FadeUp>

      <FadeUp d={140}>
        <div className="rounded-3xl border border-sun/50 bg-ncard p-5 mt-4 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-sun/10 blur-xl" aria-hidden />
          <p className="text-[0.65rem] font-extrabold tracking-[0.2em] text-sun uppercase">★ Proveedor fundador</p>
          <p className="font-disp font-bold text-lg mt-1.5">Plan Pro gratis hasta el 14 de mayo</p>
          <p className="text-sm text-nmut font-semibold mt-1">Luego RD$799/mes. Sin tarjeta guardada — cero riesgo.</p>
          <div className="mt-4">
            <div className="flex justify-between text-xs font-bold mb-1.5">
              <span className="text-nmut">Referidos verificados</span>
              <span className="text-sun">2 de 3 → +1 mes gratis</span>
            </div>
            <div className="h-2.5 rounded-full bg-nline overflow-hidden">
              <div className="h-full w-2/3 bg-gradient-to-r from-grn to-sun rounded-full" />
            </div>
          </div>
          <button className="mt-4 w-full h-12 rounded-full border border-sun/50 text-sun font-extrabold text-sm hover:bg-sun/10 transition-colors">
            Invitar colegas · tu código: CARLOS-07
          </button>
        </div>
      </FadeUp>

      <FadeUp d={190}>
        <div className="rounded-3xl bg-ncard border border-nline mt-4 divide-y divide-nline">
          {[
            { icon: "settings", l: "Categorías y zonas de trabajo" },
            { icon: "calendar", l: "Horarios de disponibilidad" },
            { icon: "cam", l: "Fotos de trabajos anteriores" },
            { icon: "doc", l: "Blueprint técnico V1 (doc interna)", hash: true },
          ].map((r) => (
            <button
              key={r.l}
              onClick={() => { if (r.hash) window.location.hash = "#/docs"; }}
              className="w-full flex items-center gap-3.5 px-5 py-4 text-left hover:bg-nsurf/50 transition-colors"
            >
              <Icon name={r.icon as never} className="w-5 h-5 text-nmut" strokeWidth={1.9} />
              <span className="flex-1 font-bold text-sm">{r.l}</span>
              <Icon name="chevr" className="w-4 h-4 text-nmut" strokeWidth={2.2} />
            </button>
          ))}
        </div>
      </FadeUp>

      <FadeUp d={230}>
        <button onClick={() => setRole("client")} className="w-full rounded-3xl bg-ncard border border-nline p-5 mt-4 flex items-center gap-4 text-left hover:border-nmut/50 transition-colors">
          <span className="w-11 h-11 rounded-2xl bg-nsurf text-ntxt grid place-items-center shrink-0"><Icon name="user" className="w-5 h-5" strokeWidth={1.9} /></span>
          <span className="flex-1">
            <span className="block font-disp font-bold">Volver al modo cliente</span>
            <span className="block text-sm text-nmut font-semibold">La app de consumo, como la ven tus clientes</span>
          </span>
          <Icon name="chevr" className="w-5 h-5 text-nmut" strokeWidth={2.2} />
        </button>
        <p className="text-center text-[0.62rem] text-nmut font-bold mt-6">AlToque Pro · prototipo v0.1 · Santiago 🇩🇴</p>
      </FadeUp>
    </div>
  );
}
