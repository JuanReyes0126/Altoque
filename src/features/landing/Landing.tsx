import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/icons";
import { FadeUp, Sheet } from "../../components/ui/kit";
import { setIntent, setSession, type View } from "../../lib/state";
import { api, authApi, type CatalogCategory, type PublicProvider } from "../../lib/api";
import { profileApi } from "../../lib/profile-api";
import { useApiPolling } from "../../lib/use-api-polling";
import { ApiHttpError } from "../../lib/http";
import { PATHS, roleHome, viewToPath } from "../../lib/router";
import { PublicProviderCard } from "../client/Home";
import { EmailVerificationPanel, resendButtonLabel, useVerificationResend, verificationErrorMessage } from "./EmailVerification";

type AuthState = { mode: "login" | "signup"; intent: View | null } | null;
const TINTS = ["bg-pinesoft text-pine", "bg-sunsoft text-sun2", "bg-skysoft text-sky", "bg-corsoft text-cor"];
const LANDING_STEPS = [
  { icon: "search", title: "Cuéntanos qué necesitas", description: "Elige un servicio y tu zona. Describe el trabajo para que los profesionales puedan conocerlo." },
  { icon: "user", title: "Consulta los perfiles", description: "Explora servicios, zonas de atención y reseñas disponibles en el directorio." },
  { icon: "bolt", title: "Crea tu solicitud", description: "Tu solicitud se comparte con los profesionales habilitados para esa categoría y zona. La asignación se confirma cuando uno la acepta." },
  { icon: "star", title: "Consulta el estado y valora", description: "Desde tu cuenta puedes consultar el avance, confirmar el trabajo completado y dejar una reseña." },
];
const LANDING_FAQ = [
  { question: "¿Puedo explorar antes de crear una cuenta?", answer: "Sí. En esta página puedes consultar las categorías y los profesionales del directorio. Para continuar con una solicitud, crea tu cuenta y verifica tu correo." },
  { question: "¿Qué pasa después de enviar una solicitud?", answer: "La solicitud se comparte con profesionales habilitados para el servicio y la zona que elegiste. La asignación se confirma cuando uno la acepta; puedes consultar el estado desde tu cuenta." },
  { question: "¿Cómo consulto la cobertura de mi zona?", answer: "Filtra el directorio por zona de atención y consulta las zonas de cada perfil. La disponibilidad que ves corresponde a la última consulta y puede cambiar." },
  { question: "¿Quién puede ver la dirección del servicio?", answer: "La dirección exacta no aparece en el directorio público ni en las solicitudes disponibles. Se comparte con el profesional que tenga asignado el trabajo." },
  { question: "¿Cómo empiezo a ofrecer servicios?", answer: "Entra en la sección para profesionales, registra tus servicios y zonas de atención y completa tu perfil. Cuando esté aprobado, podrás activar tu disponibilidad y consultar solicitudes compatibles." },
];

function scrollToId(id: string) {
  const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  if (id === "top") { window.scrollTo({ top: 0, behavior }); return; }
  document.getElementById(id)?.scrollIntoView({ behavior, block: "start" });
}

/** La búsqueda utiliza IDs del catálogo recibido; no el directorio de demo. */
export function landingSearchIntent(query: string, categories: CatalogCategory[]): View {
  const text = query.trim().toLocaleLowerCase("es");
  const category = text ? categories.find((item) => item.name.toLocaleLowerCase("es").includes(text)) : undefined;
  return category ? { t: "results", catId: category.id } : { t: "explore" };
}

function LandingDataState({ loading, error, empty, kind, onRetry, children }: {
  loading: boolean; error: string; empty: boolean; kind: "services" | "providers"; onRetry: () => void; children: ReactNode;
}) {
  if (loading) return <div role="status" aria-live="polite" aria-busy="true" className="mt-8">
    <p className="text-sm font-semibold text-mut mb-4">{kind === "services" ? "Cargando servicios…" : "Cargando profesionales…"}</p>
    <div aria-hidden="true" className={`grid gap-4 ${kind === "services" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
      {Array.from({ length: kind === "services" ? 4 : 3 }, (_, index) => <div key={index} className="card p-5"><div className="skel w-12 h-12" /><div className="skel h-4 w-3/4 mt-5" /><div className="skel h-3 w-1/2 mt-3" /></div>)}
    </div>
  </div>;
  if (error) return <div role="alert" className="card mt-8 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-5">
    <span aria-hidden="true" className="w-12 h-12 rounded-2xl bg-corsoft text-cor grid place-items-center shrink-0"><Icon name="alert" className="w-6 h-6" /></span>
    <div className="flex-1"><h3 className="font-disp font-bold text-lg">{kind === "services" ? "No pudimos cargar los servicios" : "No pudimos cargar los profesionales"}</h3><p className="text-mut text-sm leading-relaxed mt-2">{error}</p></div>
    <button type="button" onClick={onRetry} className="btn-ghost h-12 px-5 shrink-0">Reintentar <Icon aria-hidden="true" name="arrow" className="w-4 h-4" /></button>
  </div>;
  if (empty) return <div role="status" className="card mt-8 p-8 sm:p-10 text-center">
    <span aria-hidden="true" className="w-14 h-14 mx-auto rounded-2xl bg-pinesoft text-pine grid place-items-center"><Icon name={kind === "services" ? "layers" : "search"} className="w-7 h-7" /></span>
    <h3 className="font-disp font-bold text-lg mt-5">No hay resultados disponibles por ahora.</h3>
    <p className="text-sm text-mut leading-relaxed mt-2 max-w-md mx-auto">{kind === "services" ? "Cuando haya categorías disponibles, podrás explorarlas aquí. Puedes volver a consultar el catálogo." : "No hay perfiles disponibles para esta consulta. Puedes cambiar de zona o crear una solicitud desde tu cuenta."}</p>
    <button type="button" onClick={onRetry} className="btn-ghost h-11 px-5 mt-5">Volver a consultar</button>
  </div>;
  return <>{children}</>;
}

export function LandingCatalog({ categories, loading, error, onRetry, onPick }: {
  categories: CatalogCategory[]; loading: boolean; error: string; onRetry: () => void; onPick: (intent: View) => void;
}) {
  return <LandingDataState loading={loading} error={error} empty={categories.length === 0} kind="services" onRetry={onRetry}>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 mt-9">
      {categories.map((category, index) => <FadeUp key={category.id} d={(index % 4) * 55} className="h-full">
        <button type="button" onClick={() => onPick({ t: "results", catId: category.id })} className="group card card-h w-full h-full p-4 sm:p-5 text-left">
          <span className="flex items-start justify-between gap-2"><span aria-hidden="true" className={`w-12 h-12 shrink-0 rounded-2xl grid place-items-center transition-transform group-hover:scale-105 ${TINTS[index % TINTS.length]}`}><Icon name={category.icon as never} className="w-6 h-6" /></span><Icon aria-hidden="true" name="arrow" className="w-4 h-4 text-soft mt-1 transition-transform group-hover:translate-x-1" /></span>
          <span className="block font-disp font-bold mt-5 break-words">{category.name}</span>
          {category.group_name && <span className="block text-[0.7rem] font-semibold text-soft mt-1">{category.group_name}</span>}
          <span className="block text-[0.74rem] font-semibold text-pine mt-4">Explorar este servicio</span>
        </button>
      </FadeUp>)}
    </div>
  </LandingDataState>;
}

export function LandingProviders({ providers, loading, error, onRetry, onPick }: {
  providers: PublicProvider[]; loading: boolean; error: string; onRetry: () => void; onPick: (intent: View) => void;
}) {
  return <LandingDataState loading={loading} error={error} empty={providers.length === 0} kind="providers" onRetry={onRetry}>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-7">
      {providers.map((provider, index) => <FadeUp key={provider.id} d={(index % 3) * 65} className="h-full"><PublicProviderCard provider={provider}
        onOpen={() => onPick({ t: "pro", id: provider.id })}
        onRequest={() => onPick({ t: "request", proId: provider.id })} /></FadeUp>)}
    </div>
  </LandingDataState>;
}

/** Ilustración conceptual del hogar: no representa personas, actividad ni datos del servicio. */
function HomeIllustration() {
  return <svg aria-hidden="true" focusable="false" fill="none" viewBox="0 0 440 260" className="w-full max-w-sm mx-auto">
    <circle cx="220" cy="135" r="113" fill="currentColor" className="text-pinesoft" />
    <circle cx="356" cy="61" r="27" fill="currentColor" className="text-sunsoft" />
    <path d="M33 224h374" stroke="currentColor" strokeWidth="2" className="text-line" />
    <path d="M115 126 220 40l105 86v98H115Z" fill="currentColor" className="text-card" />
    <path d="m100 133 120-99 120 99" stroke="currentColor" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" className="text-pine" />
    <path d="M288 80V43h24v58" fill="currentColor" className="text-pine" />
    <rect x="191" y="151" width="58" height="73" rx="7" fill="currentColor" className="text-pine" />
    <circle cx="235" cy="186" r="3" fill="currentColor" className="text-sun" />
    <rect x="137" y="136" width="37" height="39" rx="5" fill="currentColor" className="text-skysoft" />
    <rect x="266" y="136" width="37" height="39" rx="5" fill="currentColor" className="text-sunsoft" />
    <path d="M155 136v39m-18-19h37m111-20v39m-19-19h37" stroke="currentColor" strokeWidth="2" className="text-card" />
    <path d="M70 222v-51m0 18-14-13m14 24 15-14m274 36v-34m0 12 13-11" stroke="currentColor" strokeWidth="5" strokeLinecap="round" className="text-pine" />
    <path d="m48 85 6 9 11-17m304 66 6 9 11-17" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-sun2" />
    <circle cx="51" cy="90" r="23" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-line" />
    <circle cx="375" cy="147" r="23" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-line" />
  </svg>;
}

export function Landing() {
  const nav = useNavigate();
  const [auth, setAuth] = useState<AuthState>(null);
  const [menu, setMenu] = useState(false);
  const [zone, setZone] = useState("");
  const [query, setQuery] = useState("");
  const catalog = useApiPolling(api.categories.list);
  const zones = useApiPolling(profileApi.zones);
  const loadProviders = useCallback(() => api.providersPublic.list({ ...(zone ? { zone } : {}), available: true, sort: "rating", limit: 6 }), [zone]);
  const directory = useApiPolling(loadProviders);
  const categories = catalog.data ?? [];
  const visibleCategories = !catalog.loading && !catalog.error ? categories : [];
  const openAuth = (mode: "login" | "signup", intent: View | null = null) => setAuth({ mode, intent });
  const pick = (intent: View) => openAuth("signup", intent);
  const goProvider = () => nav(PATHS.providerLanding);
  const links = [["top", "Inicio"], ["servicios", "Servicios"], ["como-funciona", "Cómo funciona"], ["proveedores", "Para profesionales"], ["preguntas", "Preguntas"]] as const;

  return <div className="min-h-dvh pb-24 lg:pb-0">
    <button type="button" onClick={() => { document.getElementById("landing-main")?.focus(); scrollToId("landing-main"); }} className="ui-skip-link">Ir al contenido principal</button>
    <header className="sticky top-0 z-50 bg-paper/90 backdrop-blur-md border-b border-line2">
      <div className="max-w-6xl mx-auto px-4 sm:px-5 h-18 flex items-center gap-2 sm:gap-6">
        <button type="button" onClick={() => scrollToId("top")} className="flex items-center gap-2 group shrink-0 min-h-11" aria-label="Altoque — inicio">
          <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-pine text-white grid place-items-center shadow-card transition-transform group-hover:scale-105"><Icon name="bolt" className="w-5 h-5" /></span>
          <span className="font-disp font-bold text-lg sm:text-xl tracking-tight">altoque<span className="text-sun">.</span></span>
        </button>
        <nav className="hidden lg:flex items-center gap-5 ml-3" aria-label="Principal">
          {links.map(([id, label]) => <button type="button" key={id} onClick={() => scrollToId(id)} className="text-[0.8rem] font-bold text-mut hover:text-ink transition-colors min-h-11">{label}</button>)}
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
          <button type="button" onClick={() => openAuth("login")} className="hidden sm:inline-flex items-center min-h-11 font-bold text-[0.8rem] text-mut hover:text-ink px-2">Iniciar sesión</button>
          <button type="button" onClick={() => pick({ t: "explore" })} className="btn-pine h-11 px-3 sm:px-4 text-[0.72rem] sm:text-sm whitespace-nowrap">Pedir un servicio</button>
          <button type="button" onClick={() => setMenu(true)} aria-label="Abrir menú" aria-haspopup="dialog" aria-expanded={menu} className="lg:hidden w-11 h-11 grid place-items-center rounded-xl border border-line shrink-0"><span aria-hidden="true" className="grid gap-1"><span className="w-4 h-0.5 rounded bg-current" /><span className="w-4 h-0.5 rounded bg-current" /><span className="w-3 h-0.5 rounded bg-current" /></span></button>
        </div>
      </div>
    </header>

    <main id="landing-main" tabIndex={-1}>
      <section id="top" className="relative overflow-hidden scroll-mt-20">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true"><div className="absolute -top-24 -right-24 w-[28rem] h-[28rem] rounded-full bg-pinesoft/70 blur-3xl" /><div className="absolute top-40 -left-32 w-80 h-80 rounded-full bg-sunsoft/80 blur-3xl" /></div>
        <div className="relative max-w-6xl mx-auto px-5 pt-12 sm:pt-16 lg:pt-20 pb-14 lg:pb-20 grid grid-cols-1 lg:grid-cols-[1.03fr_0.97fr] gap-10 lg:gap-12 lg:items-center">
          <div className="min-w-0">
            <FadeUp><span className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-2 text-[0.7rem] sm:text-xs font-bold shadow-card"><Icon name="pin" className="w-4 h-4 shrink-0" /> Servicios en Santiago de los Caballeros</span></FadeUp>
            <FadeUp d={70}><h1 className="font-disp font-bold tracking-tight text-[2.8rem] leading-[1.06] sm:text-6xl mt-6">Lo que necesitas,<br /><span className="relative inline-block text-pine pb-2">Altoque.<svg className="absolute bottom-0 left-0 w-full text-sun" viewBox="0 0 220 14" fill="none" aria-hidden="true"><path d="M4 10 C 60 2, 150 2, 216 8" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></svg></span></h1></FadeUp>
            <FadeUp d={130}><p className="text-base sm:text-lg text-mut font-medium leading-relaxed mt-6 max-w-xl">Encuentra servicios para tu hogar y crea una solicitud para tu zona. Consulta perfiles aprobados y sigue el estado del trabajo desde tu cuenta.</p></FadeUp>
            <form role="search" onSubmit={(event) => { event.preventDefault(); pick(landingSearchIntent(query, visibleCategories)); }} className="mt-7 flex items-center gap-2 rounded-2xl bg-card border border-line shadow-lift pl-4 sm:pl-5 pr-2 h-16 max-w-xl focus-within:border-pine focus-within:ring-2 focus-within:ring-pine/15 transition-shadow">
              <Icon aria-hidden="true" name="search" className="w-5 h-5 text-pine shrink-0" />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Buscar un servicio" placeholder="¿Qué servicio necesitas?" className="flex-1 min-w-0 bg-transparent outline-none font-semibold placeholder:text-soft text-sm sm:text-base" />
              <button type="submit" className="btn-pine h-12 px-4 sm:px-5 shrink-0 text-sm">Buscar <Icon aria-hidden="true" name="arrow" className="w-4 h-4 hidden sm:block" /></button>
            </form>
            {visibleCategories.length > 0 && <div className="flex flex-wrap items-center gap-2 mt-4" aria-label="Accesos a categorías del catálogo"><span className="text-xs font-bold text-soft mr-1">Explora:</span>{visibleCategories.slice(0, 4).map((category) => <button type="button" key={category.id} onClick={() => pick({ t: "results", catId: category.id })} className="chip text-xs min-h-11 px-3 hover:border-pine hover:text-pine">{category.name}</button>)}</div>}
            <p className="text-xs sm:text-sm text-mut mt-5 flex items-start gap-2"><Icon aria-hidden="true" name="pin" className="w-4 h-4 shrink-0 mt-0.5" />La disponibilidad y la cobertura se consultan en el directorio.</p>
            <div className="flex flex-wrap gap-3 mt-7"><button type="button" onClick={() => pick({ t: "explore" })} className="btn-pine h-12 px-5">Explorar servicios <Icon aria-hidden="true" name="arrow" className="w-4 h-4" /></button><button type="button" onClick={() => scrollToId("como-funciona")} className="btn-ghost h-12 px-5">Cómo funciona</button></div>
          </div>
          <FadeUp d={200} className="relative min-w-0">
            <div className="absolute -right-3 -top-3 w-28 h-28 rounded-[2rem] bg-sun/15 rotate-12 pointer-events-none" aria-hidden="true" />
            <div className="relative card rounded-[2rem] p-5 sm:p-7 shadow-lift border-pine/15">
              <div className="flex items-center justify-between gap-3"><span className="text-[0.66rem] font-bold text-pine uppercase tracking-[0.16em]">Pensado para tu hogar</span><span aria-hidden="true" className="w-9 h-9 bg-pinesoft text-pine rounded-xl grid place-items-center"><Icon name="bolt" className="w-4 h-4" /></span></div>
              <HomeIllustration />
              <h2 className="font-disp font-bold text-xl sm:text-2xl">Tu servicio, paso a paso</h2>
              <p className="text-sm text-mut mt-2">De la solicitud al trabajo completado.</p>
              <ol className="grid grid-cols-2 gap-3 mt-5">
                {LANDING_STEPS.map((step, index) => <li key={step.title} className="rounded-2xl bg-paper p-3.5"><span className={`w-9 h-9 rounded-xl grid place-items-center ${TINTS[index]}`} aria-hidden="true"><Icon name={step.icon as never} className="w-4.5 h-4.5" /></span><span className="block text-[0.72rem] text-soft font-bold mt-3">Paso {index + 1}</span><span className="block font-bold text-xs leading-relaxed mt-1">{step.title}</span></li>)}
              </ol>
              <button type="button" onClick={() => pick({ t: "explore" })} className="btn-ghost h-12 w-full mt-5">Explorar servicios <Icon aria-hidden="true" name="arrow" className="w-4 h-4" /></button>
            </div>
          </FadeUp>
        </div>
      </section>

      <section aria-label="Herramientas de Altoque" className="border-y border-line bg-card/70">
        <div className="max-w-6xl mx-auto px-5 py-6 grid sm:grid-cols-3 gap-5 sm:gap-7">
          {[{ icon: "shield", title: "Perfiles aprobados", description: "Consulta servicios, zonas y reseñas disponibles." }, { icon: "pin", title: "Servicios por zona", description: "Explora la cobertura antes de crear tu solicitud." }, { icon: "clip", title: "Todo en tu cuenta", description: "Consulta el estado y el trabajo asignado." }].map((item) => <div key={item.title} className="flex items-start gap-3"><span aria-hidden="true" className="w-10 h-10 rounded-xl bg-pinesoft text-pine grid place-items-center shrink-0"><Icon name={item.icon as never} className="w-5 h-5" /></span><div><h2 className="font-disp font-bold text-sm">{item.title}</h2><p className="text-xs text-mut leading-relaxed mt-1">{item.description}</p></div></div>)}
        </div>
      </section>

      <section id="servicios" aria-labelledby="landing-services-title" className="max-w-6xl mx-auto px-5 pt-16 sm:pt-20 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-bold text-pine uppercase tracking-[0.16em]">Elige por dónde empezar</p><h2 id="landing-services-title" className="font-disp font-bold text-3xl sm:text-4xl tracking-tight mt-3">Servicios para tu día a día</h2><p className="text-mut mt-3 max-w-xl leading-relaxed">Consulta las categorías del catálogo actual de Altoque.</p></div><button type="button" onClick={() => pick({ t: "explore" })} className="btn-ghost h-11 px-5 text-sm">Ver todos los servicios <Icon aria-hidden="true" name="arrow" className="w-4 h-4" /></button></div>
        <LandingCatalog categories={categories} loading={catalog.loading} error={catalog.error} onRetry={catalog.retry} onPick={pick} />
      </section>

      <section id="directorio" aria-labelledby="landing-directory-title" className="max-w-6xl mx-auto px-5 pt-20 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-bold text-pine uppercase tracking-[0.16em]">Conoce sus servicios</p><h2 id="landing-directory-title" className="font-disp font-bold text-3xl sm:text-4xl tracking-tight mt-3">Explora profesionales</h2><p className="text-mut mt-3 max-w-2xl leading-relaxed">Perfiles aprobados que figuran disponibles al consultar el directorio. Su disponibilidad puede cambiar.</p></div><button type="button" onClick={() => pick({ t: "explore" })} className="btn-ghost h-11 px-5 text-sm">Explorar el directorio <Icon aria-hidden="true" name="arrow" className="w-4 h-4" /></button></div>
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-line bg-tint/60 p-4">
          <label htmlFor="landing-zone" className="font-bold text-sm flex items-center gap-2 shrink-0"><Icon aria-hidden="true" name="pin" className="w-4 h-4 text-pine" />Zona de atención</label>
          <select id="landing-zone" value={zone} disabled={zones.loading || !!zones.error} aria-describedby={zones.loading || zones.error ? "landing-zone-status" : undefined} onChange={(event) => setZone(event.target.value)} className="card w-full sm:w-72 h-12 px-4 font-semibold text-sm disabled:opacity-60">
            <option value="">Todas las zonas</option>
            {(zones.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {zones.loading && <p id="landing-zone-status" role="status" className="text-sm text-mut">Cargando zonas…</p>}
          {zones.error && <p id="landing-zone-status" role="alert" className="text-sm text-cor">No pudimos cargar las zonas. <button type="button" onClick={zones.retry} className="underline underline-offset-4 min-h-11 font-bold">Reintentar</button></p>}
        </div>
        <LandingProviders providers={directory.data?.data ?? []} loading={directory.loading} error={directory.error} onRetry={directory.retry} onPick={pick} />
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4"><p className="text-sm text-mut max-w-lg leading-relaxed">¿No encuentras un perfil para tu zona? Puedes describir lo que necesitas en una solicitud.</p><button type="button" onClick={() => pick({ t: "request" })} className="btn-pine h-12 px-5">Crear una solicitud <Icon aria-hidden="true" name="plus" className="w-4 h-4" /></button></div>
      </section>

      <section id="como-funciona" aria-labelledby="landing-how-title" className="max-w-6xl mx-auto px-5 pt-24 scroll-mt-24 lg:grid lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start"><p className="text-xs font-bold text-pine uppercase tracking-[0.16em]">De principio a fin</p><h2 id="landing-how-title" className="font-disp font-bold text-3xl sm:text-4xl tracking-tight mt-3">Cómo funciona Altoque</h2><p className="text-mut mt-5 leading-relaxed max-w-md">Un lugar para encontrar servicios, compartir lo que necesitas y acompañar cada etapa del trabajo.</p><div className="flex flex-wrap gap-3 mt-7"><button type="button" onClick={() => pick({ t: "explore" })} className="btn-pine h-12 px-5">Pedir mi primer servicio</button><button type="button" onClick={goProvider} className="btn-ghost h-12 px-5">Ofrecer servicios</button></div></div>
        <ol className="relative grid gap-4 mt-9 lg:mt-0">
          {LANDING_STEPS.map((step, index) => <li key={step.title} className="card card-h p-5 sm:p-6 flex items-start gap-4 sm:gap-5"><span className={`w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-2xl grid place-items-center ${TINTS[index]}`} aria-hidden="true"><Icon name={step.icon as never} className="w-6 h-6" /></span><div><p className="text-xs text-pine font-bold uppercase tracking-wider">Paso {index + 1}</p><h3 className="font-disp font-bold text-lg mt-2">{step.title}</h3><p className="text-mut text-sm leading-relaxed mt-2">{step.description}</p></div></li>)}
        </ol>
      </section>

      <section id="proveedores" data-theme="dark" aria-labelledby="landing-provider-title" className="mt-24 bg-night text-ntxt scroll-mt-24 relative overflow-hidden">
        <div className="absolute -top-20 right-0 w-96 h-96 rounded-full bg-namber/10 blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-5 py-16 sm:py-20 lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
          <div><span className="inline-flex items-center gap-2 rounded-full border border-namber/30 px-3.5 py-2 text-namber text-xs font-bold uppercase tracking-wider"><Icon aria-hidden="true" name="wrench" className="w-4 h-4" />Para profesionales</span><h2 id="landing-provider-title" className="font-disp font-bold text-3xl sm:text-4xl leading-tight tracking-tight mt-5">Ofrece lo que sabes hacer.</h2><p className="text-nmut leading-relaxed mt-5 max-w-md">Registra tus servicios y zonas de atención. Cuando tu perfil esté aprobado, podrás activar tu disponibilidad y consultar solicitudes compatibles.</p><div className="flex flex-wrap gap-3 mt-8"><button type="button" onClick={goProvider} className="btn-sun h-13 px-6">Quiero ofrecer servicios <Icon aria-hidden="true" name="arrow" className="w-4 h-4" /></button><button type="button" onClick={() => openAuth("login")} className="btn-ghost-dark h-13 px-5">Ya tengo cuenta</button></div></div>
          <div className="ncard rounded-3xl p-6 sm:p-8 mt-9 lg:mt-0"><span aria-hidden="true" className="w-12 h-12 rounded-2xl border border-nline bg-nsurf text-namber grid place-items-center"><Icon name="wrench" className="w-6 h-6" /></span><h3 className="font-disp font-bold text-xl mt-5">Tu espacio profesional</h3><p className="text-sm text-nmut leading-relaxed mt-2">Herramientas para organizar tus servicios desde tu cuenta.</p><ul className="space-y-5 mt-6">{[{ icon: "wrench", text: "Servicios y zonas de atención" }, { icon: "shield", text: "Estado de aprobación de tu perfil" }, { icon: "clock", text: "Disponibilidad Online/Offline" }, { icon: "clip", text: "Estado del trabajo asignado" }].map((item) => <li key={item.text} className="flex items-center gap-3"><span aria-hidden="true" className="w-9 h-9 rounded-xl bg-nsurf text-namber grid place-items-center shrink-0"><Icon name={item.icon as never} className="w-4.5 h-4.5" /></span><span className="text-sm font-semibold">{item.text}</span></li>)}</ul><p className="text-xs text-nmut border-t border-nline pt-5 mt-6 leading-relaxed">Las solicitudes dependen de la categoría, la zona y tu estado de aprobación.</p></div>
        </div>
      </section>

      <section id="preguntas" aria-labelledby="landing-faq-title" className="max-w-6xl mx-auto px-5 pt-20 sm:pt-24 scroll-mt-24 grid lg:grid-cols-[0.8fr_1.2fr] gap-8 lg:gap-16">
        <div><p className="text-xs font-bold text-pine uppercase tracking-[0.16em]">Antes de empezar</p><h2 id="landing-faq-title" className="font-disp font-bold text-3xl sm:text-4xl tracking-tight mt-3">Preguntas frecuentes</h2><p className="text-mut mt-4 leading-relaxed">Conoce cómo se conecta cada parte del servicio.</p><button type="button" onClick={() => pick({ t: "explore" })} className="btn-ghost h-12 px-5 mt-6">Explorar servicios</button></div>
        <div className="space-y-3">{LANDING_FAQ.map((item) => <details key={item.question} className="group card open:border-pine/30"><summary className="list-none cursor-pointer flex items-start justify-between gap-4 p-5 sm:p-6 font-bold text-sm sm:text-base"><span>{item.question}</span><Icon aria-hidden="true" name="plus" className="w-5 h-5 text-pine shrink-0 mt-0.5 transition-transform group-open:rotate-45" /></summary><p className="px-5 sm:px-6 pb-5 sm:pb-6 text-sm text-mut leading-relaxed">{item.answer}</p></details>)}</div>
      </section>

      <section aria-labelledby="landing-cta-title" className="max-w-6xl mx-auto px-5 py-20 sm:py-24"><div className="relative overflow-hidden rounded-[2rem] bg-pinesoft border border-pine/10 p-7 sm:p-10 lg:p-12 flex flex-col lg:flex-row lg:items-center justify-between gap-7"><div className="absolute -top-16 -right-10 w-48 h-48 rounded-full border-[28px] border-pine/5 pointer-events-none" aria-hidden="true" /><div className="relative"><p className="text-xs font-bold text-pine uppercase tracking-[0.16em]">Empieza por lo que necesitas</p><h2 id="landing-cta-title" className="font-disp font-bold text-2xl sm:text-3xl mt-3 tracking-tight">Tu próximo servicio empieza aquí.</h2><p className="text-sm text-mut mt-3 max-w-lg leading-relaxed">Explora el catálogo o crea tu cuenta para enviar una solicitud y consultar su estado.</p></div><div className="relative flex flex-wrap gap-3 shrink-0"><button type="button" onClick={() => pick({ t: "explore" })} className="btn-pine h-12 px-6">Pedir un servicio <Icon aria-hidden="true" name="arrow" className="w-4 h-4" /></button><button type="button" onClick={() => openAuth("signup")} className="btn-ghost h-12 px-5">Crear cuenta</button></div></div></section>
    </main>

    <footer className="border-t border-line bg-paper"><div className="max-w-6xl mx-auto px-5 py-12 grid gap-9 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]"><div><p className="font-disp font-bold text-xl">altoque<span className="text-sun">.</span></p><p className="text-sm text-mut mt-3 leading-relaxed max-w-xs">Servicios y profesionales en Santiago de los Caballeros, RD.</p><p className="text-xs text-soft mt-5 flex items-center gap-2"><Icon aria-hidden="true" name="pin" className="w-4 h-4" />Hecho en Santiago, RD</p></div><nav aria-label="Servicios del catálogo"><h2 className="text-xs font-bold uppercase tracking-wider text-soft">Servicios</h2><ul className="mt-4 space-y-1">{visibleCategories.slice(0, 4).map((category) => <li key={category.id}><button type="button" onClick={() => pick({ t: "results", catId: category.id })} className="text-sm text-mut hover:text-pine min-h-11 text-left">{category.name}</button></li>)}<li><button type="button" onClick={() => pick({ t: "explore" })} className="text-sm text-mut hover:text-pine min-h-11 text-left">Explorar servicios</button></li></ul></nav><nav aria-label="Conoce Altoque"><h2 className="text-xs font-bold uppercase tracking-wider text-soft">Altoque</h2><ul className="mt-4 space-y-1">{links.filter(([id]) => id !== "top" && id !== "servicios").map(([id, label]) => <li key={id}><button type="button" onClick={() => scrollToId(id)} className="text-sm text-mut hover:text-pine min-h-11 text-left">{label}</button></li>)}<li><button type="button" onClick={goProvider} className="text-sm text-mut hover:text-pine min-h-11 text-left">Ofrecer servicios</button></li></ul></nav><nav aria-label="Cuenta"><h2 className="text-xs font-bold uppercase tracking-wider text-soft">Tu cuenta</h2><ul className="mt-4 space-y-1"><li><button type="button" onClick={() => openAuth("login")} className="text-sm text-mut hover:text-pine min-h-11 text-left">Iniciar sesión</button></li><li><button type="button" onClick={() => openAuth("signup")} className="text-sm text-mut hover:text-pine min-h-11 text-left">Crear cuenta</button></li></ul></nav></div><div className="border-t border-line2 px-5 py-5 text-center text-xs text-soft">© {new Date().getFullYear()} Altoque · Hecho en Santiago, RD</div></footer>

    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-4 pb-[max(0.8rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-paper via-paper/95 to-transparent pt-6"><div className="flex gap-3"><button type="button" onClick={goProvider} className="btn-ghost flex-1 h-13 text-sm">Ofrecer servicios</button><button type="button" onClick={() => pick({ t: "explore" })} className="btn-pine flex-[1.4] h-13 text-sm"><Icon aria-hidden="true" name="bolt" className="w-4 h-4" />Pedir un servicio</button></div></div>
    <AuthSheet auth={auth} onClose={() => setAuth(null)} />
    <Sheet open={menu} onClose={() => setMenu(false)} title="Menú"><div className="space-y-2">{links.map(([id, label]) => <button type="button" key={id} onClick={() => { setMenu(false); scrollToId(id); }} className="w-full min-h-12 px-3 text-left font-bold rounded-xl hover:bg-tint transition-colors">{label}</button>)}<div className="border-t border-line pt-4 grid gap-3"><button type="button" onClick={() => { setMenu(false); openAuth("login"); }} className="btn-ghost w-full h-12">Iniciar sesión</button><button type="button" onClick={() => { setMenu(false); openAuth("signup"); }} className="btn-pine w-full h-12">Crear cuenta</button></div></div></Sheet>
  </div>;
}

/* ════════════════ auth sheet (F1.8 · Better Auth real) ════════════════ */
function AuthSheet({ auth, onClose }: { auth: AuthState; onClose: () => void }) {
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  /** cuenta creada pendiente de verificación de correo */
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const resendState = useVerificationResend();
  const resetResend = resendState.reset;

  // sincroniza modo cuando se abre
  useEffect(() => {
    resetResend();
    setError(null); setPendingEmail(null); setEmailSent(false); setPass("");
    if (auth) setMode(auth.mode);
  }, [auth, resetResend]);

  const fail = (e: unknown, fallback: string) => {
    const code = e instanceof ApiHttpError ? e.code : "ERROR";
    const raw = e instanceof ApiHttpError ? e.message : fallback;
    const message =
      code === "USER_ALREADY_EXISTS" ? "Este correo ya está registrado. Inicia sesión."
      : code === "INVALID_EMAIL_OR_PASSWORD" ? "Correo o contraseña incorrectos."
      : code === "EMAIL_NOT_VERIFIED" ? "Tu correo aún no está verificado. Revisa tu bandeja de entrada."
      : code === "RATE_LIMITED" ? "Demasiados intentos. Espera unos minutos."
      : code === "EMAIL_NOT_CONFIGURED" || code === "VERIFICATION_EMAIL_FAILED" ? verificationErrorMessage(e)
      : raw;
    setError({ code, message });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      if (mode === "signup") {
        await authApi.signUp({ name: name.trim(), email: email.trim(), password: pass, ...(phone.trim() ? { phone: phone.trim() } : {}) });
        // Better Auth no emite sesión hasta verificar el correo.
        setPendingEmail(email.trim());
        setEmailSent(true);
        setName(""); setPass("");
      } else {
        const session = await authApi.signIn({ email: email.trim(), password: pass });
        const intent = auth?.intent ?? null;
        setIntent(intent);   // ANTES de setSession: el shell lee el intent al montar
        setSession(session);
        setPass("");
        onClose();
        nav(session.role === "customer" && intent ? viewToPath(intent) : roleHome(session.role));
      }
    } catch (e) {
      if (mode === "signup" && e instanceof ApiHttpError && e.code === "VERIFICATION_EMAIL_FAILED") {
        setPendingEmail(email.trim()); setEmailSent(false); setPass("");
      }
      fail(e, "No pudimos completar la operación. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    const target = pendingEmail ?? email.trim();
    if (!target) return;
    setError(null);
    if (await resendState.resend(target)) { setPendingEmail(target); }
  };

  const close = () => { if (!busy) onClose(); };

  return (
    <Sheet open={!!auth} onClose={close} title={pendingEmail ? "Verifica tu correo" : mode === "signup" ? "Crea tu cuenta" : "Bienvenido de vuelta"}>
      {pendingEmail ? (
        <EmailVerificationPanel email={pendingEmail} sent={emailSent}
          error={error?.message ?? resendState.error} busy={resendState.busy}
          cooldown={resendState.cooldown} accepted={resendState.accepted}
          onResend={resend} onContinue={() => { setPendingEmail(null); setMode("login"); setError(null); }} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-tint mb-5">
            {(["signup", "login"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { if (!busy) { setMode(m); setError(null); } }}
                disabled={busy}
                className={`h-10 rounded-full text-[0.82rem] font-extrabold transition-all ${mode === m ? "bg-ink text-white shadow-card" : "text-mut"}`}
              >
                {m === "signup" ? "Registrarme" : "Iniciar sesión"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <input value={name} onChange={(e) => { if (!busy) setName(e.target.value); }} placeholder="Nombre completo" aria-label="Nombre completo" autoComplete="name" disabled={busy} required className="w-full h-13 rounded-xl border border-line bg-paper px-4 font-semibold outline-none focus:border-pine transition-colors" />
            )}
            <input value={email} onChange={(e) => { if (!busy) setEmail(e.target.value); }} type="email" placeholder="Correo electrónico" aria-label="Correo electrónico" autoComplete="email" disabled={busy} required className="w-full h-13 rounded-xl border border-line bg-paper px-4 font-semibold outline-none focus:border-pine transition-colors" />
            {mode === "signup" && (
              <input value={phone} onChange={(e) => { if (!busy) setPhone(e.target.value); }} type="tel" placeholder="Teléfono (opcional)" aria-label="Teléfono (opcional)" autoComplete="tel" disabled={busy} className="w-full h-13 rounded-xl border border-line bg-paper px-4 font-semibold outline-none focus:border-pine transition-colors" />
            )}
            <input value={pass} onChange={(e) => { if (!busy) setPass(e.target.value); }} type="password" placeholder="Contraseña (mínimo 8 caracteres)" aria-label="Contraseña" autoComplete={mode === "signup" ? "new-password" : "current-password"} disabled={busy} required minLength={8} className="w-full h-13 rounded-xl border border-line bg-paper px-4 font-semibold outline-none focus:border-pine transition-colors" />

            {error && (
              <div role="alert" className="rounded-xl bg-corsoft text-cor px-4 py-3 text-[0.8rem] font-bold flex items-start gap-2.5">
                <Icon name="alert" className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2.2} />
                <span>
                  {error.message}
                  {error.code === "EMAIL_NOT_VERIFIED" && (
                    <button type="button" onClick={resend} disabled={resendState.busy || resendState.cooldown > 0} className="block underline underline-offset-2 mt-1 text-[0.76rem] disabled:opacity-60">
                      {resendButtonLabel(resendState.busy, resendState.cooldown)}
                    </button>
                  )}
                  {error.code === "USER_ALREADY_EXISTS" && (
                    <button type="button" onClick={() => { setMode("login"); setError(null); }} className="block underline underline-offset-2 mt-1 text-[0.76rem]">
                      Ir a iniciar sesión
                    </button>
                  )}
                </span>
              </div>
            )}

            {resendState.error && <p role="alert" className="text-cor text-[0.8rem] font-semibold">{resendState.error}</p>}

            <button type="submit" disabled={busy} className="btn-pine w-full h-13 text-[0.95rem] disabled:opacity-60">
              {busy ? "Un momento…" : mode === "signup" ? "Crear cuenta" : "Entrar"} {!busy && <Icon name="arrow" className="w-4.5 h-4.5" strokeWidth={2.2} />}
            </button>
            {mode === "login" && <button type="button" disabled={busy} onClick={() => { onClose(); nav("/recuperar-contrasena"); }} className="btn-ghost w-full h-11">Olvidé mi contraseña</button>}
          </form>

          <p className="text-center text-[0.72rem] text-soft font-semibold mt-4 leading-relaxed">
            Sesión segura con cookies protegidas. Sin tarjeta, sin compromiso.
          </p>
        </>
      )}
    </Sheet>
  );
}
