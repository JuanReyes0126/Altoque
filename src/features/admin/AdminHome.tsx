/* ════════════════════════════════════════════════════════════════
   ALTOQUE · Admin Dashboard (F6)
   Panel administrativo funcional conectado a endpoints reales.
   ════════════════════════════════════════════════════════════════ */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/icons";
import { clearSession, useApp } from "../../lib/state";
import { api, authApi } from "../../lib/api";
import { PATHS } from "../../lib/router";

type AdminTab = "dashboard" | "users" | "providers" | "requests" | "disputes" | "audit";

export function AdminHome() {
  const nav = useNavigate();
  const { session } = useApp();
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Cargar métricas reales del dashboard
  useEffect(() => {
    api.admin.getMetrics()
      .then(setMetrics)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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
                await authApi.signOut().catch(() => {});
                clearSession();
                nav(PATHS.home);
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
        {tab === "dashboard" && metrics && <DashboardView metrics={metrics} />}
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
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.getUsers()
      .then((res) => setUsers(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-mut">Cargando usuarios...</div>;

  return (
    <div className="card overflow-hidden">
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
  );
}

function ProvidersView() {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.getProviders()
      .then((res) => setProviders(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await api.admin.approveProvider(id);
      setProviders(providers.map((p) => p.id === id ? { ...p, verification_status: "verified" } : p));
    } catch (error) {
      console.error("Error approving provider:", error);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.admin.rejectProvider(id, "Rechazado por administrador");
      setProviders(providers.map((p) => p.id === id ? { ...p, verification_status: "rejected" } : p));
    } catch (error) {
      console.error("Error rejecting provider:", error);
    }
  };

  if (loading) return <div className="text-center py-12 text-mut">Cargando proveedores...</div>;

  return (
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
                <button onClick={() => handleApprove(p.id)} className="btn-pine h-9 px-4 text-[0.78rem]">
                  Aprobar
                </button>
                <button onClick={() => handleReject(p.id)} className="btn-ghost h-9 px-4 text-[0.78rem] text-cor border-cor/30">
                  Rechazar
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function RequestsView() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.getRequests()
      .then((res) => setRequests(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-mut">Cargando solicitudes...</div>;

  return (
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
  );
}

function DisputesView() {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.getDisputes()
      .then((res) => setDisputes(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-mut">Cargando disputas...</div>;

  return (
    <div className="space-y-3">
      {disputes.length === 0 ? (
        <div className="text-center py-12 text-mut">No hay disputas registradas</div>
      ) : (
        disputes.map((d) => (
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
                    {d.status}
                  </span>
                  <span className="text-[0.72rem] text-mut">Abierta por: {d.opener?.name}</span>
                </div>
              </div>
              {d.status === "open" && (
                <div className="flex gap-2">
                  <button className="btn-pine h-9 px-4 text-[0.78rem]">Resolver</button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function AuditView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.getAuditLogs()
      .then((res) => setLogs(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-mut">Cargando logs...</div>;

  return (
    <div className="card overflow-hidden">
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
