/* ════════════════════════════════════════════════════════════════
   ALTOQUE · Admin Dashboard (F6)
   Panel administrativo funcional conectado a endpoints reales.
   ════════════════════════════════════════════════════════════════ */
import { useState } from "react";
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

export function AdminHome() {
  const nav = useNavigate();
  const { session } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const { data: metrics, loading, error, retry } = useApiPolling(api.admin.getMetrics);

  if (loading) {
    return (
      <div className="min-h-dvh bg-paper grid place-items-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-pinesoft grid place-items-center mx-auto animate-pulse">
            <Icon name="lock" className="w-8 h-8 text-pine" strokeWidth={1.7} />
          </div>
          <p className="font-disp font-bold text-[1.1rem] text-ink mt-5">Cargando panel administrativo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-paper pb-10">
      {/* Header */}
      <header className="bg-card border-b border-line2 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center gap-4">
          <span className="w-10 h-10 rounded-xl bg-night text-namber grid place-items-center">
            <Icon name="lock" className="w-5 h-5" strokeWidth={1.9} />
          </span>
          <div className="flex-1">
            <h1 className="font-disp font-bold text-xl text-ink">Altoque Control</h1>
            <p className="text-[0.72rem] text-mut font-semibold">Panel Administrativo</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[0.78rem] text-mut font-semibold">
              {session?.name} · <span className="text-pine font-bold">{session?.role}</span>
            </span>
            <button
              onClick={async () => {
                try { await endCurrentSession(); nav(PATHS.home); }
                catch { toast.showToast("error", "No pudimos cerrar la sesión. Inténtalo nuevamente."); }
              }}
              className="btn-ghost h-9 px-4 text-[0.8rem]"
            >
              Salir
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-5 flex gap-1 overflow-x-auto no-scrollbar">
          {([
            { k: "dashboard", ic: "chart", l: "Dashboard" },
            { k: "users", ic: "user", l: "Usuarios" },
            { k: "providers", ic: "wrench", l: "Proveedores" },
            { k: "requests", ic: "clip", l: "Solicitudes" },
            { k: "disputes", ic: "alert", l: "Disputas" },
            { k: "audit", ic: "shield", l: "Auditoría" },
          ] as const).map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`flex items-center gap-2 px-4 py-3 text-[0.82rem] font-bold border-b-2 transition-colors ${
                tab === t.k ? "border-pine text-pine" : "border-transparent text-mut hover:text-ink"
              }`}
            >
              <Icon name={t.ic as never} className="w-4 h-4" strokeWidth={2} />
              {t.l}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-5 mt-6">
        {tab === "dashboard" && (error || !metrics ? <AdminDataState loading={loading} error={error} empty={!metrics} label="métricas" onRetry={retry} /> : <DashboardView metrics={metrics} />)}
        {tab === "users" && <UsersView />}
        {tab === "providers" && <ProvidersView />}
        {tab === "requests" && <RequestsView />}
        {tab === "disputes" && <DisputesView />}
        {tab === "audit" && <AuditView />}
      </div>
    </div>
  );
}

function DashboardView({ metrics }: { metrics: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Usuarios" value={metrics.users} icon="user" color="pine" />
        <StatCard label="Proveedores" value={metrics.providers} icon="wrench" color="pine" />
        <StatCard label="Verificados" value={metrics.providersVerified} icon="check" color="ok" />
        <StatCard label="Pendientes" value={metrics.pendingProviders} icon="clock" color="sun" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Solicitudes Total" value={metrics.requestsTotal} icon="clip" color="pine" />
        <StatCard label="Activas" value={metrics.requestsActive} icon="bolt" color="sun" />
        <StatCard label="Completadas" value={metrics.requestsCompleted} icon="check" color="ok" />
        <StatCard label="Disputas Abiertas" value={metrics.openDisputes} icon="alert" color="cor" />
      </div>

      <div className="card p-6">
        <h3 className="font-disp font-bold text-lg text-ink mb-4">Calificación Promedio</h3>
        <div className="flex items-center gap-3">
          <span className="text-4xl font-disp font-bold text-pine">{metrics.avgRating.toFixed(1)}</span>
          <div className="flex gap-0.5">
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
      </div>
    </div>
  );
}

function UsersView() {
  const list = useAdminPagination(api.admin.getUsers);
  const users = list.data;

  return (
    <AdminPageView {...list} rowCount={users.length} label="usuarios" onPage={list.goToPage} onRetry={list.retry}>
    <div className="card overflow-x-auto">
      <table className="w-full">
        <thead className="bg-tint border-b border-line2">
          <tr>
            <th className="px-4 py-3 text-left text-[0.72rem] font-bold text-mut uppercase">Nombre</th>
            <th className="px-4 py-3 text-left text-[0.72rem] font-bold text-mut uppercase">Email</th>
            <th className="px-4 py-3 text-left text-[0.72rem] font-bold text-mut uppercase">Rol</th>
            <th className="px-4 py-3 text-left text-[0.72rem] font-bold text-mut uppercase">Estado</th>
            <th className="px-4 py-3 text-left text-[0.72rem] font-bold text-mut uppercase">Verificado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line2">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-tint/50">
              <td className="px-4 py-3 text-[0.88rem] font-semibold text-ink">{u.name}</td>
              <td className="px-4 py-3 text-[0.82rem] text-mut">{u.email}</td>
              <td className="px-4 py-3">
                <span className={`text-[0.72rem] font-bold px-2 py-1 rounded-full ${
                  u.role === "admin" ? "bg-night text-namber" :
                  u.role === "provider" ? "bg-pinesoft text-pine" :
                  "bg-tint text-mut"
                }`}>
                  {u.role}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={`text-[0.72rem] font-bold ${
                  u.status === "active" ? "text-ok" :
                  u.status === "suspended" ? "text-sun" : "text-cor"
                }`}>
                  {u.status}
                </span>
              </td>
              <td className="px-4 py-3">
                {u.emailVerified ? (
                  <Icon name="check" className="w-4 h-4 text-ok" strokeWidth={2.5} />
                ) : (
                  <Icon name="x" className="w-4 h-4 text-cor" strokeWidth={2.5} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
    <div className="space-y-3">
      {providers.map((p) => (
        <div key={p.id} className="card p-5">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <p className="font-disp font-bold text-[1rem] text-ink">{p.user?.name || "Proveedor"}</p>
              <p className="text-[0.78rem] text-mut font-semibold mt-0.5">{p.business_name || "Sin nombre comercial"}</p>
              <div className="flex items-center gap-2 mt-2">
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
              <div className="flex gap-2">
                <button disabled={busy} onClick={() => handleApprove(p.id)} className="btn-pine h-9 px-4 text-[0.78rem]">
                  Aprobar
                </button>
                <button disabled={busy} onClick={() => handleReject(p.id)} className="btn-ghost h-9 px-4 text-[0.78rem] text-cor border-cor/30">
                  Rechazar
                </button>
              </div>
            )}
          </div>
        </div>
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
    <div className="space-y-3">
      {requests.map((r) => (
        <div key={r.id} className="card p-5">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <p className="font-disp font-bold text-[1rem] text-ink">{r.code}</p>
              <p className="text-[0.78rem] text-mut font-semibold mt-0.5">{r.category?.name} · {r.zone?.name}</p>
              <p className="text-[0.82rem] text-mut mt-2">{r.description}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-[0.68rem] font-bold px-2 py-1 rounded-full ${
                  r.status === "completed" || r.status === "reviewed" ? "bg-oksoft text-ok" :
                  r.status === "cancelled" ? "bg-corsoft text-cor" :
                  r.status === "searching" ? "bg-sunsoft text-sun2" :
                  "bg-tint text-mut"
                }`}>
                  {r.status}
                </span>
                <span className="text-[0.72rem] text-mut">Cliente: {r.customer?.name}</span>
                {r.provider?.user && <span className="text-[0.72rem] text-mut">· Pro: {r.provider.user.name}</span>}
              </div>
            </div>
          </div>
        </div>
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
    <div className="space-y-3">
      {disputes.map((d) => (
          <div key={d.id} className="card p-5">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <p className="font-disp font-bold text-[1rem] text-ink">Disputa #{d.id.slice(0, 8)}</p>
                <p className="text-[0.78rem] text-mut font-semibold mt-0.5">Solicitud: {d.request?.code}</p>
                <p className="text-[0.82rem] text-mut mt-2">{d.reason}</p>
                <div className="flex items-center gap-2 mt-2">
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
                  <span className="text-[0.72rem] text-mut">Abierta por: {d.opener?.name || "Usuario"}</span>
                </div>
                {d.resolution && (
                  <div className="mt-3 p-3 bg-tint rounded-xl">
                    <p className="text-[0.72rem] font-bold text-mut uppercase tracking-wide mb-1">Resolución</p>
                    <p className="text-[0.82rem] text-ink font-medium">{d.resolution}</p>
                    {d.resolver && (
                      <p className="text-[0.68rem] text-mut font-semibold mt-1">
                        Resuelto por: {d.resolver.name}
                      </p>
                    )}
                  </div>
                )}
              </div>
              {d.status === "open" && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => setResolveModal(d)}
                    className="btn-pine h-9 px-4 text-[0.78rem]"
                  >
                    Resolver
                  </button>
                </div>
              )}
            </div>
          </div>
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
  const [status, setStatus] = useState<"resolved_customer" | "resolved_provider">("resolved_customer");
  const [resolution, setResolution] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm animate-fadein">
      <div className="bg-card rounded-2xl shadow-lift max-w-md w-full p-6 animate-pop">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-disp font-bold text-[1.2rem] text-ink">Resolver disputa</h3>
            <p className="text-[0.82rem] text-mut font-medium mt-1">
              Disputa #{dispute.id.slice(0, 8)}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 grid place-items-center rounded-full bg-tint text-mut hover:bg-line transition-colors"
            aria-label="Cerrar"
          >
            <Icon name="x" className="w-4 h-4" strokeWidth={2.4} />
          </button>
        </div>

        <div className="card p-4 mb-4 bg-tint/50">
          <p className="text-[0.72rem] font-bold text-mut uppercase tracking-wide mb-1">Motivo original</p>
          <p className="text-[0.85rem] text-ink font-medium">{dispute.reason}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[0.78rem] font-bold text-ink mb-2">
              Resolución *
            </label>
            <textarea
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
            <p className="text-[0.72rem] text-soft font-semibold mt-1.5">
              {resolution.length}/2000 caracteres (mínimo 10)
            </p>
          </div>

          <div>
            <label className="block text-[0.78rem] font-bold text-ink mb-2">
              ¿A quién favorece la resolución? *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatus("resolved_customer")}
                disabled={loading}
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
                className={`h-12 rounded-xl font-bold text-[0.85rem] transition-all ${
                  status === "resolved_provider"
                    ? "bg-pinesoft text-pine border-2 border-pine"
                    : "bg-tint text-mut border-2 border-transparent hover:border-line"
                }`}
              >
                Proveedor
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-corsoft text-cor px-4 py-3 text-[0.82rem] font-bold flex items-start gap-2.5">
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
    <div className="card overflow-x-auto">
      <table className="w-full">
        <thead className="bg-tint border-b border-line2">
          <tr>
            <th className="px-4 py-3 text-left text-[0.72rem] font-bold text-mut uppercase">Fecha</th>
            <th className="px-4 py-3 text-left text-[0.72rem] font-bold text-mut uppercase">Actor</th>
            <th className="px-4 py-3 text-left text-[0.72rem] font-bold text-mut uppercase">Acción</th>
            <th className="px-4 py-3 text-left text-[0.72rem] font-bold text-mut uppercase">Entidad</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line2">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-tint/50">
              <td className="px-4 py-3 text-[0.78rem] text-mut">{new Date(log.at).toLocaleString()}</td>
              <td className="px-4 py-3 text-[0.82rem] font-semibold text-ink">{log.actor?.name || "Sistema"}</td>
              <td className="px-4 py-3">
                <span className="text-[0.72rem] font-bold px-2 py-1 rounded-full bg-tint text-mut">
                  {log.action}
                </span>
              </td>
              <td className="px-4 py-3 text-[0.78rem] text-mut">{log.entity_type} #{log.entity_id?.slice(0, 8)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[0.72rem] font-bold text-mut uppercase tracking-wide">{label}</p>
          <p className="font-disp font-bold text-2xl text-ink mt-1">{value.toLocaleString()}</p>
        </div>
        <span className={`w-10 h-10 rounded-xl grid place-items-center ${colorClasses}`}>
          <Icon name={icon as never} className="w-5 h-5" strokeWidth={1.9} />
        </span>
      </div>
    </div>
  );
}
