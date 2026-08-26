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
import { setSession, toast, useApp, type Tab, type View } from "./lib/state";
import { authApi } from "./lib/api";
import { PATHS, RequireRole, roleHome, tabPath, viewToPath } from "./lib/router";

import { Landing } from "./features/landing/Landing";
import { ProviderOnboarding } from "./features/landing/Provider";
import { ClientHome, ExploreView, ResultsView } from "./features/client/Home";
import { ProProfile } from "./features/client/Profile";
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
  else if (seg[1] === "servicios" && seg[2]) view = <ResultsView key={seg[2]} catId={seg[2]} go={go} />;
  else if (seg[1] === "profesional" && seg[2]) view = <ProProfile key={seg[2]} id={seg[2]} go={go} />;
  else if (loc.pathname === `${PATHS.app}/solicitar`)
    view = <RequestWizard key={loc.search} catId={sp.get("cat") ?? undefined} proId={sp.get("pro") ?? undefined} go={go} />;
  else if (seg[1] === "solicitud" && seg[2]) view = <TrackingView key={seg[2]} jobId={seg[2]} go={go} jump={jump} />;
  else view = <Navigate to={PATHS.app} replace />;

  const activeCount = s.jobs.filter((j) => j.status !== "done" || !j.rating).length;

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
                  <span className="relative">
                    <Icon name={t.icon} className={`w-[1.35rem] h-[1.35rem] transition-transform ${active ? "scale-110" : ""}`} strokeWidth={active ? 2.3 : 1.9} />
                    {t.k === "jobs" && activeCount > 0 && (
                      <span className="absolute -top-1 -right-2 min-w-4 h-4 px-0.5 rounded-full bg-sun text-[#33230a] text-[0.55rem] font-extrabold grid place-items-center">
                        {activeCount}
                      </span>
                    )}
                  </span>
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
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const token = params.get("token");
        if (token) {
          try {
            await authApi.verifyEmail(token);
            toast("Correo verificado — bienvenida 👋");
          } catch {
            toast("El enlace de verificación no es válido o expiró");
          }
          params.delete("token");
          const qs = params.toString();
          window.history.replaceState({}, "", `${window.location.pathname}${qs ? "?" + qs : ""}${window.location.hash}`);
        }
        const session = await authApi.getSession();
        if (!alive) return;
        if (session) {
          // /me es la fuente de verdad del perfil privado; si falla, la sesión vale igual.
          try { setSession(await authApi.me()); } catch { setSession(session); }
        }
      } catch {
        /* sin backend o sin cookie → estado público, sin sesión */
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => { alive = false; };
  }, []);
  return ready;
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
  const ready = useAuthBootstrap();
  if (!ready) return <AuthSplash />;

  return (
    <div className="p-root min-h-dvh">
      <HashRouter>
        <Routes>
          {/* público */}
          <Route path="/" element={<PublicHome />} />
          <Route path="/proveedores" element={<ProviderOnboarding />} />

          {/* cliente */}
          <Route path="/app/*" element={<RequireRole roles={["customer"]}><ClientShell /></RequireRole>} />

          {/* proveedor — el modo pro es una capacidad de UI para cualquier cuenta
              autenticada (modelo de doble capacidad); los PERMISOS reales los
              decide el servidor en F3 (verification_status + RBAC). */}
          <Route path="/pro" element={<RequireRole roles={["customer", "provider", "admin"]}><ProApp /></RequireRole>} />

          {/* admin (F4) */}
          <Route path="/admin" element={<RequireRole roles={["admin"]}><AdminHome /></RequireRole>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
      <Toast />
    </div>
  );
}
