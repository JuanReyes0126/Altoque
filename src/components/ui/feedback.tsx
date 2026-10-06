import type { ReactNode } from "react";
import { Icon, type IconName } from "../icons";

/** Estados de UI: el contenido y las acciones provienen del flujo real. */
export function EmptyState({ title, description, icon = "compass", action }: {
  title: string; description: string; icon?: IconName; action?: ReactNode;
}) {
  return <section className="ui-state card" role="status">
    <span className="ui-state-icon" aria-hidden="true"><Icon name={icon} className="w-7 h-7" /></span>
    <h2 className="font-disp font-bold text-xl mt-4">{title}</h2>
    <p className="text-sm text-mut leading-relaxed mt-2 max-w-md mx-auto">{description}</p>
    {action && <div className="mt-5 flex flex-wrap justify-center gap-3">{action}</div>}
  </section>;
}

export function LoadingState({ label = "Cargando…", rows = 3 }: { label?: string; rows?: number }) {
  return <section className="mt-5" role="status" aria-live="polite" aria-busy="true">
    <p className="text-sm text-mut mb-4 flex items-center gap-2"><span className="ui-spinner" aria-hidden="true" />{label}</p>
    <div className="grid gap-3" aria-hidden="true">{Array.from({ length: rows }, (_, index) => <div key={index} className="card p-5 flex gap-4">
      <span className="skel w-12 h-12 shrink-0" /><div className="flex-1 space-y-3"><div className="skel h-4 w-2/3" /><div className="skel h-3 w-4/5" /><div className="skel h-3 w-1/3" /></div>
    </div>)}</div>
  </section>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <section className="ui-state card border-cor/30" role="alert">
    <span className="ui-state-icon bg-corsoft text-cor" aria-hidden="true"><Icon name="alert" className="w-7 h-7" /></span>
    <h2 className="font-disp font-bold text-lg mt-4">No pudimos cargar esta información</h2>
    <p className="text-sm text-mut mt-2 max-w-md mx-auto">{message}</p>
    <button type="button" onClick={onRetry} className="btn-ghost min-h-11 px-5 mt-5">Reintentar</button>
  </section>;
}

export function PageIntro({ eyebrow, title, description, action }: {
  eyebrow?: string; title: string; description?: string; action?: ReactNode;
}) {
  return <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
    <div className="min-w-0">{eyebrow && <p className="ui-eyebrow mb-2">{eyebrow}</p>}
      <h1 className="font-disp font-bold text-2xl sm:text-3xl tracking-tight leading-tight break-words">{title}</h1>
      {description && <p className="text-sm text-mut leading-relaxed max-w-xl mt-2">{description}</p>}
    </div>{action && <div className="shrink-0">{action}</div>}
  </header>;
}
