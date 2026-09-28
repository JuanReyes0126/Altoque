import { useState } from "react";
import { Icon } from "../../components/icons";
import { api } from "../../lib/api";
import { useToast } from "../../components/Toast";

interface ProDisputeModalProps {
  requestId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ProDisputeModal({ requestId, onClose, onSuccess }: ProDisputeModalProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

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
      toast.showToast("success", "Disputa creada correctamente");
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
      <div className="bg-ncard border border-nline rounded-2xl shadow-lift max-w-md w-full p-6 animate-pop">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-disp font-bold text-[1.2rem] text-ntxt">Abrir disputa</h3>
            <p className="text-[0.82rem] text-nmut font-medium mt-1">
              Describe el problema con este servicio
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 grid place-items-center rounded-full bg-nsurf text-nmut hover:bg-nline transition-colors"
            aria-label="Cerrar"
          >
            <Icon name="x" className="w-4 h-4" strokeWidth={2.4} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[0.78rem] font-bold text-ntxt mb-2">
              Motivo de la disputa *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
              placeholder="Describe detalladamente el problema con el servicio..."
              rows={5}
              className="w-full ncard p-3 text-[0.88rem] font-medium text-ntxt placeholder:text-nmut outline-none focus:border-namber/50 resize-none transition-colors disabled:opacity-50"
              minLength={10}
              maxLength={2000}
              required
            />
            <p className="text-[0.72rem] text-nmut font-semibold mt-1.5">
              {reason.length}/2000 caracteres (mínimo 10)
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-corsoft/20 text-cor px-4 py-3 text-[0.82rem] font-bold flex items-start gap-2.5">
              <Icon name="alert" className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2.2} />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-ghost-dark flex-1 h-12 text-[0.88rem]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || reason.trim().length < 10}
              className="flex-1 h-12 rounded-[14px] bg-namber text-[#33230a] font-extrabold text-[0.88rem] active:scale-95 transition-transform disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#33230a]/30 border-t-[#33230a] rounded-full animate-spin inline-block mr-2" />
                  Enviando...
                </>
              ) : (
                <>
                  <Icon name="alert" className="w-4 h-4 inline-block mr-1" strokeWidth={2.2} />
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
