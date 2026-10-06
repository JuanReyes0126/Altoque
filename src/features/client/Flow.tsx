import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/icons";
import { useToast } from "../../components/Toast";
import { setRole, useApp, type Tab, type View } from "../../lib/state";
import { endCurrentSession } from "../../lib/session-actions";
import { PATHS } from "../../lib/router";
import { EmptyState, PageIntro } from "../../components/ui/feedback";

export { RequestWizard } from "./RequestWizard";

export { TrackingView, RequestsTab } from "./Requests";

/* Favoritos persistentes: todavía no hay un endpoint conectado. */
export function FavoritesTab({ go }: { go: (v: View) => void }) {
  return <main className="max-w-2xl mx-auto px-5 py-6 sm:py-8"><PageIntro eyebrow="Tu espacio" title="Favoritos" description="Un lugar para volver a los servicios que te interesan." />
    <EmptyState icon="heart" title="Tus favoritos, próximamente" description="Los favoritos persistentes estarán disponibles en una próxima versión." action={<button onClick={() => go({ t: "explore" })} className="btn-pine min-h-12 px-5">Explorar profesionales</button>} />
  </main>;
}

/* ════════════════ PERFIL (tab) ════════════════ */
export function MeTab({ go, jump }: { go: (v: View) => void; jump: (t: Tab) => void }) {
  const s = useApp();
  const nav = useNavigate();
  const myName = s.session?.name ?? "Tu cuenta";
  const toast = useToast();
  const [logoutBusy, setLogoutBusy] = useState(false);
  return (
    <main className="max-w-2xl mx-auto px-5 py-6 sm:py-8 animate-fadein">
      <PageIntro eyebrow="Tu espacio personal" title="Mi perfil" description="Gestiona tu cuenta, tus direcciones y tus accesos." />
      <section className="card p-6 mt-5 flex items-center gap-4">
        <span className="w-16 h-16 rounded-2xl bg-pinesoft text-pine grid place-items-center text-xl font-bold" aria-hidden>{myName.charAt(0)}</span>
        <div className="min-w-0">
          <p className="font-disp font-bold text-[1.15rem] text-ink">{myName}</p>
          <p className="text-[0.78rem] text-mut font-semibold mt-0.5 break-words">{s.session?.email}</p>
          <p className="text-[0.7rem] text-pine font-bold mt-2 flex items-center gap-1"><Icon name={s.session?.emailVerified ? "shield" : "user"} className="w-3.5 h-3.5" />{s.session?.emailVerified ? "Correo verificado" : "Tu cuenta Altoque"}</p>
        </div>
      </section>

      <section className="card mt-4 divide-y divide-line2">
        {[
          { ic: "pin", l: "Mis direcciones", sub: "Lugares guardados para tus solicitudes", fn: () => nav("/app/perfil/direcciones") },
          { ic: "clip", l: "Historial de servicios", sub: "Consulta tus solicitudes y valoraciones", fn: () => jump("jobs") },
          { ic: "heart", l: "Favoritos", sub: "Consulta el estado de esta función", fn: () => jump("favs") },
          { ic: "shield", l: "Seguridad y privacidad", sub: "Contraseña y sesiones de tu cuenta", fn: () => nav("/app/perfil/seguridad") },
        ].map((r) => (
          <button key={r.l} onClick={r.fn} className="w-full flex items-center gap-3.5 px-5 py-4 text-left hover:bg-tint/50 transition-colors">
            <span className="w-9 h-9 rounded-xl bg-tint text-mut grid place-items-center shrink-0"><Icon name={r.ic as never} className="w-4.5 h-4.5" strokeWidth={2} /></span>
            <span className="flex-1 min-w-0"><span className="block text-[0.88rem] font-bold text-ink">{r.l}</span><span className="block text-xs text-mut mt-1">{r.sub}</span></span>
            <Icon name="chevr" className="w-4 h-4 text-soft" strokeWidth={2.4} />
          </button>
        ))}
      </section>

      <button onClick={() => { setRole("provider"); nav(PATHS.pro); }} className="w-full card card-h mt-4 p-5 flex items-center gap-4 text-left border-pine/30">
        <span className="w-11 h-11 rounded-xl bg-pine text-white grid place-items-center shrink-0"><Icon name="wrench" className="w-5.5 h-5.5" strokeWidth={1.8} /></span>
        <span className="flex-1">
          <span className="block font-disp font-bold text-[0.95rem] text-ink">¿Eres profesional?</span>
          <span className="block text-[0.74rem] text-mut font-semibold mt-1">Gestiona tus servicios, zonas y disponibilidad</span>
        </span>
        <Icon name="arrow" className="w-4.5 h-4.5 text-pine shrink-0" strokeWidth={2.2} />
      </button>

      {s.session?.role === "admin" && <button onClick={() => nav(PATHS.admin)} className="w-full card card-h mt-4 p-5 flex items-center gap-4 text-left"><span className="ui-icon-tile"><Icon name="shield" /></span><span className="flex-1 font-bold">Ir al panel administrativo</span><Icon name="arrow" className="w-4 h-4 text-pine" /></button>}

      <button
        onClick={async () => {
          if (logoutBusy) return;
          setLogoutBusy(true);
          try { await endCurrentSession(); nav(PATHS.home); }
          catch { toast.showToast("error", "No pudimos cerrar la sesión. Inténtalo nuevamente."); }
          finally { setLogoutBusy(false); }
        }}
        disabled={logoutBusy}
        className="w-full card card-h mt-4 p-5 flex items-center gap-4 text-left border-cor/30 disabled:opacity-50"
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
    </main>
  );
}
