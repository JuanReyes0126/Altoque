import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/icons";
import { FadeUp, Sheet } from "../../components/ui/kit";
import { setIntent, setSession, type View } from "../../lib/state";
import { api, authApi, type CatalogCategory, type PublicProvider } from "../../lib/api";
import { profileApi } from "../../lib/profile-api";
import { useApiPolling } from "../../lib/use-api-polling";
import { ApiHttpError } from "../../lib/http";
import { PATHS, roleHome, viewToPath } from "../../lib/router";
import { CatalogState, PublicProviderCard } from "../client/Home";
import { EmailVerificationPanel, resendButtonLabel, useVerificationResend, verificationErrorMessage } from "./EmailVerification";

type AuthState = { mode: "login" | "signup"; intent: View | null } | null;
const TINTS = ["bg-pinesoft text-pine", "bg-sunsoft text-sun2", "bg-skysoft text-sky", "bg-corsoft text-cor"];
const LANDING_STEPS = [
  { icon: "search", title: "Cuéntanos qué necesitas", description: "Elige un servicio y tu zona. Describe el trabajo para que los profesionales puedan conocerlo." },
  { icon: "user", title: "Consulta los perfiles", description: "Explora servicios, zonas de atención y reseñas disponibles en el directorio." },
  { icon: "bolt", title: "Crea tu solicitud", description: "Tu solicitud se comparte con los profesionales habilitados para esa categoría y zona. La asignación se confirma cuando uno la acepta." },
  { icon: "star", title: "Consulta el estado y valora", description: "Desde tu cuenta puedes consultar el avance, confirmar el trabajo completado y dejar una reseña." },
];

function scrollToId(id: string) {
  if (id === "top") { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** La búsqueda utiliza IDs del catálogo recibido; no el directorio de demo. */
export function landingSearchIntent(query: string, categories: CatalogCategory[]): View {
  const text = query.trim().toLocaleLowerCase("es");
  const category = text ? categories.find((item) => item.name.toLocaleLowerCase("es").includes(text)) : undefined;
  return category ? { t: "results", catId: category.id } : { t: "explore" };
}

export function LandingCatalog({ categories, loading, error, onRetry, onPick }: {
  categories: CatalogCategory[]; loading: boolean; error: string; onRetry: () => void; onPick: (intent: View) => void;
}) {
  return <CatalogState loading={loading} error={error} empty={categories.length === 0} onRetry={onRetry}>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 mt-9">
      {categories.map((category, index) => <button key={category.id} onClick={() => onPick({ t: "results", catId: category.id })} className="card card-h p-5 text-left">
        <span className={`w-12 h-12 rounded-2xl grid place-items-center ${TINTS[index % TINTS.length]}`}><Icon name={category.icon as never} className="w-6 h-6" /></span>
        <span className="block font-disp font-bold mt-4">{category.name}</span>
        <span className="block text-[0.74rem] text-mut mt-1">Explorar este servicio</span>
      </button>)}
    </div>
  </CatalogState>;
}

export function LandingProviders({ providers, loading, error, onRetry, onPick }: {
  providers: PublicProvider[]; loading: boolean; error: string; onRetry: () => void; onPick: (intent: View) => void;
}) {
  return <CatalogState loading={loading} error={error} empty={providers.length === 0} onRetry={onRetry}>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-7">
      {providers.map((provider) => <PublicProviderCard key={provider.id} provider={provider}
        onOpen={() => onPick({ t: "pro", id: provider.id })}
        onRequest={() => onPick({ t: "request", proId: provider.id })} />)}
    </div>
  </CatalogState>;
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
  const openAuth = (mode: "login" | "signup", intent: View | null = null) => setAuth({ mode, intent });
  const pick = (intent: View) => openAuth("signup", intent);
  const goProvider = () => nav(PATHS.providerLanding);
  const links = [["top", "Inicio"], ["servicios", "Servicios"], ["como-funciona", "Cómo funciona"], ["proveedores", "Para profesionales"]] as const;

  return <div className="min-h-dvh pb-24 lg:pb-0">
    <header className="sticky top-0 z-50 bg-paper/85 backdrop-blur-md border-b border-line2">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center gap-6">
        <button onClick={() => scrollToId("top")} className="flex items-center gap-2.5" aria-label="Altoque — inicio">
          <span className="w-9 h-9 rounded-xl bg-pine text-white grid place-items-center"><Icon name="bolt" className="w-5 h-5" /></span>
          <span className="font-disp font-bold text-xl">altoque<span className="text-sun">.</span></span>
        </button>
        <nav className="hidden lg:flex items-center gap-7 ml-6" aria-label="Principal">
          {links.map(([id, label]) => <button key={id} onClick={() => scrollToId(id)} className="text-[0.85rem] font-bold text-mut hover:text-ink">{label}</button>)}
        </nav>
        <div className="ml-auto flex items-center gap-2.5">
          <button onClick={() => openAuth("login")} className="hidden sm:inline-flex font-bold text-mut px-2">Iniciar sesión</button>
          <button onClick={() => pick({ t: "explore" })} className="btn-pine h-10 px-4 text-sm">Pedir un servicio</button>
          <button onClick={() => setMenu(true)} aria-label="Abrir menú" className="lg:hidden w-11 h-11 grid place-items-center rounded-xl border border-line"><span aria-hidden="true" className="grid gap-1"><span className="w-5 h-0.5 bg-current" /><span className="w-5 h-0.5 bg-current" /><span className="w-5 h-0.5 bg-current" /></span></button>
        </div>
      </div>
    </header>

    <main>
      <section id="top" className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden><div className="absolute -top-24 -right-24 w-[28rem] h-[28rem] rounded-full bg-pinesoft/70 blur-3xl" /><div className="absolute top-40 -left-32 w-80 h-80 rounded-full bg-sunsoft/80 blur-3xl" /></div>
        <div className="relative max-w-6xl mx-auto px-5 pt-12 lg:pt-20 pb-14 lg:grid lg:grid-cols-2 lg:gap-14 lg:items-center">
          <div>
            <FadeUp><span className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-xs font-bold"><Icon name="pin" className="w-4 h-4" /> Servicios en Santiago de los Caballeros</span></FadeUp>
            <FadeUp d={90}><h1 className="font-disp font-bold tracking-tight text-[2.6rem] leading-[1.04] sm:text-6xl mt-6">Lo que necesitas,<br /><span className="text-pine">Altoque.</span></h1></FadeUp>
            <FadeUp d={160}><p className="text-lg text-mut font-medium leading-relaxed mt-6 max-w-xl">Encuentra servicios para tu hogar y crea una solicitud para tu zona. Consulta perfiles aprobados y sigue el estado del trabajo desde tu cuenta.</p></FadeUp>
            <form onSubmit={(event) => { event.preventDefault(); pick(landingSearchIntent(query, categories)); }} className="mt-7 flex items-center gap-2 rounded-full bg-card border border-line shadow-lift pl-5 pr-2 h-14 max-w-xl">
              <Icon name="search" className="w-5 h-5 text-pine shrink-0" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Buscar un servicio" placeholder="¿Qué servicio necesitas?" className="flex-1 min-w-0 bg-transparent outline-none font-semibold" />
              <button type="submit" className="btn-pine h-11 px-5 shrink-0">Buscar</button>
            </form>
            <p className="text-sm text-mut mt-5">La disponibilidad y la cobertura se consultan en el directorio.</p>
          </div>
          <FadeUp d={230} className="mt-10 lg:mt-0">
            <div className="card rounded-3xl p-7 shadow-lift border-pine/20">
              <p className="text-xs font-bold text-pine uppercase tracking-wider">Tu servicio, paso a paso</p>
              <h2 className="font-disp font-bold text-2xl mt-3">De la solicitud al trabajo completado</h2>
              <ol className="space-y-5 mt-6">
                {LANDING_STEPS.map((step, index) => <li key={step.title} className="flex gap-4 items-center"><span className={`w-11 h-11 shrink-0 rounded-2xl grid place-items-center ${TINTS[index]}`}><Icon name={step.icon as never} className="w-5 h-5" /></span><span className="font-bold">{step.title}</span></li>)}
              </ol>
              <button onClick={() => pick({ t: "explore" })} className="btn-pine h-12 w-full mt-7">Explorar servicios</button>
            </div>
          </FadeUp>
        </div>
      </section>

      <section id="servicios" className="max-w-6xl mx-auto px-5 pt-16 scroll-mt-20">
        <h2 className="font-disp font-bold text-3xl sm:text-4xl">Servicios para tu día a día</h2>
        <p className="text-mut mt-3">Consulta las categorías del catálogo actual de Altoque.</p>
        <LandingCatalog categories={categories} loading={catalog.loading} error={catalog.error} onRetry={catalog.retry} onPick={pick} />
      </section>

      <section className="max-w-6xl mx-auto px-5 pt-20">
        <h2 className="font-disp font-bold text-3xl sm:text-4xl">Explora profesionales</h2>
        <p className="text-mut mt-3">Perfiles aprobados que figuran disponibles al consultar el directorio. Su disponibilidad puede cambiar.</p>
        <div className="mt-5 max-w-sm">
          <label htmlFor="landing-zone" className="block font-bold text-sm mb-2">Zona de atención</label>
          <select id="landing-zone" value={zone} disabled={zones.loading || !!zones.error} onChange={(event) => setZone(event.target.value)} className="card w-full h-12 px-4 font-semibold">
            <option value="">Todas las zonas</option>
            {(zones.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {zones.loading && <p role="status" className="text-sm text-mut mt-2">Cargando zonas…</p>}
          {zones.error && <p role="alert" className="text-sm text-cor mt-2">No pudimos cargar las zonas. <button onClick={zones.retry} className="underline">Reintentar</button></p>}
        </div>
        <LandingProviders providers={directory.data?.data ?? []} loading={directory.loading} error={directory.error} onRetry={directory.retry} onPick={pick} />
        <button onClick={() => pick({ t: "explore" })} className="btn-ghost h-12 px-6 mt-7">Explorar el directorio</button>
      </section>

      <section id="como-funciona" className="max-w-6xl mx-auto px-5 pt-24 scroll-mt-20">
        <h2 className="font-disp font-bold text-3xl sm:text-4xl">Cómo funciona Altoque</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          {LANDING_STEPS.map((step, index) => <article key={step.title} className="card p-6"><span className="text-pine text-sm font-bold">Paso {index + 1}</span><h3 className="font-disp font-bold text-lg mt-3">{step.title}</h3><p className="text-mut text-sm leading-relaxed mt-3">{step.description}</p></article>)}
        </div>
      </section>

      <section id="proveedores" className="mt-24 bg-night text-ntxt scroll-mt-20 relative overflow-hidden">
        <div className="absolute inset-0 mapgrid-dark opacity-30 pointer-events-none" aria-hidden />
        <div className="relative max-w-6xl mx-auto px-5 py-20 lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
          <div><span className="text-namber text-sm font-bold uppercase">Para profesionales</span><h2 className="font-disp font-bold text-3xl sm:text-4xl mt-4">Ofrece lo que sabes hacer.</h2><p className="text-nmut leading-relaxed mt-5">Registra tus servicios y zonas de atención. Cuando tu perfil esté aprobado, podrás activar tu disponibilidad y consultar solicitudes compatibles.</p><button onClick={goProvider} className="btn-sun h-13 px-7 mt-8">Quiero ofrecer servicios</button></div>
          <div className="ncard rounded-3xl p-7 mt-9 lg:mt-0"><h3 className="font-disp font-bold text-xl">Tu espacio profesional</h3><ul className="space-y-5 mt-6">{[{ icon: "wrench", text: "Servicios y zonas de atención" }, { icon: "shield", text: "Estado de aprobación de tu perfil" }, { icon: "clock", text: "Disponibilidad Online/Offline" }, { icon: "clip", text: "Estado del trabajo asignado" }].map((item) => <li key={item.text} className="flex items-center gap-3"><Icon name={item.icon as never} className="w-5 h-5 text-namber shrink-0" /><span>{item.text}</span></li>)}</ul></div>
        </div>
      </section>
    </main>

    <footer className="border-t border-line bg-paper"><div className="max-w-6xl mx-auto px-5 py-10 flex flex-wrap items-start justify-between gap-6"><div><p className="font-disp font-bold text-xl">altoque<span className="text-sun">.</span></p><p className="text-sm text-mut mt-3">Servicios y profesionales en Santiago de los Caballeros, RD.</p></div><nav aria-label="Cuenta" className="flex flex-wrap gap-5"><button onClick={() => openAuth("login")} className="font-bold text-mut">Iniciar sesión</button><button onClick={() => openAuth("signup")} className="font-bold text-mut">Crear cuenta</button><button onClick={goProvider} className="font-bold text-mut">Ofrecer servicios</button></nav></div><div className="border-t border-line2 px-5 py-5 text-center text-xs text-soft">© 2026 Altoque · Hecho en Santiago, RD</div></footer>

    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-4 pb-[max(0.8rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-paper via-paper/95 to-transparent pt-6"><div className="flex gap-3"><button onClick={goProvider} className="btn-ghost flex-1 h-13 text-sm">Ofrecer servicios</button><button onClick={() => pick({ t: "explore" })} className="btn-pine flex-[1.4] h-13 text-sm">Pedir un servicio</button></div></div>
    <AuthSheet auth={auth} onClose={() => setAuth(null)} />
    <Sheet open={menu} onClose={() => setMenu(false)} title="Menú"><div className="space-y-2">{links.map(([id, label]) => <button key={id} onClick={() => { setMenu(false); scrollToId(id); }} className="w-full h-12 text-left font-bold">{label}</button>)}<button onClick={() => { setMenu(false); openAuth("login"); }} className="btn-ghost w-full h-12">Iniciar sesión</button><button onClick={() => { setMenu(false); openAuth("signup"); }} className="btn-pine w-full h-12">Crear cuenta</button></div></Sheet>
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
