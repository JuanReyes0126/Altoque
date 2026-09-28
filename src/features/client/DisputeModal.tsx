import { useState } from "react";
import { Icon } from "../../components/icons";
import { api } from "../../lib/api";

interface DisputeModalProps {
  requestId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function DisputeModal({ requestId, onClose, onSuccess }: DisputeModalProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (reason.trim().length < 10) {
      setError("El motivo debe tener al menos 10 caracteres");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.disputes.create(requestId, reason.trim());
      onSuccess();
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("Ya existe una disputa")) {
          setError("Ya existe una disputa abierta para esta solicitud");
        } else if (err.message.includes("Solo se pueden disputar")) {
          setError("Esta solicitud no puede ser disputada en este momento");
        } else {
          setError("Error al crear la disputa. Intenta nuevamente.");
        }
      } else {
        setError("Error inesperado. Intenta nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm animate-fadein">
      <div className="bg-card rounded-2xl shadow-lift max-w-md w-full p-6 animate-pop">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-disp font-bold text-[1.2rem] text-ink">Abrir disputa</h3>
            <p className="text-[0.82rem] text-mut font-medium mt-1">
              Describe el problema con este servicio
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[0.78rem] font-bold text-ink mb-2">
              Motivo de la disputa *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
              placeholder="Describe detalladamente el problema con el servicio..."
              rows={5}
              className="w-full card p-3 text-[0.88rem] font-medium text-ink placeholder:text-soft outline-none focus:border-pine/50 resize-none transition-colors disabled:opacity-50"
              minLength={10}
              maxLength={2000}
              required
            />
            <p className="text-[0.72rem] text-soft font-semibold mt-1.5">
              {reason.length}/2000 caracteres (mínimo 10)
            </p>
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
              disabled={loading || reason.trim().length < 10}
              className="btn-pine flex-1 h-12 text-[0.88rem] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Icon name="alert" className="w-4 h-4" strokeWidth={2.2} />
                  Abrir disputa
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
