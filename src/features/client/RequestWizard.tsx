import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, type CatalogCategory } from "../../lib/api";
import { ApiHttpError } from "../../lib/http";
import { profileApi, type AddressZone, type SavedAddress } from "../../lib/profile-api";
import type { View } from "../../lib/state";
import { Icon } from "../../components/icons";
import { EmptyState, ErrorState, LoadingState, PageIntro } from "../../components/ui/feedback";

export function scheduledTime(value: string): string | undefined {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now() ? new Date(timestamp).toISOString() : undefined;
}

export function RequestWizard({ catId, proId, go }: { catId?: string; proId?: string; go: (view: View) => void }) {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [zones, setZones] = useState<AddressZone[]>([]);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [addressId, setAddressId] = useState("");
  const [description, setDescription] = useState("");
  const [when, setWhen] = useState<"now" | "scheduled" | "quote">("now");
  const [scheduled, setScheduled] = useState("");
  const [photos, setPhotos] = useState<Array<{ id: string; blob_key: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const pending = useRef(false);
  const uploadingRef = useRef(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true); setLoadError("");
    Promise.all([api.categories.list(), profileApi.zones(), profileApi.addresses.list(), proId ? api.providersPublic.getById(proId) : Promise.resolve(null)])
      .then(([catalog, areas, saved, professional]) => {
        if (!alive) return;
        setCategories(catalog); setZones(areas); setAddresses(saved);
        const preferred = catId ?? professional?.categories[0]?.id;
        setCategoryId(catalog.some((item) => item.id === preferred) ? preferred! : "");
      })
      .catch(() => { if (alive) setLoadError("No pudimos cargar los servicios, zonas o direcciones. Inténtalo de nuevo."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [catId, proId, reload]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current || uploadingRef.current) return;
    setError("");
    if (!categories.some((item) => item.id === categoryId) || !zones.some((item) => item.id === zoneId)) { setError("Selecciona un servicio y una zona disponibles."); return; }
    const scheduledAt = when === "scheduled" ? scheduledTime(scheduled) : undefined;
    if (when === "scheduled" && !scheduledAt) { setError("Selecciona una fecha y hora futuras."); return; }
    pending.current = true; setBusy(true);
    try {
      const request = await api.requests.create({ category_id: categoryId, zone_id: zoneId, description: description.trim(), when_type: when,
        ...(scheduledAt ? { scheduled_at: scheduledAt } : {}), ...(addressId ? { address_id: addressId } : {}), photos: photos.map((photo, sort) => ({ blob_key: photo.blob_key, sort })) });
      go({ t: "track", jobId: request.id });
    } catch (failure) { setError(failure instanceof ApiHttpError ? failure.message : "No pudimos crear la solicitud. Inténtalo de nuevo."); }
    finally { pending.current = false; setBusy(false); }
  };

  const upload = async (file: File | undefined) => {
    if (!file || uploadingRef.current || pending.current || photos.length >= 3) return;
    setError("");
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError("Usa una imagen JPEG o PNG de hasta 5 MB."); return; }
    uploadingRef.current = true; setUploading(true);
    try { const photo = await api.uploads.requestPhoto(file); setPhotos((previous) => [...previous, photo]); }
    catch { setError("No pudimos subir la foto. Puedes volver a intentarlo o continuar sin fotos."); }
    finally { uploadingRef.current = false; setUploading(false); }
  };

  const inputClass = "w-full rounded-xl border border-line bg-card p-3 mt-2";
  return <main className="max-w-2xl mx-auto px-5 py-6">
    <button onClick={() => go({ t: "explore" })} className="btn-ghost h-11 px-4">Volver a servicios</button>
    <div className="mt-6"><PageIntro eyebrow="Cuéntanos qué necesitas" title="Nueva solicitud" description="Describe el servicio y el lugar donde lo necesitas." /></div>
    <p className="text-sm text-mut mt-2">Un profesional de tu zona confirmará la asignación al aceptar. El envío no reserva automáticamente un profesional concreto.</p>
    {loading ? <LoadingState label="Cargando servicios y zonas…" /> : loadError ? <ErrorState message={loadError} onRetry={() => setReload((value) => value + 1)} /> : !categories.length || !zones.length ? <EmptyState title="Todavía no hay servicios o zonas habilitados." description="Vuelve a consultar el catálogo más adelante." /> : <form onSubmit={submit} aria-busy={busy || uploading} className="card p-5 sm:p-7 mt-5">
      <fieldset disabled={busy || uploading} className="space-y-5">
        <legend className="sr-only">Detalles de la solicitud</legend>
        <div className="ui-form-section space-y-5"><h2 className="font-disp font-bold flex items-center gap-2"><Icon name="wrench" className="w-4 h-4 text-pine" />El servicio</h2>
        <label htmlFor="request-category" className="block text-sm font-bold">Servicio<select id="request-category" required value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={inputClass}><option value="">Selecciona un servicio</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label htmlFor="request-description" className="block text-sm font-bold">Describe el problema<textarea id="request-description" placeholder="Qué ocurre y qué trabajo necesitas realizar…" value={description} onChange={(event) => setDescription(event.target.value)} required minLength={1} maxLength={2000} rows={4} className={inputClass} /></label>
        </div><div className="ui-form-section space-y-5"><h2 className="font-disp font-bold flex items-center gap-2"><Icon name="calendar" className="w-4 h-4 text-pine" />Cuándo y dónde</h2>
        <label htmlFor="request-when" className="block text-sm font-bold">Cuándo<select id="request-when" value={when} onChange={(event) => setWhen(event.target.value as typeof when)} className={inputClass}><option value="now">Lo antes posible</option><option value="scheduled">Programar</option><option value="quote">Solicitar cotización</option></select></label>
        {when === "scheduled" && <label htmlFor="request-scheduled" className="block text-sm font-bold">Fecha y hora<input id="request-scheduled" type="datetime-local" required value={scheduled} onChange={(event) => setScheduled(event.target.value)} className={inputClass} /></label>}
        <label htmlFor="request-address" className="block text-sm font-bold">Dirección guardada<select id="request-address" value={addressId} onChange={(event) => { const address = addresses.find((item) => item.id === event.target.value); setAddressId(event.target.value); if (address) setZoneId(address.zone_id); }} className={inputClass}><option value="">Elegir solo zona</option>{addresses.filter((address) => zones.some((zone) => zone.id === address.zone_id)).map((address) => <option key={address.id} value={address.id}>{address.label} · {address.line}</option>)}</select></label>
        <label htmlFor="request-zone" className="block text-sm font-bold">Zona<select id="request-zone" value={zoneId} onChange={(event) => { setZoneId(event.target.value); setAddressId(""); }} required className={inputClass}><option value="">Selecciona una zona</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label>
        </div><div className="ui-form-section space-y-5"><h2 className="font-disp font-bold flex items-center gap-2"><Icon name="camera" className="w-4 h-4 text-pine" />Detalles adicionales</h2><p className="text-xs text-mut">Puedes adjuntar imágenes del problema. No incluyas documentos ni información sensible.</p>
        <label htmlFor="request-photo" className="block text-sm font-bold">Fotos opcionales (máximo 3)<input id="request-photo" type="file" accept="image/jpeg,image/png" disabled={photos.length >= 3} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void upload(file); }} className="block mt-3 text-sm max-w-full" /></label>
        {photos.map((photo, index) => <div key={photo.id} className="flex gap-3 items-center text-sm"><span>Foto {index + 1} adjunta</span><button type="button" className="btn-ghost h-11 px-4" onClick={() => setPhotos((previous) => previous.filter((item) => item.id !== photo.id))}>Quitar</button></div>)}
        </div>
      </fieldset>
      {uploading && <p role="status" className="mt-4">Subiendo foto…</p>}
      {error && <p role="alert" className="text-cor mt-4">{error}</p>}
      <button type="submit" disabled={busy || uploading || !description.trim()} className="btn-pine h-12 px-5 w-full mt-5 disabled:opacity-50">{busy ? "Enviando…" : "Enviar solicitud"}</button>
    </form>}
  </main>;
}
