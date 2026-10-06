import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/icons";
import { ApiHttpError } from "../../lib/http";
import { profileApi, type AddressInput, type AddressZone, type SavedAddress } from "../../lib/profile-api";
import { EmptyState, ErrorState, LoadingState, PageIntro } from "../../components/ui/feedback";

const blankAddress = (): AddressInput => ({ label: "", line: "", zone_id: "" });
const failure = (error: unknown) => error instanceof ApiHttpError
  ? error.message
  : "No pudimos completar la operación. Inténtalo nuevamente.";

export function AddressList({ addresses, loading, error, onRetry, onEdit, onDelete, disabled = false }: {
  addresses: SavedAddress[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onEdit: (address: SavedAddress) => void;
  onDelete: (address: SavedAddress) => void;
  disabled?: boolean;
}) {
  if (loading) return <LoadingState label="Cargando direcciones…" />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (addresses.length === 0) return <EmptyState icon="pin" title="Aún no tienes direcciones" description="Guarda tu casa o lugar de trabajo para tener sus datos a mano." />;
  return (
    <div className="space-y-3 mt-5">
      {addresses.map((address) => (
        <section key={address.id} className="card p-5 sm:p-6 relative">
          <span className="ui-icon-tile mb-4"><Icon name="pin" /></span>
          <h2 className="font-disp font-bold text-lg break-words">{address.label}</h2>
          <p className="text-sm text-mut mt-2 whitespace-pre-wrap break-words">{address.line}</p>
          <p className="text-xs text-soft font-semibold mt-2">{address.zone.name} · {address.zone.municipality}</p>
          <div className="ui-action-row mt-4">
            <button disabled={disabled} className="btn-ghost h-11 px-4 disabled:opacity-50" onClick={() => onEdit(address)} aria-label={`Editar ${address.label}`}>Editar</button>
            <button disabled={disabled} className="btn-ghost h-11 px-4 text-cor disabled:opacity-50" onClick={() => onDelete(address)} aria-label={`Eliminar ${address.label}`}>Eliminar</button>
          </div>
        </section>
      ))}
    </div>
  );
}

export function AddressesPage() {
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [zones, setZones] = useState<AddressZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AddressInput>(blankAddress);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState<SavedAddress | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError("");
    Promise.all([profileApi.addresses.list(), profileApi.zones()])
      .then(([saved, catalog]) => {
        if (!alive) return;
        setAddresses(saved);
        setZones(catalog);
      })
      .catch((error: unknown) => { if (alive) setLoadError(failure(error)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [version]);

  const openForm = (address: SavedAddress | null) => {
    if (busy) return;
    setEditing(address);
    setForm(address ? { label: address.label, line: address.line, zone_id: address.zone_id } : blankAddress());
    setFormError("");
    setMessage("");
    setDeleting(null);
    setFormOpen(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setFormError("");
    if (!zones.some((zone) => zone.id === form.zone_id)) {
      setFormError("Selecciona una zona disponible.");
      return;
    }
    setBusy(true);
    try {
      const input = { ...form, label: form.label.trim(), line: form.line.trim() };
      const saved = editing
        ? await profileApi.addresses.update(editing.id, input)
        : await profileApi.addresses.create(input);
      setAddresses((previous) => editing
        ? previous.map((address) => address.id === saved.id ? saved : address)
        : [...previous, saved]);
      setFormOpen(false);
      setEditing(null);
      setForm(blankAddress());
      setMessage("Dirección guardada.");
    } catch (error) {
      setFormError(failure(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting || busy) return;
    setBusy(true);
    setDeleteError("");
    try {
      await profileApi.addresses.remove(deleting.id);
      setAddresses((previous) => previous.filter((address) => address.id !== deleting.id));
      setDeleting(null);
      setMessage("Dirección eliminada.");
    } catch (error) {
      setDeleteError(failure(error));
    } finally {
      setBusy(false);
    }
  };

  const inputClass = "mt-2 w-full rounded-xl border border-line2 bg-card p-3 text-ink focus:outline-none focus:ring-2 focus:ring-pine";
  return (
    <main className="max-w-2xl mx-auto px-5 pb-10 pt-6 sm:pt-8 animate-fadein">
      <button className="btn-ghost h-11 px-4 mb-4" onClick={() => navigate("/app/perfil")}><Icon name="chevl" className="w-4 h-4" /> Volver al perfil</button>
      <PageIntro eyebrow="Tu cuenta · direcciones" title="Mis direcciones" description="Estas direcciones son privadas y se guardan en tu cuenta." />
      {message && <p role="status" className="mt-4 text-ok font-semibold">{message}</p>}
      {!loading && !loadError && (
        <button disabled={busy || zones.length === 0} onClick={() => openForm(null)} className="btn-pine mt-5 px-5 h-11 disabled:opacity-50">Agregar dirección</button>
      )}
      {!loading && !loadError && zones.length === 0 && <p role="status" className="mt-3 text-sm text-mut">No hay zonas disponibles para guardar direcciones.</p>}

      {formOpen && (
        <form onSubmit={save} className="card p-5 mt-5">
          <h2 className="font-disp font-bold text-lg">{editing ? "Editar dirección" : "Nueva dirección"}</h2>
          <fieldset disabled={busy} className="space-y-4 mt-4">
            <label className="block text-sm font-bold" htmlFor="address-label">Nombre de la dirección
              <input id="address-label" value={form.label} onChange={(event) => setForm((old) => ({ ...old, label: event.target.value }))} required maxLength={80} placeholder="Casa, trabajo…" className={inputClass} />
            </label>
            <label className="block text-sm font-bold" htmlFor="address-line">Dirección y referencias
              <textarea id="address-line" value={form.line} onChange={(event) => setForm((old) => ({ ...old, line: event.target.value }))} required maxLength={500} rows={3} autoComplete="street-address" className={inputClass} />
            </label>
            <label className="block text-sm font-bold" htmlFor="address-zone">Zona
              <select id="address-zone" value={form.zone_id} onChange={(event) => setForm((old) => ({ ...old, zone_id: event.target.value }))} required className={inputClass}>
                <option value="">Selecciona una zona</option>
                {editing && !zones.some((zone) => zone.id === editing.zone_id) && <option value={editing.zone_id} disabled>{editing.zone.name} (no disponible)</option>}
                {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name} · {zone.municipality}</option>)}
              </select>
            </label>
          </fieldset>
          {formError && <p role="alert" className="text-cor text-sm mt-4">{formError}</p>}
          <div className="ui-action-row mt-5">
            <button type="submit" disabled={busy} className="btn-pine h-11 px-5 disabled:opacity-50">{busy ? "Guardando…" : "Guardar dirección"}</button>
            <button type="button" disabled={busy} onClick={() => setFormOpen(false)} className="btn-ghost h-11 px-4">Cancelar</button>
          </div>
        </form>
      )}

      {deleting && (
        <section role="alert" className="card p-5 mt-5 border-cor/30">
          <h2 className="font-bold">¿Eliminar “{deleting.label}”?</h2>
          <p className="text-sm text-mut mt-2">Esta dirección se quitará de tu cuenta.</p>
          {deleteError && <p className="text-cor text-sm mt-3">{deleteError}</p>}
          <div className="ui-action-row mt-4">
            <button onClick={remove} disabled={busy} className="btn-ghost h-11 px-4 text-cor">{busy ? "Eliminando…" : "Sí, eliminar"}</button>
            <button onClick={() => setDeleting(null)} disabled={busy} className="btn-ghost h-11 px-4">Cancelar</button>
          </div>
        </section>
      )}
      <AddressList addresses={addresses} loading={loading} error={loadError} disabled={busy} onRetry={() => setVersion((old) => old + 1)} onEdit={openForm} onDelete={(address) => {
        if (busy) return;
        setFormOpen(false);
        setDeleteError("");
        setMessage("");
        setDeleting(address);
      }} />
    </main>
  );
}
