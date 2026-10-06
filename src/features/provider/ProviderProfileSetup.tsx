import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Icon } from "../../components/icons";
import { api } from "../../lib/api";
import { ApiHttpError } from "../../lib/http";
import { profileApi, type AddressZone } from "../../lib/profile-api";

export function ProviderProfileSetup({ onCreated, onBack }: { onCreated: () => void; onBack: () => void }) {
  const servicesHint = useId();
  const zonesHint = useId();
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [zones, setZones] = useState<AddressZone[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [zoneIds, setZoneIds] = useState<string[]>([]);
  const [businessName, setBusinessName] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setCatalogError(null);
    Promise.all([api.categories.list(), profileApi.zones()])
      .then(([nextCategories, nextZones]) => {
        if (!mounted) return;
        setCategories(nextCategories);
        setZones(nextZones);
        setCategoryIds((current) => current.filter((id) => nextCategories.some((category) => category.id === id)));
        setZoneIds((current) => current.filter((id) => nextZones.some((zone) => zone.id === id)));
      })
      .catch((reason: unknown) => {
        if (mounted) setCatalogError(reason instanceof ApiHttpError ? reason.message : "No pudimos cargar los servicios y zonas.");
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [reload]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current || loading || catalogError || categoryIds.length === 0 || zoneIds.length === 0) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await api.providers.create({
        ...(businessName.trim() ? { business_name: businessName.trim() } : {}),
        bio: bio.trim(), category_ids: categoryIds, zone_ids: zoneIds,
      });
      onCreated();
    } catch (reason: unknown) {
      setError(reason instanceof ApiHttpError ? reason.message : "No pudimos crear tu perfil profesional. Inténtalo de nuevo.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <main data-theme="dark" className="min-h-dvh bg-night text-ntxt px-4 sm:px-6 py-8 sm:py-12">
      <div className="max-w-2xl mx-auto">
        <header className="mb-7">
          <span className="w-14 h-14 rounded-2xl bg-namber/10 border border-namber/20 grid place-items-center" aria-hidden="true"><Icon name="wrench" className="w-7 h-7 text-namber" strokeWidth={1.7} /></span>
          <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.18em] text-namber mt-5">Altoque Pro · Tu perfil</p>
          <h1 className="font-disp font-bold text-[1.8rem] sm:text-[2.1rem] leading-tight mt-2">Completa tu perfil profesional</h1>
          <p className="text-[0.88rem] text-nmut leading-relaxed max-w-xl mt-3">Usaremos tu cuenta actual. Selecciona tus servicios y zonas; tu perfil quedará pendiente de aprobación antes de poder recibir trabajos.</p>
        </header>
        <div className="ncard p-5 sm:p-7">
        {loading ? (
          <div className="py-6" role="status" aria-busy="true">
            <p className="text-nmut text-sm">Cargando servicios y zonas…</p>
            <div className="space-y-3 mt-5 animate-pulse motion-reduce:animate-none" aria-hidden="true">
              <div className="h-12 bg-nsurf rounded-xl" /><div className="h-12 bg-nsurf rounded-xl" /><div className="h-12 bg-nsurf rounded-xl w-2/3" />
            </div>
          </div>
        ) : catalogError ? (
          <div className="rounded-2xl border border-cor/30 bg-cor/5 p-5" role="alert">
            <p className="font-bold text-sm">No pudimos cargar el catálogo</p>
            <p className="text-[0.85rem] text-nmut leading-relaxed mt-2">{catalogError}</p>
            <button type="button" onClick={() => setReload((value) => value + 1)} className="btn-ghost-dark h-11 px-5 mt-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-namber">Reintentar</button>
          </div>
        ) : categories.length === 0 || zones.length === 0 ? (
          <div className="py-6 text-center" role="status">
            <Icon name="layers" className="w-8 h-8 text-namber mx-auto" aria-hidden="true" />
            <p className="font-disp font-bold mt-4">El catálogo todavía no está disponible</p>
            <p className="text-sm text-nmut leading-relaxed mt-2">Todavía no hay servicios o zonas habilitados. Podrás completar tu perfil cuando estén disponibles.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-7" aria-busy={busy}>
            <div className="flex items-center gap-3 pb-4 border-b border-nline"><Icon name="user" className="w-5 h-5 text-namber" aria-hidden="true" /><h2 className="font-disp font-bold text-lg">Presenta tu negocio</h2></div>
            <label className="block text-[0.85rem] font-bold">
              Nombre del negocio (opcional)
              <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} maxLength={100} autoComplete="organization" disabled={busy} className="w-full min-h-12 bg-nsurf border border-nline rounded-xl px-4 py-3 mt-2 font-medium placeholder:text-nmut/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-namber" placeholder="Cómo conocen los clientes tu negocio" />
            </label>
            <label className="block text-[0.85rem] font-bold">
              Acerca de tus servicios (opcional)
              <textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={600} rows={4} disabled={busy} className="w-full bg-nsurf border border-nline rounded-xl px-4 py-3 mt-2 font-medium leading-relaxed resize-y placeholder:text-nmut/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-namber" placeholder="Cuenta qué haces y cómo ayudas a tus clientes" />
              <span className="block text-xs font-medium text-nmut mt-2">Hasta 600 caracteres. Evita incluir datos personales que no quieras publicar.</span>
            </label>
            <fieldset disabled={busy} aria-describedby={servicesHint} className="min-w-0 border-t border-nline pt-5">
              <legend className="font-disp text-base font-bold pr-3">Servicios que ofreces</legend>
              <p id={servicesHint} className="text-xs text-nmut mt-1">Selecciona al menos un servicio que puedas ofrecer.</p>
              <p className="text-xs font-bold text-namber mt-2" aria-live="polite">{categoryIds.length} {categoryIds.length === 1 ? "servicio seleccionado" : "servicios seleccionados"}</p>
              <div className="grid sm:grid-cols-2 gap-2 mt-3">
                {categories.map((category) => (
                  <label key={category.id} className={`flex items-center gap-3 min-h-13 border rounded-xl px-4 py-3 text-[0.82rem] cursor-pointer transition-colors ${categoryIds.includes(category.id) ? "border-namber/50 bg-namber/5" : "border-nline bg-nsurf hover:border-namber/30"}`}>
                    <input type="checkbox" className="w-5 h-5 shrink-0 accent-namber focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-namber" checked={categoryIds.includes(category.id)} onChange={(event) => setCategoryIds((current) => event.target.checked ? [...current, category.id] : current.filter((id) => id !== category.id))} />
                    <span className="break-words leading-snug">{category.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset disabled={busy} aria-describedby={zonesHint} className="min-w-0 border-t border-nline pt-5">
              <legend className="font-disp text-base font-bold pr-3">Zonas donde trabajas</legend>
              <p id={zonesHint} className="text-xs text-nmut mt-1">Selecciona al menos una zona donde puedas atender.</p>
              <p className="text-xs font-bold text-namber mt-2" aria-live="polite">{zoneIds.length} {zoneIds.length === 1 ? "zona seleccionada" : "zonas seleccionadas"}</p>
              <div className="grid sm:grid-cols-2 gap-2 mt-3">
                {zones.map((zone) => (
                  <label key={zone.id} className={`flex items-center gap-3 min-h-13 border rounded-xl px-4 py-3 text-[0.82rem] cursor-pointer transition-colors ${zoneIds.includes(zone.id) ? "border-namber/50 bg-namber/5" : "border-nline bg-nsurf hover:border-namber/30"}`}>
                    <input type="checkbox" className="w-5 h-5 shrink-0 accent-namber focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-namber" checked={zoneIds.includes(zone.id)} onChange={(event) => setZoneIds((current) => event.target.checked ? [...current, zone.id] : current.filter((id) => id !== zone.id))} />
                    <span className="break-words leading-snug">{zone.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {error && <p role="alert" className="text-[0.85rem] text-[#ffad99] border border-cor/30 bg-cor/5 rounded-xl p-4 leading-relaxed">{error}</p>}
            <div className="border-t border-nline pt-5">
              <p className="text-xs text-nmut leading-relaxed mb-4">Revisa tus selecciones antes de enviar. La disponibilidad se habilita después de la aprobación del perfil.</p>
              <button type="submit" disabled={busy || categoryIds.length === 0 || zoneIds.length === 0} className="w-full min-h-12 px-4 py-3 rounded-xl bg-namber text-[#33230a] font-extrabold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-namber">{busy ? "Guardando perfil…" : "Enviar perfil para revisión"}</button>
            </div>
          </form>
        )}
        <button type="button" disabled={busy} onClick={onBack} className="btn-ghost-dark w-full h-12 mt-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-namber">Volver a mi perfil</button>
        </div>
      </div>
    </main>
  );
}
