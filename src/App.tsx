import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "./components/icons";
import { ProApp } from "./app/pro/ProApp";
import { Landing } from "./app/landing/Landing";
import { ClientHome, ExploreView, ResultsView } from "./app/client/Home";
import { ProProfile } from "./app/client/Profile";
import { FavoritesTab, MeTab, RequestWizard, RequestsTab, TrackingView } from "./app/client/Flow";
import { takeIntent, useApp, type Tab, type View } from "./app/store";

const TAB_META: { k: Tab; icon: "home" | "search" | "clip" | "heart" | "user"; l: string }[] = [
  { k: "home", icon: "home", l: "Inicio" },
  { k: "explore", icon: "search", l: "Explorar" },
  { k: "jobs", icon: "clip", l: "Solicitudes" },
  { k: "favs", icon: "heart", l: "Favoritos" },
  { k: "me", icon: "user", l: "Perfil" },
];

function ClientApp() {
  const s = useApp();
  const [tab, setTab] = useState<Tab>("home");
  const [stack, setStack] = useState<View[]>(() => {
    const i = takeIntent();
    return i ? [i] : [];
  });

  const go = (v: View) => setStack((st) => [...st, v]);
  const back = () => setStack((st) => st.slice(0, -1));
  const jump = (t: Tab) => { setTab(t); setStack([]); };
  const goSmart = (v: View) => {
    if (v.t === "home" && stack.length > 0) back();
    else go(v);
  };

  useEffect(() => { window.scrollTo({ top: 0 }); }, [tab, stack.length]);

  const top = stack[stack.length - 1];
  const viewKey = stack.map((v) => JSON.stringify(v)).join("|") || tab;
  const activeCount = s.jobs.filter((j) => j.status !== "done" || !j.rating).length;

  let body: ReactNode;
  if (top?.t === "results") body = <ResultsView key={viewKey} catId={top.catId} go={goSmart} />;
  else if (top?.t === "pro") body = <ProProfile key={viewKey} id={top.id} go={goSmart} />;
  else if (top?.t === "request") body = <RequestWizard key={viewKey} catId={top.catId} proId={top.proId} go={goSmart} />;
  else if (top?.t === "track") body = <TrackingView key={viewKey} jobId={top.jobId} go={goSmart} jump={jump} />;
  else if (tab === "explore") body = <ExploreView go={goSmart} />;
  else if (tab === "jobs") body = <RequestsTab go={goSmart} />;
  else if (tab === "favs") body = <FavoritesTab go={goSmart} />;
  else if (tab === "me") body = <MeTab go={goSmart} jump={jump} />;
  else body = <ClientHome go={goSmart} />;

  return (
    <div className="min-h-dvh">
      <div className="pb-24">{body}</div>

      {/* bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-50">
        <div className="mx-auto max-w-md lg:max-w-xl px-4 pb-[max(0.8rem,env(safe-area-inset-bottom))]">
          <div className="rounded-[1.6rem] bg-card/95 backdrop-blur border border-line2 shadow-lift grid grid-cols-5 h-[4.2rem]">
            {TAB_META.map((t) => {
              const active = tab === t.k && stack.length === 0;
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

export default function App() {
  const { role, session } = useApp();

  return (
    <div className="p-root min-h-dvh">
      {!session ? <Landing /> : role === "pro" ? <ProApp /> : <ClientApp />}
      <Toast />
    </div>
  );
}
