import { useState, type FormEvent } from "react";
import { Icon } from "../../components/icons";
import { AvailDot, Face, FadeUp, MapCard, Sheet, Stars, Toggle, Verif } from "../bits";
import {
  CATS, PROS, TICKER, ZONES, catById, fmt, prosByCat, searchAll, setIntent, signIn, useApp, zoneById, type View,
} from "../store";
import { ProviderOnboarding } from "./Provider";

/* ════════════════ helpers ════════════════ */
const LAND_CATS = [
  "plomeria", "electricidad", "aire", "cerrajeria", "limpieza", "mecanica",
  "pintura", "ebanisteria", "mudanzas", "jardineria", "camaras", "remodelacion",
];
const TINTS = [
  "bg-pinesoft text-pine",
  "bg-sunsoft text-sun2",
  "bg-skysoft text-sky",
  "bg-corsoft text-cor",
];

function scrollToId(id: string) {
  if (id === "top") { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

type AuthState = { mode: "login" | "signup"; intent: View | null } | null;

/* ════════════════ LANDING ════════════════ */
export function Landing() {
  const [screen, setScreen] = useState<"home" | "provider">("home");
  const [auth, setAuth] = useState<AuthState>(null);
  const [menu, setMenu] = useState(false);
  const [zone, setZone] = useState("cerros");

  const openAuth = (mode: "login" | "signup", intent: View | null) => setAuth({ mode, intent });
  const goProvider = () => { setScreen("provider"); window.scrollTo({ top: 0 }); };

  if (screen === "provider") {
    return <ProviderOnboarding onBack={() => { setScreen("home"); window.scrollTo({ top: 0 }); }} />;
  }

  const featured = [...PROS].filter((p) => p.available).sort((a, b) => b.rating - a.rating || a.km - b.km).slice(0, 6);
  const z = zoneById(zone);

  return (
    <div className="min-h-dvh pb-24 lg:pb-0">
      {/* ───────── navbar ───────── */}
      <header className="sticky top-0 z-50 bg-paper/85 backdrop-blur-md border-b border-line2">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center gap-6">
          <button onClick={() => scrollToId("top")} className="flex items-center gap-2.5 group" aria-label="Altoque — inicio">
            <span className="w-9 h-9 rounded-xl bg-pine text-white grid place-items-center shadow-card group-hover:scale-105 transition-transform">
              <Icon name="bolt" className="w-5 h-5" strokeWidth={2} />
            </span>
            <span className="font-disp font-bold text-xl tracking-tight">altoque<span className="text-sun">.</span></span>
          </button>

          <nav className="hidden lg:flex items-center gap-7 ml-6" aria-label="Principal">
            {([["top", "Inicio"], ["servicios", "Servicios"], ["como-funciona", "Cómo funciona"], ["proveedores", "Para proveedores"]] as const).map(([id, l]) => (
              <button key={id} onClick={() => scrollToId(id)} className="text-[0.85rem] font-bold text-mut hover:text-ink transition-colors">
                {l}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            <button onClick={() => openAuth("login", null)} className="hidden sm:inline-flex text-[0.85rem] font-bold text-mut hover:text-ink transition-colors px-2">
              Iniciar sesión
            </button>
            <button onClick={() => openAuth("signup", null)} className="hidden sm:inline-flex btn-ghost h-10 px-4 text-[0.85rem]">
              Registrarme
            </button>
            <button onClick={() => openAuth("signup", { t: "explore" })} className="btn-pine h-10 px-4 text-[0.85rem]">
              Pedir un servicio
            </button>
            <button onClick={() => setMenu(true)} className="lg:hidden w-10 h-10 grid place-items-center rounded-xl border border-line bg-card" aria-label="Abrir menú">
              <span className="flex flex-col gap-[5px]">
                <span className="w-[18px] h-[2px] rounded bg-ink" />
                <span className="w-[18px] h-[2px] rounded bg-ink" />
                <span className="w-[12px] h-[2px] rounded bg-ink" />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ───────── hero ───────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute -top-24 -right-24 w-[28rem] h-[28rem] rounded-full bg-pinesoft/70 blur-3xl" />
          <div className="absolute top-40 -left-32 w-80 h-80 rounded-full bg-sunsoft/80 blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-5 pt-12 lg:pt-20 pb-14 lg:grid lg:grid-cols-[1.02fr_0.98fr] lg:gap-14 lg:items-center">
          {/* left */}
          <div>
            <FadeUp>
              <span className="inline-flex items-center gap-2.5 rounded-full border border-line bg-card px-4 py-2 text-[0.74rem] font-extrabold shadow-card">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inset-0 rounded-full bg-ok animate-ping opacity-60" />
                  <span className="relative w-2 h-2 rounded-full bg-ok" />
                </span>
                243 profesionales disponibles ahora en Santiago
              </span>
            </FadeUp>

            <FadeUp d={90}>
              <h1 className="font-disp font-bold tracking-tight text-[2.6rem] leading-[1.04] sm:text-6xl mt-6">
                Lo que necesitas,
                <br />
                <span className="relative inline-block">
                  Altoque.
                  <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 220 14" fill="none" aria-hidden>
                    <path d="M4 10 C 60 2, 150 2, 216 8" stroke="#f5a400" strokeWidth="5" strokeLinecap="round" />
                  </svg>
                </span>
              </h1>
            </FadeUp>

            <FadeUp d={160}>
              <p className="text-lg text-mut font-medium leading-relaxed mt-6 max-w-xl">
                Encuentra profesionales verificados cerca de ti y recibe ayuda cuando la
                necesitas. Sin llamadas, sin esperas eternas, sin sustos en el precio.
              </p>
            </FadeUp>

            {/* buscador */}
            <FadeUp d={230}>
              <SearchBar onPick={(intent) => openAuth("signup", intent)} />
            </FadeUp>

            <FadeUp d={300}>
              <div className="flex flex-wrap items-center gap-2 mt-5">
                <span className="text-[0.72rem] font-extrabold text-soft uppercase tracking-wider mr-1">Populares:</span>
                {["plomeria", "electricidad", "aire", "limpieza", "cerrajeria"].map((id) => (
                  <button key={id} onClick={() => openAuth("signup", { t: "results", catId: id })} className="chip px-3.5 py-1.5 text-[0.76rem] hover:border-pine hover:text-pine">
                    {catById(id).name}
                  </button>
                ))}
              </div>
            </FadeUp>

            <FadeUp d={370}>
              <div className="flex items-center gap-3.5 mt-8">
                <span className="flex -space-x-2.5">
                  {[PROS[0], PROS[4], PROS[2]].map((p) => (
                    <Face key={p.id} face={p.face} name={p.name} size="w-9 h-9" className="ring-2 ring-paper" />
                  ))}
                </span>
                <p className="text-[0.8rem] text-mut font-bold leading-snug">
                  <span className="text-ink">4.8 ★ promedio</span> · +12,400 servicios completados
                </p>
              </div>
            </FadeUp>
          </div>

          {/* right — collage (desktop) */}
          <FadeUp d={250} className="hidden lg:block">
            <HeroCollage onRequest={() => openAuth("signup", { t: "request", proId: "p1" })} />
          </FadeUp>

          {/* compact live card (mobile) */}
          <FadeUp d={300} className="lg:hidden mt-10">
            <MobileHeroCard onRequest={() => openAuth("signup", { t: "request", proId: "p1" })} />
          </FadeUp>
        </div>
      </section>

      {/* ───────── ticker en vivo ───────── */}
      <section className="border-y border-line bg-card py-3.5 overflow-hidden" aria-label="Actividad reciente">
        <div className="flex w-max animate-marquee gap-0">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center" aria-hidden={dup === 1}>
              {TICKER.map((t, i) => (
                <span key={i} className="flex items-center gap-2.5 pr-10 text-[0.8rem] font-semibold text-mut whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-sun shrink-0" /> {t}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ───────── categorías ───────── */}
      <section id="servicios" className="max-w-6xl mx-auto px-5 pt-20 scroll-mt-20">
        <FadeUp>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-disp font-bold text-3xl sm:text-4xl tracking-tight">Todo lo que tu casa necesita</h2>
              <p className="text-mut font-medium mt-2.5 max-w-lg">
                {CATS.length} categorías y cientos de profesionales verificados en Santiago de los Caballeros.
              </p>
            </div>
            <button onClick={() => openAuth("signup", { t: "explore" })} className="chip px-4 py-2 text-[0.8rem] hover:border-pine hover:text-pine">
              Ver todos los servicios <Icon name="chevr" className="w-3.5 h-3.5" strokeWidth={2.4} />
            </button>
          </div>
        </FadeUp>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 mt-9">
          {LAND_CATS.map((id, i) => {
            const c = catById(id);
            const count = prosByCat(id).length;
            return (
              <FadeUp key={id} d={(i % 4) * 70}>
                <button
                  onClick={() => openAuth("signup", { t: "results", catId: id })}
                  className="w-full card card-h p-5 text-left group h-full"
                >
                  <div className="flex items-start justify-between">
                    <span className={`w-12 h-12 rounded-2xl grid place-items-center ${TINTS[i % TINTS.length]} group-hover:scale-110 transition-transform duration-300`}>
                      <Icon name={c.icon as never} className="w-6 h-6" strokeWidth={1.8} />
                    </span>
                    <span className="text-[0.64rem] font-extrabold text-soft bg-tint rounded-full px-2 py-1">{count} pros</span>
                  </div>
                  <p className="font-disp font-bold text-[0.98rem] mt-4">{c.name}</p>
                  <p className="text-[0.74rem] text-mut font-semibold mt-0.5">desde {fmt(c.base)}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[0.74rem] font-extrabold text-pine opacity-0 group-hover:opacity-100 transition-opacity">
                    Buscar pro <Icon name="arrow" className="w-3.5 h-3.5" strokeWidth={2.4} />
                  </span>
                </button>
              </FadeUp>
            );
          })}
        </div>
      </section>

      {/* ───────── disponibles ahora ───────── */}
      <section className="max-w-6xl mx-auto px-5 pt-20">
        <FadeUp>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-disp font-bold text-3xl sm:text-4xl tracking-tight flex items-center gap-3">
                Disponibles ahora
                <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-extrabold text-ok bg-oksoft rounded-full px-3 py-1.5">
                  <AvailDot /> EN VIVO
                </span>
              </h2>
              <p className="text-mut font-medium mt-2.5">Profesionales listos para ir a {z.name} y alrededores.</p>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar mt-6 -mx-5 px-5">
            {ZONES.slice(0, 7).map((zz) => (
              <button
                key={zz.id}
                onClick={() => setZone(zz.id)}
                className={`chip px-4 py-2 text-[0.78rem] shrink-0 ${zone === zz.id ? "chip-on" : ""}`}
              >
                <Icon name="pin" className="w-3.5 h-3.5" strokeWidth={2.2} /> {zz.name}
              </button>
            ))}
          </div>
        </FadeUp>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-7">
          {featured.map((p, i) => (
            <FadeUp key={p.id} d={i * 80}>
              <LandingProCard proId={p.id} onRequest={() => openAuth("signup", { t: "request", proId: p.id })} />
            </FadeUp>
          ))}
        </div>

        <FadeUp d={150}>
          <div className="text-center mt-9">
            <button onClick={() => openAuth("signup", { t: "explore" })} className="btn-ghost h-12 px-7 text-[0.9rem]">
              Ver todos los profesionales <Icon name="arrow" className="w-4.5 h-4.5" strokeWidth={2.2} />
            </button>
          </div>
        </FadeUp>
      </section>

      {/* ───────── cómo funciona ───────── */}
      <section id="como-funciona" className="max-w-6xl mx-auto px-5 pt-24 scroll-mt-20 lg:grid lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <FadeUp className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-[0.72rem] font-extrabold text-pine uppercase tracking-[0.2em]">Así de simple</p>
          <h2 className="font-disp font-bold text-3xl sm:text-4xl tracking-tight mt-3">Cómo funciona Altoque</h2>
          <p className="text-mut font-medium leading-relaxed mt-4 max-w-md">
            De “tengo un problema” a “problema resuelto” en minutos. Tú decides quién entra a tu casa y cuándo.
          </p>
          <dl className="flex gap-8 mt-8">
            {([["<2 min", "para pedir"], ["~15 min", "llegada promedio"], ["4.8 ★", "calificación media"]] as const).map(([v, l]) => (
              <div key={l}>
                <dt className="sr-only">{l}</dt>
                <dd className="font-disp font-bold text-2xl">{v}</dd>
                <dd className="text-[0.72rem] text-soft font-bold mt-0.5">{l}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-3 mt-9">
            <button onClick={() => openAuth("signup", { t: "explore" })} className="btn-pine h-12 px-6 text-[0.9rem]">
              Pedir mi primer servicio
            </button>
            <button onClick={goProvider} className="btn-ghost h-12 px-6 text-[0.9rem]">
              Quiero ofrecer servicios
            </button>
          </div>
        </FadeUp>

        <ol className="relative mt-12 lg:mt-0 space-y-4">
          <span className="absolute left-[1.35rem] top-6 bottom-10 w-px border-l-2 border-dashed border-line" aria-hidden />
          {STEPS.map((st, i) => (
            <FadeUp key={st.t} d={i * 110}>
              <li className="relative card card-h p-5 sm:p-6 ml-0 sm:ml-12 grid sm:grid-cols-[auto_1fr] gap-4 items-start">
                <span className="hidden sm:grid absolute -left-12 top-6 w-11 h-11 rounded-2xl bg-ink text-sun font-disp font-bold text-sm place-items-center">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="sm:hidden w-10 h-10 rounded-xl bg-pinesoft text-pine grid place-items-center">
                  <Icon name={st.icon as never} className="w-5 h-5" strokeWidth={1.9} />
                </span>
                <div>
                  <p className="flex items-center gap-2 font-disp font-bold text-lg">
                    <span className="sm:hidden text-[0.68rem] font-extrabold text-sun2">PASO {i + 1}</span>
                  </p>
                  <h3 className="font-disp font-bold text-lg -mt-1 sm:mt-0">{st.t}</h3>
                  <p className="text-[0.9rem] text-mut font-medium leading-relaxed mt-1.5">{st.d}</p>
                  <div className="mt-3.5">{st.extra}</div>
                </div>
              </li>
            </FadeUp>
          ))}
        </ol>
      </section>

      {/* ───────── para proveedores ───────── */}
      <section id="proveedores" className="mt-24 bg-night text-ntxt relative overflow-hidden scroll-mt-20">
        <div className="absolute inset-0 mapgrid-dark opacity-40 pointer-events-none" aria-hidden />
        <div className="absolute -top-20 right-0 w-96 h-96 rounded-full bg-namber/10 blur-3xl pointer-events-none" aria-hidden />

        <div className="relative max-w-6xl mx-auto px-5 py-20 lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
          <FadeUp>
            <span className="inline-flex items-center gap-2 rounded-full border border-namber/40 text-namber px-4 py-1.5 text-[0.72rem] font-extrabold uppercase tracking-wider">
              <Icon name="wrench" className="w-3.5 h-3.5" strokeWidth={2.2} /> Para profesionales
            </span>
            <h2 className="font-disp font-bold text-3xl sm:text-[2.6rem] leading-[1.08] tracking-tight mt-5">
              Gana dinero con lo que ya sabes hacer.
            </h2>
            <p className="text-nmut font-medium leading-relaxed mt-5 max-w-md">
              Recibe solicitudes de tu zona, acepta las que quieras y cobra tú. Altoque te pone los clientes; el talento lo pones tú.
            </p>

            <ul className="mt-9 space-y-5">
              {PERKS.map((b) => (
                <li key={b.t} className="flex gap-4 items-start">
                  <span className="w-11 h-11 rounded-2xl bg-nsurf border border-nline text-namber grid place-items-center shrink-0">
                    <Icon name={b.icon as never} className="w-5 h-5" strokeWidth={1.9} />
                  </span>
                  <span>
                    <span className="block font-disp font-bold">{b.t}</span>
                    <span className="block text-[0.85rem] text-nmut font-medium mt-0.5">{b.d}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-3 mt-10">
              <button onClick={goProvider} className="btn-sun h-13 px-7 text-[0.95rem] rounded-2xl">
                Quiero ofrecer servicios <Icon name="arrow" className="w-4.5 h-4.5" strokeWidth={2.2} />
              </button>
              <button onClick={() => openAuth("login", null)} className="btn-ghost-dark h-13 px-6 text-[0.95rem] rounded-2xl">
                Ya tengo cuenta
              </button>
            </div>
          </FadeUp>

          <FadeUp d={180}>
            <ProviderMock />
          </FadeUp>
        </div>
      </section>

      {/* ───────── footer ───────── */}
      <footer className="border-t border-line bg-paper">
        <div className="max-w-6xl mx-auto px-5 py-14 grid gap-10 sm:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <span className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-pine text-white grid place-items-center"><Icon name="bolt" className="w-5 h-5" strokeWidth={2} /></span>
              <span className="font-disp font-bold text-xl tracking-tight">altoque<span className="text-sun">.</span></span>
            </span>
            <p className="text-[0.85rem] text-mut font-medium leading-relaxed mt-4 max-w-xs">
              El marketplace de servicios on-demand de República Dominicana. Empieza en Santiago, llega a todo el país.
            </p>
            <p className="flex items-center gap-1.5 text-[0.78rem] font-bold text-soft mt-5">
              <Icon name="pin" className="w-4 h-4" strokeWidth={2} /> Santiago de los Caballeros, RD
            </p>
          </div>
          {([
            ["Servicios", [["Plomería", "plomeria"], ["Electricidad", "electricidad"], ["Aire acondicionado", "aire"], ["Limpieza", "limpieza"], ["Mecánica", "mecanica"]].map(([l, id]) => ({ l, fn: () => openAuth("signup", { t: "results", catId: id }) }))],
            ["Plataforma", [
              { l: "Cómo funciona", fn: () => scrollToId("como-funciona") },
              { l: "Para proveedores", fn: goProvider },
              { l: "Iniciar sesión", fn: () => openAuth("login", null) },
              { l: "Crear cuenta", fn: () => openAuth("signup", null) },
            ]],
            ["Contacto", [
              { l: "hola@altoque.do", fn: () => {} },
              { l: "809-555-0147", fn: () => {} },
              { l: "@altoquerd", fn: () => {} },
            ]],
          ] as const).map(([title, links]) => (
            <div key={title as string}>
              <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.18em] text-soft">{title}</p>
              <ul className="mt-4 space-y-2.5">
                {(links as readonly { l: string; fn: () => void }[]).map((li) => (
                  <li key={li.l}>
                    <button onClick={li.fn} className="text-[0.86rem] font-semibold text-mut hover:text-ink transition-colors">{li.l}</button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-line2">
          <div className="max-w-6xl mx-auto px-5 py-5 flex flex-wrap items-center justify-between gap-3 text-[0.74rem] font-semibold text-soft">
            <span>© 2026 Altoque · Hecho en Santiago, RD 🇩🇴</span>
            <span>RD$ · Español · Prototipo navegable</span>
          </div>
        </div>
      </footer>

      {/* ───────── barra móvil ───────── */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-4 pb-[max(0.8rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-paper via-paper/95 to-transparent pt-6">
        <div className="flex gap-3">
          <button onClick={goProvider} className="btn-ghost flex-1 h-13 text-[0.88rem]">
            Ofrecer servicios
          </button>
          <button onClick={() => openAuth("signup", { t: "explore" })} className="btn-pine flex-[1.4] h-13 text-[0.88rem]">
            <Icon name="bolt" className="w-4.5 h-4.5" strokeWidth={2.2} /> Pedir un servicio
          </button>
        </div>
      </div>

      {/* ───────── sheets ───────── */}
      <AuthSheet auth={auth} onClose={() => setAuth(null)} />

      <Sheet open={menu} onClose={() => setMenu(false)} title="Menú">
        <div className="space-y-1.5">
          {([["top", "Inicio"], ["servicios", "Servicios"], ["como-funciona", "Cómo funciona"], ["proveedores", "Para proveedores"]] as const).map(([id, l]) => (
            <button
              key={id}
              onClick={() => { setMenu(false); scrollToId(id); }}
              className="w-full text-left px-4 py-3.5 rounded-xl font-bold text-ink hover:bg-tint transition-colors"
            >
              {l}
            </button>
          ))}
          <div className="pt-3 grid gap-2.5">
            <button onClick={() => { setMenu(false); openAuth("login", null); }} className="btn-ghost h-12 text-[0.9rem]">Iniciar sesión</button>
            <button onClick={() => { setMenu(false); openAuth("signup", null); }} className="btn-pine h-12 text-[0.9rem]">Crear cuenta gratis</button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

/* ════════════════ piezas del hero ════════════════ */
function SearchBar({ onPick }: { onPick: (intent: View) => void }) {
  const [q, setQ] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const res = searchAll(q);
    onPick(res.cats[0] ? { t: "results", catId: res.cats[0].id } : { t: "explore" });
  };
  return (
    <form onSubmit={submit} className="mt-7 flex items-center gap-2 rounded-full bg-card border border-line shadow-lift pl-5 pr-2 h-[3.6rem] focus-within:border-pine transition-colors max-w-xl">
      <Icon name="search" className="w-5 h-5 text-pine shrink-0" strokeWidth={2.2} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Plomero, electricista, limpieza…"
        className="flex-1 min-w-0 bg-transparent outline-none font-semibold placeholder:text-soft/80"
        aria-label="Buscar un servicio"
      />
      <button type="submit" className="btn-pine h-11 px-6 text-[0.88rem] shrink-0">Buscar</button>
    </form>
  );
}

function HeroCollage({ onRequest }: { onRequest: () => void }) {
  const carlos = PROS[0];
  return (
    <div className="relative h-[30rem] select-none">
      <div className="absolute right-0 top-8 w-[80%] rotate-2 card overflow-hidden rounded-3xl">
        <MapCard moving label="Santiago · Cerros de Gurabo" />
      </div>

      {/* pro card */}
      <div className="absolute left-0 top-0 w-[17rem] card rounded-3xl p-4.5 p-5 shadow-lift animate-floaty">
        <div className="flex items-center gap-3">
          <Face face={carlos.face} name={carlos.name} size="w-13 h-13" />
          <div className="min-w-0">
            <p className="font-disp font-bold text-[0.95rem] leading-tight truncate">{carlos.name}</p>
            <p className="flex items-center gap-1.5 text-[0.74rem] font-bold text-mut mt-0.5">
              <Stars n={5} size="w-3 h-3" /> {carlos.rating} ({carlos.reviews})
            </p>
          </div>
          <Verif />
        </div>
        <div className="flex items-center gap-2 mt-3.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sunsoft text-sun2 px-3 py-1.5 text-[0.72rem] font-extrabold">
            <Icon name="clock" className="w-3.5 h-3.5" strokeWidth={2.2} /> Llega en ~{carlos.eta} min
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tint text-mut px-3 py-1.5 text-[0.72rem] font-extrabold">
            <Icon name="pin" className="w-3.5 h-3.5" strokeWidth={2.2} /> {carlos.km} km
          </span>
        </div>
        <button onClick={onRequest} className="btn-pine w-full h-11 mt-3.5 text-[0.85rem]">
          <Icon name="wrench" className="w-4 h-4" strokeWidth={2} /> Solicitar plomería
        </button>
      </div>

      {/* toast completado */}
      <div className="absolute left-6 bottom-6 w-[16.5rem] card rounded-2xl p-4 shadow-lift animate-floaty" style={{ animationDelay: "1.4s" }}>
        <p className="flex items-center gap-2 text-[0.8rem] font-extrabold">
          <span className="w-6 h-6 rounded-full bg-oksoft text-ok grid place-items-center shrink-0"><Icon name="check" className="w-3.5 h-3.5" strokeWidth={2.8} /></span>
          Servicio completado
        </p>
        <p className="text-[0.74rem] text-mut font-semibold mt-1.5 leading-snug">“Llegó en 12 minutos y dejó todo impecable.”</p>
        <Stars n={5} size="w-3 h-3" />
      </div>

      <span className="absolute right-4 top-0 rounded-full bg-pine text-white px-4 py-2 text-[0.74rem] font-extrabold shadow-lift animate-floaty" style={{ animationDelay: "0.7s" }}>
        Visita desde RD$800
      </span>
    </div>
  );
}

function MobileHeroCard({ onRequest }: { onRequest: () => void }) {
  const carlos = PROS[0];
  return (
    <div className="card rounded-3xl overflow-hidden shadow-lift">
      <div className="relative h-36">
        <MapCard moving label="Tu zona · Santiago" />
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-sunsoft text-sun2 px-3 py-1.5 text-[0.7rem] font-extrabold shadow-card">
          <Icon name="clock" className="w-3.5 h-3.5" strokeWidth={2.2} /> Llega en ~{carlos.eta} min
        </span>
      </div>
      <div className="p-4.5 p-5 flex items-center gap-3.5">
        <Face face={carlos.face} name={carlos.name} size="w-12 h-12" />
        <div className="min-w-0 flex-1">
          <p className="font-disp font-bold text-[0.95rem] truncate">{carlos.name}</p>
          <p className="text-[0.74rem] font-bold text-mut">★ {carlos.rating} · Plomería · {carlos.km} km</p>
        </div>
        <button onClick={onRequest} className="btn-pine h-10 px-4 text-[0.8rem] shrink-0">Pedir</button>
      </div>
    </div>
  );
}

/* ════════════════ card de pro para landing ════════════════ */
function LandingProCard({ proId, onRequest }: { proId: string; onRequest: () => void }) {
  const p = PROS.find((x) => x.id === proId)!;
  const c = catById(p.cats[0]);
  return (
    <article className="card card-h p-5 h-full flex flex-col">
      <div className="flex items-center gap-3.5">
        <Face face={p.face} name={p.name} size="w-14 h-14" />
        <div className="min-w-0 flex-1">
          <p className="font-disp font-bold text-[1.02rem] leading-tight truncate flex items-center gap-1.5">
            {p.name} {p.verified.pro && <Verif />}
          </p>
          <p className="flex items-center gap-1.5 text-[0.78rem] font-bold text-mut mt-1">
            <Stars n={Math.round(p.rating)} size="w-3 h-3" /> {p.rating} · {p.reviews} reseñas
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-oksoft text-ok px-2.5 py-1.5 text-[0.66rem] font-extrabold shrink-0">
          <AvailDot /> Disponible
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4.5 mt-5">
        <span className="rounded-xl bg-tint px-2 py-2 text-center">
          <Icon name={c.icon as never} className="w-4 h-4 mx-auto text-pine" strokeWidth={2} />
          <span className="block text-[0.62rem] font-extrabold text-mut mt-1 truncate px-0.5">{c.name}</span>
        </span>
        <span className="rounded-xl bg-tint px-2 py-2 text-center">
          <Icon name="pin" className="w-4 h-4 mx-auto text-pine" strokeWidth={2} />
          <span className="block text-[0.62rem] font-extrabold text-mut mt-1">{p.km} km</span>
        </span>
        <span className="rounded-xl bg-sunsoft px-2 py-2 text-center">
          <Icon name="clock" className="w-4 h-4 mx-auto text-sun2" strokeWidth={2} />
          <span className="block text-[0.62rem] font-extrabold text-sun2 mt-1">~{p.eta} min</span>
        </span>
      </div>

      <div className="flex items-center justify-between mt-auto pt-4.5 pt-5 border-t border-line2 mt-5">
        <p className="text-[0.74rem] font-bold text-soft">
          Desde <span className="text-ink font-disp text-[0.95rem] font-bold">{fmt(p.price)}</span>
        </p>
        <button onClick={onRequest} className="btn-pine h-10 px-5 text-[0.8rem]">
          Solicitar <Icon name="arrow" className="w-3.5 h-3.5" strokeWidth={2.4} />
        </button>
      </div>
    </article>
  );
}

/* ════════════════ mock del panel pro (sección oscura) ════════════════ */
function ProviderMock() {
  const [on, setOn] = useState(true);
  const carlos = PROS[0];
  return (
    <div className="relative max-w-sm mx-auto lg:mr-0">
      <div className="ncard rounded-3xl p-5 -rotate-1 shadow-lift">
        <div className="flex items-center gap-3">
          <Face face={carlos.face} name={carlos.name} size="w-12 h-12" />
          <div className="flex-1 min-w-0">
            <p className="font-disp font-bold text-ntxt truncate">{carlos.name}</p>
            <p className="text-[0.72rem] font-bold text-nmut">★ 4.9 · Plomería</p>
          </div>
          <span className={`text-[0.66rem] font-extrabold rounded-full px-3 py-1.5 ${on ? "bg-[#173526] text-[#4ade80]" : "bg-nsurf text-nmut"}`}>
            {on ? "En línea" : "Fuera de línea"}
          </span>
        </div>

        <div className="mt-4 bg-nsurf border border-nline rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.85rem] font-extrabold text-ntxt">¿Estás disponible?</p>
            <p className="text-[0.68rem] font-semibold text-nmut mt-0.5">{on ? "Recibiendo solicitudes" : "No recibirás solicitudes"}</p>
          </div>
          <Toggle on={on} onChange={setOn} label="Disponibilidad" />
        </div>

        <div className={`transition-all duration-500 ${on ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}>
          <p className="flex items-center justify-between mt-5 mb-2.5">
            <span className="text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-nmut">Nueva solicitud</span>
            <span className="text-[0.66rem] font-bold text-namber">hace 8 s</span>
          </p>
          <div className="bg-nsurf border border-nline rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-namber/15 text-namber grid place-items-center"><Icon name="wrench" className="w-4 h-4" strokeWidth={2} /></span>
              <span className="text-[0.85rem] font-extrabold text-ntxt">Plomería</span>
              <span className="ml-auto text-[0.72rem] font-bold text-nmut flex items-center gap-1"><Icon name="pin" className="w-3.5 h-3.5" strokeWidth={2} /> 2.1 km</span>
            </div>
            <p className="text-[0.8rem] text-nmut font-medium leading-snug mt-2.5">“Fuga debajo del fregadero, gotea constante desde anoche.”</p>
            <p className="text-[0.7rem] font-bold text-nmut mt-2">Cliente ★ 4.8 · Los Jardines · RD$800</p>
            <div className="grid grid-cols-2 gap-2.5 mt-3.5">
              <button className="btn-sun h-10 text-[0.8rem] rounded-xl">Aceptar</button>
              <button className="btn-ghost-dark h-10 text-[0.8rem] rounded-xl">Rechazar</button>
            </div>
          </div>
        </div>

        <p className="flex items-center justify-between mt-5 text-[0.72rem] font-extrabold text-nmut">
          <span>Hoy</span>
          <span className="text-ntxt">4 servicios · <span className="text-namber">RD$6,350</span></span>
        </p>
      </div>

      <span className="absolute -top-4 -right-3 rounded-full bg-namber text-[#33230a] px-4 py-2 text-[0.7rem] font-extrabold shadow-lift rotate-3 animate-floaty">
        🎁 3 meses Pro gratis
      </span>
    </div>
  );
}

/* ════════════════ auth sheet ════════════════ */
function AuthSheet({ auth, onClose }: { auth: AuthState; onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pass, setPass] = useState("");
  const { session } = useApp();

  // sincroniza modo cuando se abre
  const [lastOpen, setLastOpen] = useState(false);
  if (auth && !lastOpen) { setLastOpen(true); setMode(auth.mode); }
  if (!auth && lastOpen) setLastOpen(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (auth?.intent) setIntent(auth.intent);
    signIn(mode === "signup" ? name || "María Peralta" : name || session?.name || "María Peralta", "client");
    setName(""); setPhone(""); setPass("");
    onClose();
  };

  return (
    <Sheet open={!!auth} onClose={onClose} title={mode === "signup" ? "Crea tu cuenta" : "Bienvenido de vuelta"}>
      <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-tint mb-5">
        {(["signup", "login"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`h-10 rounded-full text-[0.82rem] font-extrabold transition-all ${mode === m ? "bg-ink text-white shadow-card" : "text-mut"}`}
          >
            {m === "signup" ? "Registrarme" : "Iniciar sesión"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3">
        {mode === "signup" && (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre completo" className="w-full h-13 rounded-xl border border-line bg-paper px-4 font-semibold outline-none focus:border-pine transition-colors" />
        )}
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono o correo" className="w-full h-13 rounded-xl border border-line bg-paper px-4 font-semibold outline-none focus:border-pine transition-colors" />
        <input value={pass} onChange={(e) => setPass(e.target.value)} type="password" placeholder="Contraseña" className="w-full h-13 rounded-xl border border-line bg-paper px-4 font-semibold outline-none focus:border-pine transition-colors" />
        <button type="submit" className="btn-pine w-full h-13 text-[0.95rem]">
          {mode === "signup" ? "Crear cuenta y entrar" : "Entrar"} <Icon name="arrow" className="w-4.5 h-4.5" strokeWidth={2.2} />
        </button>
      </form>

      <p className="text-center text-[0.72rem] text-soft font-semibold mt-4 leading-relaxed">
        Prototipo: cualquier dato te deja entrar.<br />Sin tarjeta, sin compromiso.
      </p>
    </Sheet>
  );
}

/* ════════════════ datos de sección ════════════════ */
const STEPS: { t: string; d: string; icon: string; extra: React.ReactNode }[] = [
  {
    t: "Dinos qué necesitas",
    d: "Selecciona la categoría o describe tu problema en una línea. Si ayuda, añade un par de fotos.",
    icon: "search",
    extra: (
      <span className="flex flex-wrap gap-2">
        <span className="chip px-3 py-1.5 text-[0.7rem] pointer-events-none"><Icon name="wrench" className="w-3.5 h-3.5" strokeWidth={2} /> Plomería</span>
        <span className="chip px-3 py-1.5 text-[0.7rem] pointer-events-none">“Fuga debajo del fregadero”</span>
        <span className="chip px-3 py-1.5 text-[0.7rem] pointer-events-none">📷 2 fotos</span>
      </span>
    ),
  },
  {
    t: "Compara profesionales",
    d: "Disponibilidad real, reputación, distancia, precio estimado y tiempo de llegada. Todo en una pantalla.",
    icon: "user",
    extra: (
      <span className="inline-flex items-center gap-2 rounded-xl bg-tint px-3.5 py-2 text-[0.74rem] font-extrabold text-mut">
        <Stars n={5} size="w-3 h-3" /> 4.9 · 2.3 km · llega en ~15 min · desde RD$800
      </span>
    ),
  },
  {
    t: "Solicita el servicio",
    d: "Elige a tu profesional y envía la solicitud. Él la acepta y te dice exactamente cuándo llega.",
    icon: "bolt",
    extra: (
      <span className="inline-flex items-center gap-2 rounded-xl bg-oksoft text-ok px-3.5 py-2 text-[0.74rem] font-extrabold">
        <Icon name="check" className="w-4 h-4" strokeWidth={2.6} /> Carlos aceptó tu solicitud
      </span>
    ),
  },
  {
    t: "Síguelo y valora",
    d: "Sigue el estado en vivo: en camino, llegó, servicio iniciado y completado. Al final, deja tu valoración.",
    icon: "star",
    extra: (
      <span className="flex items-center gap-2.5" aria-hidden>
        {["done", "done", "now", "next", "next"].map((s, i) => (
          <span key={i} className="flex items-center gap-2.5">
            <span className={`w-3 h-3 rounded-full ${s === "done" ? "bg-ok" : s === "now" ? "bg-sun ring-4 ring-sunsoft" : "bg-line"}`} />
            {i < 4 && <span className="w-5 h-0.5 rounded bg-line" />}
          </span>
        ))}
      </span>
    ),
  },
];

const PERKS = [
  { icon: "pin", t: "Solicitudes de tu zona", d: "Trabajos cerca de ti. Tú decides cuáles aceptar." },
  { icon: "shield", t: "Perfil verificado que genera confianza", d: "Insignias de identidad y teléfono verificados." },
  { icon: "gift", t: "Programa Fundador", d: "3 meses de plan Pro gratis para los primeros 100 verificados." },
  { icon: "clock", t: "Tú controlas tu horario", d: "Ponte disponible o no, con un solo toque." },
];
