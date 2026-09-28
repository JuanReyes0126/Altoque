import { Icon } from "./icons";
import { getPaymentStatusLabel, getPaymentStatusColor, type PaymentStatus } from "../lib/payments";

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  showIcon?: boolean;
}

export function PaymentStatusBadge({ status, showIcon = true }: PaymentStatusBadgeProps) {
  const label = getPaymentStatusLabel(status);
  const color = getPaymentStatusColor(status);

  const iconMap: Record<PaymentStatus, "clock" | "shield" | "check" | "x"> = {
    pending: "clock",
    held: "shield",
    paid: "check",
    refunded: "x",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-[0.68rem] font-bold rounded-full px-2.5 py-1 ${color}`}>
      {showIcon && <Icon name={iconMap[status]} className="w-3 h-3" strokeWidth={2.4} />}
      {label}
    </span>
  );
}

interface PaymentInfoProps {
  payment?: {
    status: PaymentStatus;
    amount: number;
    currency: string;
  } | null;
}

export function PaymentInfo({ payment }: PaymentInfoProps) {
  if (!payment) {
    return (
      <div className="card p-4 bg-tint/50">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-tint text-mut grid place-items-center">
            <Icon name="wallet" className="w-5 h-5" strokeWidth={1.9} />
          </span>
          <div>
            <p className="text-[0.82rem] font-bold text-ink">Pago</p>
            <p className="text-[0.72rem] text-mut font-semibold">No disponible todavía</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-pinesoft text-pine grid place-items-center">
            <Icon name="wallet" className="w-5 h-5" strokeWidth={1.9} />
          </span>
          <div>
            <p className="text-[0.82rem] font-bold text-ink">Pago</p>
            <p className="text-[0.72rem] text-mut font-semibold">
              {payment.currency} {payment.amount.toFixed(2)}
            </p>
          </div>
        </div>
        <PaymentStatusBadge status={payment.status} />
      </div>

      {payment.status === "pending" && (
        <div className="rounded-xl bg-sunsoft/50 px-4 py-3 mt-2">
          <p className="text-[0.78rem] text-sun2 font-bold flex items-start gap-2">
            <Icon name="clock" className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2} />
            <span>
              El pago está pendiente. El sistema de pagos estará disponible próximamente.
            </span>
          </p>
        </div>
      )}

      {payment.status === "held" && (
        <div className="rounded-xl bg-corsoft/50 px-4 py-3 mt-2">
          <p className="text-[0.78rem] text-cor font-bold flex items-start gap-2">
            <Icon name="shield" className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2} />
            <span>
              El pago está retenido debido a una disputa en curso.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
