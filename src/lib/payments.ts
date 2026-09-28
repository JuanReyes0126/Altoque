/**
 * ALTOQUE · Tipos de pagos (F5)
 * 
 * Arquitectura preparada para integración futura con proveedor de pagos.
 * NO procesa pagos reales. NO almacena datos de tarjetas.
 */

// Estados de pago alineados con PaymentStatus en schema.prisma
export type PaymentStatus = "pending" | "held" | "paid" | "refunded";

// Tipos de transacción alineados con TransactionKind en schema.prisma
export type TransactionKind = "earning" | "payout" | "adjustment";

export interface Payment {
  id: string;
  request_id: string;
  amount: number; // Decimal en BD, number en frontend
  currency: string;
  method?: string;
  status: PaymentStatus;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  provider_id: string;
  kind: TransactionKind;
  amount: number;
  currency: string;
  note?: string;
  created_at: string;
}

// Helper para mostrar estado de pago
export function getPaymentStatusLabel(status: PaymentStatus): string {
  const labels: Record<PaymentStatus, string> = {
    pending: "Pendiente",
    held: "Retenido",
    paid: "Pagado",
    refunded: "Reembolsado",
  };
  return labels[status];
}

export function getPaymentStatusColor(status: PaymentStatus): string {
  const colors: Record<PaymentStatus, string> = {
    pending: "bg-sunsoft text-sun2",
    held: "bg-corsoft text-cor",
    paid: "bg-oksoft text-ok",
    refunded: "bg-tint text-mut",
  };
  return colors[status];
}

// Placeholder para integración futura con proveedor de pagos
export interface PaymentProvider {
  createPayment(payment: Omit<Payment, "id" | "created_at" | "updated_at">): Promise<Payment>;
  processPayment(paymentId: string): Promise<Payment>;
  refundPayment(paymentId: string, reason?: string): Promise<Payment>;
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
}

/**
 * IMPLEMENTACIÓN PENDIENTE: Integración con proveedor de pagos
 * 
 * Para habilitar pagos reales, se necesita:
 * 1. Seleccionar proveedor (Stripe, PayPal, Azul, CardNet, etc.)
 * 2. Obtener credenciales API
 * 3. Implementar PaymentProvider para el proveedor seleccionado
 * 4. Configurar webhooks para actualizaciones de estado
 * 5. Implementar lógica de hold/release para disputas
 * 
 * Este módulo está preparado para esa integración futura.
 */
export class PaymentNotAvailableError extends Error {
  constructor() {
    super("El sistema de pagos aún no está habilitado. Contacta al administrador.");
    this.name = "PaymentNotAvailableError";
  }
}

// Placeholder implementation que siempre falla
export const paymentProvider: PaymentProvider = {
  async createPayment() {
    throw new PaymentNotAvailableError();
  },
  async processPayment() {
    throw new PaymentNotAvailableError();
  },
  async refundPayment() {
    throw new PaymentNotAvailableError();
  },
  async getPaymentStatus() {
    throw new PaymentNotAvailableError();
  },
};
