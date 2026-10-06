/* ════════════════════════════════════════════════════════════════
   ALTOQUE · Composición raíz
   Enrutamiento (F0): HashRouter — garantiza que cualquier ruta
   funcione al refrescar en CUALQUIER hosting estático. En Vercel
   (F5) se cambia a BrowserRouter (los rewrites ya existen en
   vercel.json); es un cambio de una línea aquí.
   ════════════════════════════════════════════════════════════════ */
import { useEffect, useState, type ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "./components/icons";
import { ToastProvider } from "./components/Toast";
import { AppErrorBoundary, AuthLoadError, NotFoundPage } from "./components/AppStates";
import { setSession, toast, useApp, type Tab, type View } from "./lib/state";
import { authApi } from "./lib/api";
import { loadCurrentSession } from "./lib/session-actions";
import { PATHS, RequireRole, roleHome, tabPath, viewToPath } from "./lib/router";

import { Landing } from "./features/landing/Landing";
import { ProviderOnboarding } from "./features/landing/Provider";
import { PasswordRecovery } from "./features/landing/PasswordRecovery";
import { ClientHome, ExploreView, ResultsView } from "./features/client/Home";
import { ProProfile } from "./features/client/Profile";
import { AddressesPage } from "./features/client/Addresses";
import { SecurityPage } from "./features/client/Security";
import { FavoritesTab, MeTab, RequestWizard, RequestsTab, TrackingView } from "./features/client/Flow";
import { ProApp } from "./features/provider/ProApp";
import { AdminHome } from "./features/admin/AdminHome";

/* ── "/" público: sin sesión → landing · con sesión → home del rol ── */
function PublicHome() {
  const { session } = useApp();
  if (session) return <Navigate to={roleHome(session.role)} replace />;
  return <Landing />;
}

const TAB_META: { k: Tab; icon: "home" | "search" | "clip" | "heart" | "user"; l: string }[] = [
  { k: "home", icon: "home", l: "Inicio" },
  { k: "explore", icon: "search", l: "Explorar" },
  { k: "jobs", icon: "clip", l: "Solicitudes" },
  { k: "favs", icon: "heart", l: "Favoritos" },
  { k: "me", icon: "user", l: "Perfil" },
];

/* ── shell del cliente: la URL manda, la UI solo representa ── */
function ClientShell() {
  const s = useApp();
  const nav = useNavigate();
  const loc = useLocation();

  const go = (v: View) => nav(viewToPath(v));
  const jump = (t: Tab) => nav(tabPath(t));

  useEffect(() => { window.scrollTo({ top: 0 }); }, [loc.pathname, loc.search]);

  const seg = loc.pathname.split("/").filter(Boolean); // ["app", …]
  const sp = new URLSearchParams(loc.search);

  let view: ReactNode;
  let activeTab: Tab | null = null;

  if (loc.pathname === PATHS.app) { activeTab = "home"; view = <ClientHome go={go} />; }
  else if (loc.pathname === `${PATHS.app}/explorar`) { activeTab = "explore"; view = <ExploreView go={go} />; }
  else if (loc.pathname === `${PATHS.app}/solicitudes`) { activeTab = "jobs"; view = <RequestsTab go={go} />; }
  else if (loc.pathname === `${PATHS.app}/favoritos`) { activeTab = "favs"; view = <FavoritesTab go={go} />; }
  else if (loc.pathname === `${PATHS.app}/perfil`) { activeTab = "me"; view = <MeTab go={go} jump={jump} />; }
  else if (loc.pathname === `${PATHS.app}/perfil/direcciones`) { activeTab = "me"; view = <AddressesPage />; }
  else if (loc.pathname === `${PATHS.app}/perfil/seguridad`) { activeTab = "me"; view = <SecurityPage />; }
  else if (seg.length === 3 && seg[1] === "servicios" && seg[2]) view = <ResultsView key={seg[2]} catId={seg[2]} go={go} />;
  else if (seg.length === 3 && seg[1] === "profesional" && seg[2]) view = <ProProfile key={seg[2]} id={seg[2]} go={go} />;
  else if (loc.pathname === `${PATHS.app}/solicitar`)
    view = <RequestWizard key={loc.search} catId={sp.get("cat") ?? undefined} proId={sp.get("pro") ?? undefined} go={go} />;
  else if (seg.length === 3 && seg[1] === "solicitud" && seg[2]) view = <TrackingView key={seg[2]} jobId={seg[2]} go={go} jump={jump} />;
  else view = <NotFoundPage />;

  return (
    <div className="min-h-dvh">
      <div className="pb-24">{view}</div>

      {/* bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-50">
        <div className="mx-auto max-w-md lg:max-w-xl px-4 pb-[max(0.8rem,env(safe-area-inset-bottom))]">
          <div className="rounded-[1.6rem] bg-card/95 backdrop-blur border border-line2 shadow-lift grid grid-cols-5 h-[4.2rem]">
            {TAB_META.map((t) => {
              const active = activeTab === t.k;
              return (
                <button
                  key={t.k}
                  onClick={() => jump(t.k)}
                  className={`relative flex flex-col items-center justify-center gap-1 rounded-[1.2rem] mx-1 my-1.5 transition-all duration-200 ${active ? "bg-pinesoft text-pine" : "text-soft hover:text-mut"}`}
                  aria-label={t.l}
                >
                  <Icon name={t.icon} className={`w-[1.35rem] h-[1.35rem] transition-transform ${active ? "scale-110" : ""}`} strokeWidth={active ? 2.3 : 1.9} />
                  <span className="text-[0.58rem] font-extrabold">{t.l}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}

function Toast() {
  const { toastMsg, toastId } = useApp();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!toastMsg) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 3000);
    return () => clearTimeout(t);
  }, [toastId]);
  if (!show || !toastMsg) return null;
  return (
    <div key={toastId} className="fixed bottom-24 inset-x-0 z-[80] flex justify-center px-5 pointer-events-none">
      <div className="animate-pop bg-ink text-white rounded-full pl-4 pr-5 py-3 text-[0.85rem] font-bold shadow-lift max-w-md text-center flex items-center gap-2.5">
        <span className="w-2 h-2 rounded-full bg-[#4ade80] shrink-0" />
        {toastMsg}
      </div>
    </div>
  );
}

/** Restauración de sesión al abrir/recargar (F1.8).
 *  La fuente es SIEMPRE el servidor (cookie HttpOnly → get-session → /me).
 *  También consume el enlace de verificación (?token=…) cuando llega por correo. */
function useAuthBootstrap() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    setReady(false); setFailed(false);
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const token = params.get("token");
        if (token && params.get("flow") !== "password-reset") {
          // Retirar datos sensibles del URL antes de la petición de verificación.
          params.delete("token");
          const qs = params.toString();
          window.history.replaceState({}, "", `${window.location.pathname}${qs ? "?" + qs : ""}${window.location.hash}`);
          try {
            await authApi.verifyEmail(token);
            toast("Correo verificado — bienvenida 👋");
          } catch {
            toast("El enlace de verificación no es válido o expiró");
          }
        }
        const session = await loadCurrentSession();
        if (!alive) return;
        setSession(session);
      } catch {
        if (alive) setFailed(true);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => { alive = false; };
  }, [version]);
  return { ready, failed, retry: () => setVersion((value) => value + 1) };
}

function AuthSplash() {
  return (
    <div className="min-h-dvh grid place-items-center bg-bg">
      <div className="flex flex-col items-center gap-4 animate-fadein">
        <span className="w-14 h-14 rounded-2xl bg-pine text-white grid place-items-center shadow-lift animate-pulse">
          <Icon name="bolt" className="w-7 h-7" strokeWidth={2} />
        </span>
        <p className="font-disp font-bold text-xl tracking-tight text-ink">altoque<span className="text-sun">.</span></p>
      </div>
    </div>
  );
}

export default function App() {
  const bootstrap = useAuthBootstrap();
  if (!bootstrap.ready) return <AuthSplash />;
  if (bootstrap.failed) return <AuthLoadError onRetry={bootstrap.retry} />;

  return (
    <div className="p-root min-h-dvh">
      <ToastProvider>
        <AppErrorBoundary>
        <HashRouter>
          <Routes>
            {/* público */}
            <Route path="/" element={<PublicHome />} />
            <Route path="/proveedores" element={<ProviderOnboarding />} />
            <Route path="/recuperar-contrasena" element={<PasswordRecovery />} />

            {/* cliente */}
            <Route path="/app/*" element={<RequireRole roles={["customer", "provider", "admin"]}><ClientShell /></RequireRole>} />

            {/* proveedor — el modo pro es una capacidad de UI para cualquier cuenta
                autenticada (modelo de doble capacidad); los PERMISOS reales los
                decide el servidor en F3 (verification_status + RBAC). */}
            <Route path="/pro" element={<RequireRole roles={["customer", "provider", "admin"]}><ProApp /></RequireRole>} />

            {/* admin (F4) */}
            <Route path="/admin" element={<RequireRole roles={["admin"]}><AdminHome /></RequireRole>} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </HashRouter>
      <Toast />
        </AppErrorBoundary>
      </ToastProvider>
    </div>
  );
}
