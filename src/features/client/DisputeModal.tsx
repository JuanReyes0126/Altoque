import { useId, useState } from "react";
import { Icon } from "../../components/icons";
import { api } from "../../lib/api";
import { useDialogFocus } from "../../components/ui/use-dialog-focus";

interface DisputeModalProps {
  requestId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function DisputeModal({ requestId, onClose, onSuccess }: DisputeModalProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const { dialogRef, onDialogKeyDown } = useDialogFocus(loading, onClose);

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
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm animate-fadein motion-reduce:animate-none">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} aria-busy={loading} tabIndex={-1} onKeyDown={onDialogKeyDown} className="bg-card rounded-2xl shadow-lift max-w-md w-full max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6 animate-pop motion-reduce:animate-none">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 id={`${id}-title`} className="font-disp font-bold text-[1.2rem] text-ink">Abrir disputa</h3>
            <p id={`${id}-description`} className="text-[0.82rem] text-mut font-medium mt-1">
              Describe el problema con este servicio
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-11 h-11 shrink-0 grid place-items-center rounded-full bg-tint text-mut hover:bg-line transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine"
            aria-label="Cerrar"
          >
            <Icon name="x" className="w-4 h-4" strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor={`${id}-reason`} className="block text-[0.78rem] font-bold text-ink mb-2">
              Motivo de la disputa *
            </label>
            <textarea
              id={`${id}-reason`}
              aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
              aria-invalid={error && reason.trim().length < 10 ? true : undefined}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
              placeholder="Describe detalladamente el problema con el servicio..."
              rows={5}
              className="w-full card p-3 text-[0.88rem] font-medium text-ink placeholder:text-soft focus:border-pine/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine resize-y transition-colors disabled:opacity-50"
              minLength={10}
              maxLength={2000}
              required
            />
            <p id={`${id}-hint`} className="text-[0.72rem] text-soft font-semibold mt-1.5">
              {reason.length}/2000 caracteres (mínimo 10)
            </p>
          </div>

          {error && (
            <div id={`${id}-error`} role="alert" className="rounded-xl bg-corsoft text-cor px-4 py-3 text-[0.82rem] font-bold flex items-start gap-2.5">
              <Icon name="alert" className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2.2} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-ghost flex-1 min-w-0 h-12 text-[0.88rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || reason.trim().length < 10}
              className="btn-pine flex-1 min-w-0 h-12 text-[0.88rem] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine"
            >
              {loading ? (
                <>
                  <div aria-hidden="true" className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin motion-reduce:animate-none" />
                  Enviando...
                </>
              ) : (
                <>
                  <Icon name="alert" className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />
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
