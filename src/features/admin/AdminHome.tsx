/* ════════════════════════════════════════════════════════════════
   ALTOQUE · Admin Dashboard (F6)
   Panel administrativo funcional conectado a endpoints reales.
   ════════════════════════════════════════════════════════════════ */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/icons";
import { useToast } from "../../components/Toast";
import { useApp } from "../../lib/state";
import { api } from "../../lib/api";
import { endCurrentSession } from "../../lib/session-actions";
import { PATHS } from "../../lib/router";
import { useApiPolling } from "../../lib/use-api-polling";
import { AdminDataState } from "./AdminDataState";
import { AdminPageView } from "./AdminPagination";
import { useAdminPagination } from "./use-admin-pagination";

type AdminTab = "dashboard" | "users" | "providers" | "requests" | "disputes" | "audit";

const adminSections = [
  { k: "dashboard", ic: "chart", l: "Dashboard", title: "Visión general", description: "Una mirada a la comunidad y a las solicitudes registradas." },
  { k: "users", ic: "user", l: "Usuarios", title: "Usuarios", description: "Consulta las cuentas, su estado y la verificación de correo." },
  { k: "providers", ic: "wrench", l: "Proveedores", title: "Proveedores", description: "Revisa los perfiles y las solicitudes de aprobación profesional." },
  { k: "requests", ic: "clip", l: "Solicitudes", title: "Solicitudes", description: "Sigue el estado de los servicios y las personas involucradas." },
  { k: "disputes", ic: "alert", l: "Disputas", title: "Disputas", description: "Revisa los motivos y registra una resolución para cada caso." },
  { k: "audit", ic: "shield", l: "Auditoría", title: "Auditoría", description: "Consulta las acciones administrativas registradas en el sistema." },
] as const;

export function AdminHome() {
  const nav = useNavigate();
  const { session } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const { data: metrics, loading, error, retry } = useApiPolling(api.admin.getMetrics);
  const section = adminSections.find((item) => item.k === tab)!;

  if (loading) {
    return (
      <div className="admin-console min-h-dvh bg-paper grid place-items-center px-5" role="status" aria-live="polite">
        <div className="card w-full max-w-sm px-6 py-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-night grid place-items-center mx-auto motion-safe:animate-pulse" aria-hidden="true">
            <Icon name="lock" className="w-8 h-8 text-namber" strokeWidth={1.7} />
          </div>
          <p className="font-disp font-bold text-[1.1rem] text-ink mt-5">Cargando panel administrativo…</p>
          <p className="text-sm text-mut mt-2">Estamos preparando la información de Altoque.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-console min-h-dvh bg-paper pb-10 sm:pb-14">
      {/* Header */}
      <header className="bg-card border-b border-line2 sticky top-0 z-40">
        <div className="bg-night">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-wrap items-center gap-x-4 gap-y-3">
          <span className="w-11 h-11 shrink-0 rounded-2xl bg-nsurf text-namber grid place-items-center" aria-hidden="true">
            <Icon name="lock" className="w-5 h-5" strokeWidth={1.9} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="font-disp font-bold text-lg sm:text-xl text-ntxt">Altoque Control</h1>
            <p className="text-[0.72rem] text-nmut font-semibold mt-0.5">Panel Administrativo</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={async () => {
                try { await endCurrentSession(); nav(PATHS.home); }
                catch { toast.showToast("error", "No pudimos cerrar la sesión. Inténtalo nuevamente."); }
              }}
              className="btn-ghost min-h-11 px-4 text-[0.8rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-namber"
            >
              <Icon name="logout" className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
              Salir
            </button>
          </div>
          <p className="w-full sm:w-auto text-[0.76rem] text-nmut font-semibold break-words sm:order-2 sm:ml-auto">
            {session?.name} <span aria-hidden="true">·</span> <span className="text-namber">{session?.role}</span>
          </p>
        </div>
        </div>

        {/* Tabs */}
        <nav aria-label="Secciones de administración" className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex gap-1.5 overflow-x-auto">
          {adminSections.map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => setTab(t.k)}
              aria-pressed={tab === t.k}
              aria-controls="admin-content"
              className={`flex shrink-0 items-center gap-2 min-h-11 px-3.5 sm:px-4 py-2.5 rounded-xl text-[0.8rem] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine ${
                tab === t.k ? "bg-pinesoft text-pine" : "text-mut hover:bg-tint hover:text-ink"
              }`}
            >
              <Icon name={t.ic as never} className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
              {t.l}
            </button>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main id="admin-content" aria-labelledby="admin-section-title" className="max-w-7xl mx-auto px-4 sm:px-6 mt-6 sm:mt-8">
        <div className="mb-6 sm:mb-8 max-w-2xl">
          <p className="text-[0.68rem] uppercase tracking-[0.16em] font-extrabold text-pine">Administración</p>
          <h2 id="admin-section-title" className="font-disp text-2xl sm:text-3xl font-bold text-ink mt-2">{section.title}</h2>
          <p className="text-sm text-mut leading-relaxed mt-2">{section.description}</p>
        </div>
        {tab === "dashboard" && (error || !metrics ? <AdminDataState loading={loading} error={error} empty={!metrics} label="métricas" onRetry={retry} /> : <DashboardView metrics={metrics} />)}
        {tab === "users" && <UsersView />}
        {tab === "providers" && <ProvidersView />}
        {tab === "requests" && <RequestsView />}
        {tab === "disputes" && <DisputesView />}
        {tab === "audit" && <AuditView />}
      </main>
    </div>
  );
}

function DashboardView({ metrics }: { metrics: any }) {
  return (
    <div className="space-y-7 sm:space-y-9">
      <section aria-labelledby="admin-community-heading">
      <h3 id="admin-community-heading" className="font-disp font-bold text-base text-ink mb-3">Comunidad</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Usuarios" value={metrics.users} icon="user" color="pine" />
        <StatCard label="Proveedores" value={metrics.providers} icon="wrench" color="pine" />
        <StatCard label="Verificados" value={metrics.providersVerified} icon="check" color="ok" />
        <StatCard label="Pendientes" value={metrics.pendingProviders} icon="clock" color="sun" />
      </div>
      </section>

      <section aria-labelledby="admin-requests-heading">
      <h3 id="admin-requests-heading" className="font-disp font-bold text-base text-ink mb-3">Solicitudes y seguimiento</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Solicitudes Total" value={metrics.requestsTotal} icon="clip" color="pine" />
        <StatCard label="Activas" value={metrics.requestsActive} icon="bolt" color="sun" />
        <StatCard label="Completadas" value={metrics.requestsCompleted} icon="check" color="ok" />
        <StatCard label="Disputas Abiertas" value={metrics.openDisputes} icon="alert" color="cor" />
      </div>
      </section>

      <section className="card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5" aria-labelledby="admin-rating-heading">
        <div>
          <h3 id="admin-rating-heading" className="font-disp font-bold text-lg text-ink">Calificación Promedio</h3>
          <p className="text-sm text-mut mt-1">Valoraciones registradas por los clientes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-4xl font-disp font-bold text-pine">{metrics.avgRating.toFixed(1)}<span className="text-base text-mut font-semibold ml-1.5">/ 5</span></p>
          <div className="flex gap-1" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((i) => (
              <Icon
                key={i}
                name="star"
                className={`w-6 h-6 ${i <= Math.round(metrics.avgRating) ? "text-sun" : "text-line"}`}
                fill={i <= Math.round(metrics.avgRating) ? "currentColor" : "none"}
                strokeWidth={0}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function UsersView() {
  const list = useAdminPagination(api.admin.getUsers);
  const users = list.data;

  return (
    <AdminPageView {...list} rowCount={users.length} label="usuarios" onPage={list.goToPage} onRetry={list.retry}>
    <div className="card overflow-hidden">
      <div role="region" aria-label="Tabla de usuarios" tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-pine">
      <table className="w-full min-w-[680px]">
        <caption className="sr-only">Usuarios: nombre, email, rol, estado y verificación del correo</caption>
        <thead className="bg-tint/70 border-b border-line2">
          <tr>
            <th scope="col" className="px-5 py-4 text-left text-[0.68rem] font-extrabold text-mut uppercase tracking-wide">Nombre</th>
            <th scope="col" className="px-5 py-4 text-left text-[0.68rem] font-extrabold text-mut uppercase tracking-wide">Email</th>
            <th scope="col" className="px-5 py-4 text-left text-[0.68rem] font-extrabold text-mut uppercase tracking-wide">Rol</th>
            <th scope="col" className="px-5 py-4 text-left text-[0.68rem] font-extrabold text-mut uppercase tracking-wide">Estado</th>
            <th scope="col" className="px-5 py-4 text-left text-[0.68rem] font-extrabold text-mut uppercase tracking-wide">Verificado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line2">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-tint/40 transition-colors">
              <td className="px-5 py-4 text-[0.88rem] font-semibold text-ink max-w-60 break-words">{u.name}</td>
              <td className="px-5 py-4 text-[0.82rem] text-mut max-w-72 break-all">{u.email}</td>
              <td className="px-5 py-4">
                <span className={`text-[0.72rem] font-bold px-2 py-1 rounded-full ${
                  u.role === "admin" ? "bg-night text-namber" :
                  u.role === "provider" ? "bg-pinesoft text-pine" :
                  "bg-tint text-mut"
                }`}>
                  {u.role}
                </span>
              </td>
              <td className="px-5 py-4">
                <span className={`text-[0.72rem] font-bold ${
                  u.status === "active" ? "text-ok" :
                  u.status === "suspended" ? "text-sun2" : "text-cor"
                }`}>
                  {u.status}
                </span>
              </td>
              <td className="px-5 py-4">
                {u.emailVerified ? (
                  <span className="inline-flex items-center gap-1.5 text-[0.74rem] font-semibold text-ok"><Icon name="check" className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />Sí</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[0.74rem] font-semibold text-mut"><Icon name="clock" className="w-4 h-4" strokeWidth={2} aria-hidden="true" />Pendiente</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <p className="px-5 py-3 text-[0.72rem] text-mut border-t border-line2">En pantallas pequeñas puedes desplazar la tabla horizontalmente.</p>
    </div>
    </AdminPageView>
  );
}

function ProvidersView() {
  const list = useAdminPagination(api.admin.getProviders);
  const providers = list.data;
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const handleApprove = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.admin.approveProvider(id);
      list.retry();
      toast.showToast("success", "Proveedor aprobado correctamente");
    } catch (err) {
      toast.showToast("error", "Error al aprobar el proveedor");
    } finally { setBusy(false); }
  };

  const handleReject = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.admin.rejectProvider(id, "Rechazado por administrador");
      list.retry();
      toast.showToast("success", "Proveedor rechazado correctamente");
    } catch (err) {
      toast.showToast("error", "Error al rechazar el proveedor");
    } finally { setBusy(false); }
  };

  return (
    <AdminPageView {...list} rowCount={providers.length} label="proveedores" disabled={busy} onPage={list.goToPage} onRetry={list.retry}>
    <div className="space-y-4" aria-busy={busy}>
      {busy && <p role="status" className="text-sm text-pine font-semibold">Guardando la revisión del proveedor…</p>}
      {providers.map((p) => (
        <article key={p.id} className="card p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <span className="w-11 h-11 shrink-0 rounded-2xl bg-pinesoft text-pine grid place-items-center" aria-hidden="true"><Icon name="wrench" className="w-5 h-5" strokeWidth={1.8} /></span>
            <div className="flex-1 min-w-0">
              <h3 className="font-disp font-bold text-[1rem] text-ink break-words">{p.user?.name || "Proveedor"}</h3>
              <p className="text-[0.78rem] text-mut font-semibold mt-0.5 break-words">{p.business_name || "Sin nombre comercial"}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3">
                <span className={`text-[0.68rem] font-bold px-2 py-1 rounded-full ${
                  p.verification_status === "verified" ? "bg-oksoft text-ok" :
                  p.verification_status === "pending_verification" ? "bg-sunsoft text-sun2" :
                  p.verification_status === "rejected" ? "bg-corsoft text-cor" :
                  "bg-tint text-mut"
                }`}>
                  {p.verification_status}
                </span>
                <span className="text-[0.72rem] text-mut">{p.provider_service?.length || 0} servicios</span>
                <span className="text-[0.72rem] text-mut">{p.provider_zone?.length || 0} zonas</span>
              </div>
            </div>
            {p.verification_status === "pending_verification" && (
              <div className="flex gap-2 sm:shrink-0">
                <button type="button" disabled={busy} onClick={() => handleApprove(p.id)} className="btn-pine h-11 px-4 flex-1 sm:flex-none text-[0.78rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine">
                  Aprobar
                </button>
                <button type="button" disabled={busy} onClick={() => handleReject(p.id)} className="btn-ghost h-11 px-4 flex-1 sm:flex-none text-[0.78rem] text-cor border-cor/30 disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cor">
                  Rechazar
                </button>
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
    </AdminPageView>
  );
}

function RequestsView() {
  const list = useAdminPagination(api.admin.getRequests);
  const requests = list.data;

  return (
    <AdminPageView {...list} rowCount={requests.length} label="solicitudes" onPage={list.goToPage} onRetry={list.retry}>
    <div className="space-y-4">
      {requests.map((r) => (
        <article key={r.id} className="card p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="w-11 h-11 shrink-0 rounded-2xl bg-tint text-pine grid place-items-center" aria-hidden="true"><Icon name="clip" className="w-5 h-5" strokeWidth={1.8} /></span>
            <div className="flex-1 min-w-0">
              <h3 className="font-disp font-bold text-[1rem] text-ink break-words">{r.code}</h3>
              <p className="text-[0.78rem] text-mut font-semibold mt-0.5 break-words">{r.category?.name} · {r.zone?.name}</p>
              <p className="text-[0.85rem] text-mut leading-relaxed whitespace-pre-wrap break-words mt-3">{r.description}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-4">
                <span className={`text-[0.68rem] font-bold px-2 py-1 rounded-full ${
                  r.status === "completed" || r.status === "reviewed" ? "bg-oksoft text-ok" :
                  r.status === "cancelled" ? "bg-corsoft text-cor" :
                  r.status === "searching" ? "bg-sunsoft text-sun2" :
                  "bg-tint text-mut"
                }`}>
                  {r.status}
                </span>
                <span className="text-[0.72rem] text-mut max-w-full break-words">Cliente: {r.customer?.name}</span>
                {r.provider?.user && <span className="text-[0.72rem] text-mut max-w-full break-words">· Pro: {r.provider.user.name}</span>}
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
    </AdminPageView>
  );
}

function DisputesView() {
  const list = useAdminPagination(api.admin.getDisputes);
  const disputes = list.data;
  const [resolveModal, setResolveModal] = useState<any>(null);
  const toast = useToast();

  const handleResolve = async (disputeId: string, status: "resolved_customer" | "resolved_provider", resolution: string) => {
    try {
      await api.admin.resolveDispute(disputeId, status, resolution);
      toast.showToast("success", "Disputa resuelta correctamente");
      setResolveModal(null);
      list.retry();
    } catch (err) {
      toast.showToast("error", "Error al resolver la disputa");
      throw err;
    }
  };

  return (
    <>
    <AdminPageView {...list} rowCount={disputes.length} label="disputas" onPage={list.goToPage} onRetry={list.retry}>
    <div className="space-y-4">
      {disputes.map((d) => (
          <article key={d.id} className="card p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <span className="w-11 h-11 shrink-0 rounded-2xl bg-sunsoft text-sun2 grid place-items-center" aria-hidden="true"><Icon name="alert" className="w-5 h-5" strokeWidth={1.8} /></span>
              <div className="flex-1 min-w-0">
                <h3 className="font-disp font-bold text-[1rem] text-ink">Disputa #{d.id.slice(0, 8)}</h3>
                <p className="text-[0.78rem] text-mut font-semibold mt-0.5">Solicitud: {d.request?.code}</p>
                <p className="text-[0.85rem] text-mut leading-relaxed whitespace-pre-wrap break-words mt-3">{d.reason}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-4">
                  <span className={`text-[0.68rem] font-bold px-2 py-1 rounded-full ${
                    d.status === "open" ? "bg-sunsoft text-sun2" :
                    d.status === "resolved_customer" ? "bg-oksoft text-ok" :
                    d.status === "resolved_provider" ? "bg-pinesoft text-pine" :
                    "bg-tint text-mut"
                  }`}>
                    {d.status === "open" ? "Abierta" :
                     d.status === "resolved_customer" ? "Resuelta (cliente)" :
                     d.status === "resolved_provider" ? "Resuelta (proveedor)" :
                     "Descartada"}
                  </span>
                  <span className="text-[0.72rem] text-mut max-w-full break-words">Abierta por: {d.opener?.name || "Usuario"}</span>
                </div>
                {d.resolution && (
                  <div className="mt-3 p-3 bg-tint rounded-xl">
                    <p className="text-[0.72rem] font-bold text-mut uppercase tracking-wide mb-1">Resolución</p>
                    <p className="text-[0.82rem] text-ink font-medium whitespace-pre-wrap break-words">{d.resolution}</p>
                    {d.resolver && (
                      <p className="text-[0.68rem] text-mut font-semibold mt-1">
                        Resuelto por: {d.resolver.name}
                      </p>
                    )}
                  </div>
                )}
              </div>
              {d.status === "open" && (
                <div className="flex gap-2 sm:shrink-0">
                  <button 
                    type="button"
                    onClick={() => setResolveModal(d)}
                    className="btn-pine h-11 px-4 flex-1 sm:flex-none text-[0.78rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine"
                  >
                    Resolver
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
    </div>
    </AdminPageView>

      {/* Modal de resolución de disputa */}
      {resolveModal && (
        <ResolveDisputeModal
          dispute={resolveModal}
          onClose={() => setResolveModal(null)}
          onResolve={handleResolve}
        />
      )}
    </>
  );
}

function ResolveDisputeModal({ dispute, onClose, onResolve }: { dispute: any; onClose: () => void; onResolve: (id: string, status: "resolved_customer" | "resolved_provider", resolution: string) => Promise<void> }) {
  const dialog = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"resolved_customer" | "resolved_provider">("resolved_customer");
  const [resolution, setResolution] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);

  useEffect(() => { if (loading) dialog.current?.focus(); }, [loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resolution.trim().length < 10) {
      setError("La resolución debe tener al menos 10 caracteres");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onResolve(dispute.id, status, resolution.trim());
    } catch (err) {
      setError("Error al resolver la disputa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm motion-safe:animate-fadein">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-dispute-title"
        aria-describedby="admin-dispute-reference"
        tabIndex={-1}
        className="bg-card rounded-3xl shadow-lift max-w-lg w-full max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-7 motion-safe:animate-pop"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !loading) { event.preventDefault(); onClose(); }
          if (event.key !== "Tab") return;
          const controls = dialog.current?.querySelectorAll<HTMLElement>("button:not([disabled]), textarea:not([disabled]), [tabindex='0']");
          if (!controls?.length) { event.preventDefault(); dialog.current?.focus(); return; }
          const first = controls[0]; const last = controls[controls.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 id="admin-dispute-title" className="font-disp font-bold text-[1.3rem] text-ink">Resolver disputa</h2>
            <p id="admin-dispute-reference" className="text-[0.82rem] text-mut font-medium mt-1">
              Disputa #{dispute.id.slice(0, 8)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-11 h-11 shrink-0 grid place-items-center rounded-full bg-tint text-mut hover:bg-line transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine"
            aria-label="Cerrar"
          >
            <Icon name="x" className="w-4 h-4" strokeWidth={2.4} />
          </button>
        </div>

        <div className="card p-4 mb-4 bg-tint/50">
          <p className="text-[0.72rem] font-bold text-mut uppercase tracking-wide mb-1">Motivo original</p>
          <p className="text-[0.85rem] text-ink font-medium leading-relaxed whitespace-pre-wrap break-words">{dispute.reason}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-dispute-resolution" className="block text-[0.78rem] font-bold text-ink mb-2">
              Resolución *
            </label>
            <textarea
              id="admin-dispute-resolution"
              aria-describedby="admin-dispute-resolution-hint"
              aria-invalid={error && resolution.trim().length < 10 ? true : undefined}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              disabled={loading}
              placeholder="Describe la resolución de la disputa..."
              rows={4}
              className="w-full card p-3 text-[0.88rem] font-medium text-ink placeholder:text-soft outline-none focus:border-pine/50 resize-none transition-colors disabled:opacity-50"
              minLength={10}
              maxLength={2000}
              required
            />
            <p id="admin-dispute-resolution-hint" className="text-[0.72rem] text-soft font-semibold mt-1.5">
              {resolution.length}/2000 caracteres (mínimo 10)
            </p>
          </div>

          <fieldset disabled={loading}>
            <legend className="block text-[0.78rem] font-bold text-ink mb-2">
              ¿A quién favorece la resolución? *
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatus("resolved_customer")}
                disabled={loading}
                aria-pressed={status === "resolved_customer"}
                className={`h-12 rounded-xl font-bold text-[0.85rem] transition-all ${
                  status === "resolved_customer"
                    ? "bg-oksoft text-ok border-2 border-ok"
                    : "bg-tint text-mut border-2 border-transparent hover:border-line"
                }`}
              >
                Cliente
              </button>
              <button
                type="button"
                onClick={() => setStatus("resolved_provider")}
                disabled={loading}
                aria-pressed={status === "resolved_provider"}
                className={`h-12 rounded-xl font-bold text-[0.85rem] transition-all ${
                  status === "resolved_provider"
                    ? "bg-pinesoft text-pine border-2 border-pine"
                    : "bg-tint text-mut border-2 border-transparent hover:border-line"
                }`}
              >
                Proveedor
              </button>
            </div>
          </fieldset>

          {error && (
            <div role="alert" className="rounded-xl bg-corsoft text-cor px-4 py-3 text-[0.82rem] font-bold flex items-start gap-2.5">
              <Icon name="alert" className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2.2} />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-ghost flex-1 h-12 text-[0.88rem]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || resolution.trim().length < 10}
              className="btn-pine flex-1 h-12 text-[0.88rem] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Resolviendo...
                </>
              ) : (
                <>
                  <Icon name="check" className="w-4 h-4" strokeWidth={2.4} />
                  Resolver disputa
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AuditView() {
  const list = useAdminPagination(api.admin.getAuditLogs);
  const logs = list.data;

  return (
    <AdminPageView {...list} rowCount={logs.length} label="registros de auditoría" onPage={list.goToPage} onRetry={list.retry}>
    <div className="card overflow-hidden">
      <div role="region" aria-label="Tabla de auditoría" tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-pine">
      <table className="w-full min-w-[640px]">
        <caption className="sr-only">Auditoría: fecha, actor, acción y entidad</caption>
        <thead className="bg-tint/70 border-b border-line2">
          <tr>
            <th scope="col" className="px-5 py-4 text-left text-[0.68rem] font-extrabold text-mut uppercase tracking-wide">Fecha</th>
            <th scope="col" className="px-5 py-4 text-left text-[0.68rem] font-extrabold text-mut uppercase tracking-wide">Actor</th>
            <th scope="col" className="px-5 py-4 text-left text-[0.68rem] font-extrabold text-mut uppercase tracking-wide">Acción</th>
            <th scope="col" className="px-5 py-4 text-left text-[0.68rem] font-extrabold text-mut uppercase tracking-wide">Entidad</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line2">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-tint/40 transition-colors">
              <td className="px-5 py-4 text-[0.78rem] text-mut whitespace-nowrap tabular-nums">{new Date(log.at).toLocaleString()}</td>
              <td className="px-5 py-4 text-[0.82rem] font-semibold text-ink max-w-56 break-words">{log.actor?.name || "Sistema"}</td>
              <td className="px-5 py-4">
                <span className="inline-block text-[0.72rem] font-bold px-2.5 py-1.5 rounded-lg bg-tint text-mut break-words max-w-72">
                  {log.action}
                </span>
              </td>
              <td className="px-5 py-4 text-[0.78rem] text-mut break-words">{log.entity_type} #{log.entity_id?.slice(0, 8)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <p className="px-5 py-3 text-[0.72rem] text-mut border-t border-line2">En pantallas pequeñas puedes desplazar la tabla horizontalmente.</p>
    </div>
    </AdminPageView>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  const colorClasses = {
    pine: "bg-pinesoft text-pine",
    ok: "bg-oksoft text-ok",
    sun: "bg-sunsoft text-sun2",
    cor: "bg-corsoft text-cor",
  }[color] || "bg-tint text-mut";

  return (
    <article className="card p-4 sm:p-5 min-w-0">
      <div className="flex flex-col-reverse sm:flex-row sm:items-start sm:justify-between gap-3">
        <dl className="min-w-0">
          <dt className="text-[0.66rem] sm:text-[0.72rem] font-bold text-mut uppercase tracking-wide leading-relaxed">{label}</dt>
          <dd className="font-disp font-bold text-2xl sm:text-3xl text-ink mt-2 tabular-nums break-words">{value.toLocaleString()}</dd>
        </dl>
        <span className={`w-10 h-10 shrink-0 rounded-xl grid place-items-center ${colorClasses}`} aria-hidden="true">
          <Icon name={icon as never} className="w-5 h-5" strokeWidth={1.9} />
        </span>
      </div>
    </article>
  );
}
