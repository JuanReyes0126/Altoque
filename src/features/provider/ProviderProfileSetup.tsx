import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "../../components/icons";
import { api } from "../../lib/api";
import { ApiHttpError } from "../../lib/http";
import { profileApi, type AddressZone } from "../../lib/profile-api";

export function ProviderProfileSetup({ onCreated, onBack }: { onCreated: () => void; onBack: () => void }) {
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
    <div className="min-h-dvh bg-night text-ntxt px-5 py-10">
      <div className="max-w-xl mx-auto ncard p-6">
        <Icon name="wrench" className="w-8 h-8 text-namber" strokeWidth={1.7} />
        <h1 className="font-disp font-bold text-2xl mt-4">Completa tu perfil profesional</h1>
        <p className="text-[0.85rem] text-nmut mt-3">Usaremos tu cuenta actual. Selecciona tus servicios y zonas; tu perfil quedará pendiente de aprobación antes de poder recibir trabajos.</p>
        {loading ? <p className="py-8 text-nmut" role="status">Cargando servicios y zonas…</p> : catalogError ? (
          <div className="mt-5" role="alert">
            <p className="text-[0.85rem] text-nmut">{catalogError}</p>
            <button type="button" onClick={() => setReload((value) => value + 1)} className="btn-ghost-dark h-11 px-5 mt-3">Reintentar</button>
          </div>
        ) : categories.length === 0 || zones.length === 0 ? (
          <p className="py-6 text-nmut" role="status">Todavía no hay servicios o zonas habilitados. Podrás completar tu perfil cuando estén disponibles.</p>
        ) : (
          <form onSubmit={submit} className="space-y-5 mt-6">
            <label className="block text-[0.85rem] font-bold">
              Nombre del negocio (opcional)
              <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} maxLength={100} disabled={busy} className="w-full bg-nsurf border border-nline rounded-xl px-4 py-3 mt-2 font-medium" />
            </label>
            <label className="block text-[0.85rem] font-bold">
              Acerca de tus servicios (opcional)
              <textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={600} rows={3} disabled={busy} className="w-full bg-nsurf border border-nline rounded-xl px-4 py-3 mt-2 font-medium" />
            </label>
            <fieldset disabled={busy}>
              <legend className="text-[0.85rem] font-bold">Servicios que ofreces</legend>
              <div className="grid sm:grid-cols-2 gap-2 mt-3">
                {categories.map((category) => (
                  <label key={category.id} className="flex items-center gap-3 bg-nsurf rounded-xl p-3 text-[0.8rem]">
                    <input type="checkbox" checked={categoryIds.includes(category.id)} onChange={(event) => setCategoryIds((current) => event.target.checked ? [...current, category.id] : current.filter((id) => id !== category.id))} />
                    {category.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset disabled={busy}>
              <legend className="text-[0.85rem] font-bold">Zonas donde trabajas</legend>
              <div className="grid sm:grid-cols-2 gap-2 mt-3">
                {zones.map((zone) => (
                  <label key={zone.id} className="flex items-center gap-3 bg-nsurf rounded-xl p-3 text-[0.8rem]">
                    <input type="checkbox" checked={zoneIds.includes(zone.id)} onChange={(event) => setZoneIds((current) => event.target.checked ? [...current, zone.id] : current.filter((id) => id !== zone.id))} />
                    {zone.name}
                  </label>
                ))}
              </div>
            </fieldset>
            {error && <p role="alert" className="text-[0.85rem] text-cor">{error}</p>}
            <button type="submit" disabled={busy || categoryIds.length === 0 || zoneIds.length === 0} className="w-full h-12 rounded-xl bg-namber text-[#33230a] font-extrabold disabled:opacity-50">{busy ? "Guardando perfil…" : "Enviar perfil para revisión"}</button>
          </form>
        )}
        <button type="button" disabled={busy} onClick={onBack} className="btn-ghost-dark w-full h-11 mt-4">Volver a mi perfil</button>
      </div>
    </div>
  );
}
