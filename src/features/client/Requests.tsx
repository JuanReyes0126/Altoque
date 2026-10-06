import { useCallback, useRef, useState, type FormEvent } from "react";
import { api } from "../../lib/api";
import { ApiHttpError } from "../../lib/http";
import { useApiPolling } from "../../lib/use-api-polling";
import type { Tab, View } from "../../lib/state";
import { DisputeModal } from "./DisputeModal";
import { DisputeView } from "./DisputeView";

export function requestStatusLabel(status: string): string {
  return ({ searching: "Buscando profesional", accepted: "Aceptada", on_the_way: "En camino", arrived: "Profesional llegó", in_progress: "Servicio en curso", completed: "Completada · por confirmar", confirmed: "Confirmada · por valorar", reviewed: "Valorada", cancelled: "Cancelada", expired: "Expirada", disputed: "En disputa" } as Record<string, string>)[status] ?? "Estado pendiente de actualización";
}
export const terminalRequest = (status: string) => ["completed", "confirmed", "reviewed", "cancelled", "expired", "disputed"].includes(status);

export function RequestSummary({ request, onOpen }: { request: any; onOpen: () => void }) {
  return <button onClick={onOpen} className="w-full card card-h p-5 text-left">
    <p className="font-disp font-bold">{request.category?.name || "Solicitud de servicio"}</p>
    <p className="text-xs text-mut mt-1">{request.code} · {request.zone?.name || "Zona de servicio"}</p>
    <p className="text-sm mt-3 break-words">{request.description}</p>
    <p className="font-semibold text-pine text-sm mt-3">{requestStatusLabel(request.status)}</p>
    {request.provider?.user?.name && <p className="text-xs text-mut mt-2">Profesional: {request.provider.user.name}</p>}
  </button>;
}

export function RequestsTab({ go }: { go: (view: View) => void }) {
  const [page, setPage] = useState(1);
  const loader = useCallback(() => api.requests.list({ page, limit: 20 }), [page]);
  const { data, loading, error, retry } = useApiPolling(loader, 10000);
  const active = data?.data.filter((request) => !terminalRequest(request.status)) ?? [];
  const history = data?.data.filter((request) => terminalRequest(request.status)) ?? [];
  return <main className="max-w-2xl mx-auto px-5 py-6"><h1 className="font-disp font-bold text-2xl">Mis solicitudes</h1>
    {loading ? <p role="status" className="py-10">Cargando solicitudes…</p> : error ? <section role="alert" className="card p-5 mt-5"><p>{error}</p><button onClick={retry} className="btn-ghost h-11 px-4 mt-3">Reintentar</button></section> : !data?.data.length ? <section className="card p-8 text-center mt-5"><h2 className="font-bold">Aún no tienes solicitudes</h2><button onClick={() => go({ t: "explore" })} className="btn-pine h-12 px-5 mt-4">Explorar servicios</button></section> : <>
      {([["En curso", active], ["Historial", history]] as const).map(([title, requests]) => requests.length > 0 && <section key={title} className="mt-6"><h2 className="font-bold mb-3">{title}</h2><div className="space-y-3">{requests.map((request) => <RequestSummary key={request.id} request={request} onOpen={() => go({ t: "track", jobId: request.id })} />)}</div></section>)}
      {data.meta.pages > 1 && <nav aria-label="Páginas de solicitudes" className="flex gap-3 items-center mt-5"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="btn-ghost h-11 px-4">Anterior</button><span>{page} / {data.meta.pages}</span><button disabled={page >= data.meta.pages} onClick={() => setPage((value) => value + 1)} className="btn-ghost h-11 px-4">Siguiente</button></nav>}
    </>}
  </main>;
}

export function TrackingView({ jobId, jump }: { jobId: string; go: (view: View) => void; jump: (tab: Tab) => void }) {
  const loader = useCallback(() => api.requests.getById(jobId), [jobId]);
  const { data: request, loading, error: loadError, retry } = useApiPolling(loader, 5000);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeVersion, setDisputeVersion] = useState(0);
  const [disputeExists, setDisputeExists] = useState(true);
  const action = async (operation: () => Promise<unknown>, success: string) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(""); setMessage("");
    try { await operation(); setMessage(success); setCancelOpen(false); retry(); }
    catch (failure) { setError(failure instanceof ApiHttpError ? failure.message : "No pudimos completar la operación."); }
    finally { pending.current = false; setBusy(false); }
  };
  const review = (event: FormEvent) => { event.preventDefault(); void action(() => api.requests.review(jobId, { rating, comment: comment.trim() }), "Reseña enviada."); };
  const mayDispute = request && ["completed", "confirmed", "reviewed", "disputed"].includes(request.status);
  return <main className="max-w-2xl mx-auto px-5 py-6"><button onClick={() => jump("jobs")} className="btn-ghost h-11 px-4">Volver a mis solicitudes</button>
    {loading ? <p role="status" className="py-10">Cargando solicitud…</p> : loadError ? <section role="alert" className="card p-5 mt-5"><p>{loadError}</p><button onClick={retry} className="btn-ghost h-11 px-4 mt-3">Reintentar</button></section> : request && <>
      <section className="card p-6 mt-5"><h1 className="font-disp font-bold text-xl">{request.category?.name || "Solicitud de servicio"}</h1><p className="text-xs text-mut mt-1">{request.code} · {request.zone?.name}</p><p className="font-bold text-pine mt-4">{requestStatusLabel(request.status)}</p><p className="mt-4 whitespace-pre-wrap break-words">{request.description}</p>
        {request.provider?.user?.name && <p className="text-sm mt-4">Profesional asignado: {request.provider.user.name}</p>}
        {request.address?.line && <p className="text-sm mt-2">Dirección: {request.address.line}</p>}
        {request.status === "searching" && <p className="text-sm text-mut mt-4">La solicitud sigue abierta para profesionales habilitados que cubren este servicio y zona.</p>}
        {error && <p role="alert" className="text-cor mt-4">{error}</p>}{message && <p role="status" className="text-ok mt-4">{message}</p>}
        {["searching", "accepted"].includes(request.status) && <button disabled={busy} onClick={() => setCancelOpen(true)} className="btn-ghost h-11 px-4 text-cor mt-5">Cancelar solicitud</button>}
        {cancelOpen && <section role="alert" className="mt-4"><p>¿Confirmas la cancelación?</p><div className="flex gap-3 mt-3"><button disabled={busy} onClick={() => void action(() => api.requests.cancel(jobId), "Solicitud cancelada.")} className="btn-ghost h-11 px-4 text-cor">Sí, cancelar</button><button disabled={busy} onClick={() => setCancelOpen(false)} className="btn-ghost h-11 px-4">Volver</button></div></section>}
        {request.status === "completed" && <button disabled={busy} onClick={() => void action(() => api.requests.confirm(jobId), "Servicio confirmado.")} className="btn-pine h-12 px-5 mt-5">Confirmar servicio completado</button>}
      </section>
      {request.status === "confirmed" && <form onSubmit={review} className="card p-5 mt-5"><h2 className="font-bold text-lg">Valora el servicio</h2><fieldset disabled={busy} className="space-y-4 mt-4"><label htmlFor="review-rating" className="block font-bold text-sm">Calificación<select id="review-rating" value={rating} onChange={(event) => setRating(Number(event.target.value))} className="w-full border border-line rounded-xl p-3 mt-2">{[5,4,3,2,1].map((value) => <option key={value} value={value}>{value} estrellas</option>)}</select></label><label htmlFor="review-comment" className="block font-bold text-sm">Comentario opcional<textarea id="review-comment" maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} className="w-full border border-line rounded-xl p-3 mt-2" rows={3} /></label></fieldset><button disabled={busy} className="btn-pine h-12 px-5 mt-4">Enviar reseña</button></form>}
      {request.review && <section className="card p-5 mt-5"><h2 className="font-bold">Tu valoración: {request.review.rating} ★</h2><p className="mt-3 break-words">{request.review.comment}</p></section>}
      {mayDispute && <section className="mt-5"><DisputeView key={disputeVersion} requestId={jobId} onDisputeExists={setDisputeExists} />{!disputeExists && request.status !== "disputed" && <button disabled={busy} onClick={() => setDisputeOpen(true)} className="btn-ghost h-12 px-5 mt-4">Abrir disputa</button>}</section>}
      {disputeOpen && <DisputeModal requestId={jobId} onClose={() => setDisputeOpen(false)} onSuccess={() => { setDisputeOpen(false); setDisputeVersion((value) => value + 1); retry(); }} />}
    </>}
  </main>;
}
