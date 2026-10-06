import { Component, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

export function AuthLoadError({ onRetry }: { onRetry: () => void }) {
  return <main className="max-w-md mx-auto px-5 py-16 text-center" role="alert"><h1 className="font-disp font-bold text-2xl">No pudimos comprobar tu sesión</h1><p className="text-mut mt-3">Revisa tu conexión y vuelve a intentarlo.</p><button onClick={onRetry} className="btn-pine h-12 px-5 mt-6">Reintentar</button></main>;
}

export function NotFoundPage() {
  const navigate = useNavigate();
  return <main className="max-w-md mx-auto px-5 py-16 text-center"><h1 className="font-disp font-bold text-2xl">Esta página no existe</h1><p className="text-mut mt-3">Revisa la dirección o vuelve al inicio.</p><button onClick={() => navigate("/")} className="btn-pine h-12 px-5 mt-6">Volver al inicio</button></main>;
}

/** Un error de render no deja una pantalla blanca ni expone detalles internos. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="max-w-md mx-auto px-5 py-16 text-center" role="alert"><h1 className="font-disp font-bold text-2xl">No pudimos mostrar esta página</h1><p className="text-mut mt-3">Vuelve al inicio e inténtalo nuevamente.</p><a href="/#/" onClick={(event) => {
      // Cambiar sólo el hash no desmonta/reset el boundary que falló.
      // Conservar abrir en otra pestaña; el click normal recarga el documento.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      event.preventDefault();
      window.history.replaceState(null, "", "/#/");
      window.location.reload();
    }} className="btn-pine h-12 px-5 mt-6">Volver al inicio</a></main>;
    return this.props.children;
  }
}
