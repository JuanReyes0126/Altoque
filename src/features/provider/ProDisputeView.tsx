import { useEffect, useState } from "react";
import { Icon } from "../../components/icons";
import { api } from "../../lib/api";

interface Dispute {
  id: string;
  request_id: string;
  opened_by: string;
  reason: string;
  status: "open" | "resolved_customer" | "resolved_provider" | "dismissed";
  resolved_by?: string;
  resolution?: string;
  created_at: string;
  updated_at: string;
  request?: {
    code: string;
    category?: { name: string };
    customer?: { name: string };
    provider?: { user?: { name: string } };
  };
  opener?: { name: string };
  resolver?: { name: string };
}

interface ProDisputeViewProps {
  requestId: string;
  onDisputeExists?: (exists: boolean) => void;
}

export function ProDisputeView({ requestId, onDisputeExists }: ProDisputeViewProps) {
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    onDisputeExists?.(true); // No habilitar apertura mientras el estado es desconocido.
    api.disputes.list({ requestId, limit: 1 })
      .then((result) => {
        if (!alive) return;
        const found = result.data[0] as Dispute | undefined;
        setDispute(found ?? null);
        onDisputeExists?.(!!found);
      })
      .catch(() => {
        if (!alive) return;
        setError("No se pudo cargar la información de la disputa.");
        onDisputeExists?.(true);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [requestId, onDisputeExists, reload]);

  if (loading) {
    return (
      <div className="ncard p-5 mt-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-nsurf animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-nsurf rounded animate-pulse w-1/3" />
            <div className="h-3 bg-nsurf rounded animate-pulse w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (error) return <section role="alert" className="card p-5 mt-4"><p>{error}</p><button onClick={() => setReload((value) => value + 1)} className="btn-ghost h-11 px-4 mt-3">Reintentar</button></section>;
  if (!dispute) return null;

  const statusConfig = {
    dismissed: { label: "Descartada", color: "bg-tint text-mut", icon: "x" },
    open: { label: "Abierta", color: "bg-sunsoft text-sun2", icon: "alert" },
    resolved_customer: { label: "Resuelta a favor del cliente", color: "bg-oksoft text-ok", icon: "check" },
    resolved_provider: { label: "Resuelta a tu favor", color: "bg-pinesoft text-pine", icon: "check" },
  };

  const config = statusConfig[dispute.status];

  return (
    <div className="ncard p-5 mt-4 border-namber/30">
      <div className="flex items-start gap-3 mb-3">
        <span className="w-10 h-10 rounded-xl bg-namber/20 text-namber grid place-items-center shrink-0">
          <Icon name="alert" className="w-5 h-5" strokeWidth={2} />
        </span>
        <div className="flex-1">
          <p className="font-disp font-bold text-[0.95rem] text-ntxt">Disputa sobre este servicio</p>
          <p className="text-[0.72rem] text-nmut font-semibold mt-0.5">
            Abierta el {new Date(dispute.created_at).toLocaleDateString("es-DO")}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-[0.68rem] font-bold rounded-full px-2.5 py-1 ${config.color}`}>
          <Icon name={config.icon as never} className="w-3 h-3" strokeWidth={2.4} />
          {config.label}
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[0.72rem] font-bold text-nmut uppercase tracking-wide mb-1">Motivo</p>
          <p className="text-[0.85rem] text-ntxt font-medium leading-relaxed">{dispute.reason}</p>
        </div>

        {dispute.resolution && (
          <div>
            <p className="text-[0.72rem] font-bold text-nmut uppercase tracking-wide mb-1">Resolución</p>
            <p className="text-[0.85rem] text-ntxt font-medium leading-relaxed">{dispute.resolution}</p>
            {dispute.resolver && (
              <p className="text-[0.72rem] text-nmut font-semibold mt-1">
                Resuelto por: {dispute.resolver.name}
              </p>
            )}
          </div>
        )}

        {dispute.status === "open" && (
          <div className="rounded-xl bg-namber/10 px-4 py-3 mt-3">
            <p className="text-[0.78rem] text-namber font-bold flex items-start gap-2">
              <Icon name="clock" className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2} />
              <span>
                Esta disputa está siendo revisada por el equipo de Altoque. Te notificaremos cuando haya una resolución.
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
