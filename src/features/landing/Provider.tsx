import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/icons";
import { FadeUp, Toggle } from "../../components/ui/kit";
import { CATS, ZONES, setProAvailable } from "../../lib/state";
import { authApi } from "../../lib/api";
import { ApiHttpError } from "../../lib/http";
import { PATHS } from "../../lib/router";

const STEPS = ["Tu cuenta", "Tus servicios", "Tu zona", "Disponibilidad"];
const POPULAR_CATS = ["plomeria", "electricidad", "aire", "cerrajeria", "limpieza", "mecanica", "pintura", "ebanisteria", "camaras", "wifi", "grua", "fotografia"];

export function ProviderOnboarding() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pass, setPass] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [available, setAvailable] = useState(true);
  const [docSent, setDocSent] = useState(false);
  /** cuenta real creada en Neon, pendiente de verificación de correo */
  const [doneEmail, setDoneEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (arr: string[], v: string, set: (x: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const validEmail = /.+@.+\..+/.test(email.trim());
  const canNext =
    step === 0 ? name.trim().length >= 2 && validEmail && pass.length >= 8
    : step === 1 ? cats.length >= 1
    : step === 2 ? zones.length >= 1
    : true;

  const next = async () => {
    if (step < 3) { setStep(step + 1); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (busy) return;
    setBusy(true); setError(null);
    try {
      // F1.8: la cuenta se crea DE VERDAD en PostgreSQL/Neon vía Better Auth.
      // role queda "customer" en el servidor (input:false) — la capacidad de
      // proveedor se activa con provider_profile + verificación en F3.
      await authApi.signUp({ name: name.trim(), email: email.trim(), password: pass, ...(phone.trim() ? { phone: phone.trim() } : {}) });
      setProAvailable(available);
      setDoneEmail(email.trim());
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      const code = e instanceof ApiHttpError ? e.code : "ERROR";
      setError(
        code === "USER_ALREADY_EXISTS" ? "Este correo ya está registrado. Inicia sesión desde el inicio."
        : code === "RATE_LIMITED" ? "Demasiados intentos. Espera unos minutos."
        : e instanceof ApiHttpError ? e.message
        : "No pudimos crear tu cuenta. Inténtalo de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (doneEmail) {
    return (
      <div className="min-h-dvh grid place-items-center px-5">
        <FadeUp className="max-w-md w-full">
          <div className="card p-8 text-center">
            <span className="w-16 h-16 rounded-2xl bg-pinesoft text-pine grid place-items-center mx-auto">
              <Icon name="shield" className="w-8 h-8" strokeWidth={1.8} />
            </span>
            <h1 className="font-disp font-bold text-2xl tracking-tight text-ink mt-5">Tu cuenta fue creada</h1>
            <p className="text-[0.9rem] text-mut font-medium leading-relaxed mt-3">
              Confirmamos <strong className="text-ink">{doneEmail}</strong> en el sistema. Confirma tu correo con el enlace que recibas para activar tu sesión y entrar a tu panel.
            </p>
            <div className="card p-4 mt-5 text-left bg-tint/60 shadow-none">
              <p className="text-[0.74rem] text-mut font-semibold leading-relaxed">
                <span className="font-extrabold text-sun2">En Preview:</span> el enlace de verificación aparece en los <strong className="text-ink">Function Logs de Vercel</strong>. Una vez verifiques, podrás entrar al modo profesional desde tu perfil.
              </p>
            </div>
            <button onClick={() => nav(PATHS.home)} className="btn-pine w-full h-13 mt-6 text-[0.95rem]">
              Ir a iniciar sesión <Icon name="arrow" className="w-4.5 h-4.5" strokeWidth={2.2} />
            </button>
          </div>
        </FadeUp>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col">
      {/* header */}
      <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-md border-b border-line2">
        <div className="max-w-2xl mx-auto px-5 py-3.5 flex items-center gap-4">
          <button onClick={() => nav(PATHS.home)} className="w-10 h-10 grid place-items-center rounded-xl border border-line bg-card hover:border-pine transition-colors" aria-label="Volver al inicio">
            <Icon name="chevl" className="w-4.5 h-4.5" strokeWidth={2.4} />
          </button>
          <div className="flex-1">
            <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-soft">Registro de proveedor</p>
            <p className="font-disp font-bold text-[0.95rem] leading-tight">{STEPS[step]}</p>
          </div>
          <span className="text-[0.74rem] font-extrabold text-mut">{step + 1} / {STEPS.length}</span>
        </div>
        <div className="h-1 bg-line2">
          <div className="h-full bg-pine transition-all duration-500" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-5 py-10">
        <FadeUp key={step}>
          {step === 0 && (
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-sunsoft text-sun2 px-4 py-2 text-[0.74rem] font-extrabold">
                <Icon name="gift" className="w-4 h-4" strokeWidth={2} /> Programa Fundador: 3 meses de plan Pro gratis
              </span>
              <h1 className="font-disp font-bold text-[2rem] sm:text-4xl tracking-tight leading-[1.08] mt-5">
                Empieza a conseguir clientes hoy.
              </h1>
              <p className="text-mut font-medium leading-relaxed mt-4 max-w-md">
                Crea tu cuenta de profesional en menos de 2 minutos. Sin mensualidades mientras dura tu período Fundador.
              </p>

              <div className="space-y-3.5 mt-8">
                <Field label="Nombre completo">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Carlos Rodríguez" className={inputCls} />
                </Field>
                <Field label="Correo electrónico">
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="tu@correo.com" className={inputCls} />
                </Field>
                <Field label="Teléfono (opcional)">
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="809-555-0000" className={inputCls} />
                </Field>
                <Field label="Contraseña">
                  <input value={pass} onChange={(e) => setPass(e.target.value)} type="password" placeholder="Mínimo 8 caracteres" className={inputCls} />
                </Field>
                {error && (
                  <div className="rounded-xl bg-corsoft text-cor px-4 py-3 text-[0.8rem] font-bold flex items-start gap-2.5">
                    <Icon name="alert" className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2.2} />
                    <span>
                      {error}
                      {error.includes("ya está registrado") && (
                        <button type="button" onClick={() => nav(PATHS.home)} className="block underline underline-offset-2 mt-1 text-[0.76rem]">
                          Ir al inicio
                        </button>
                      )}
                    </span>
                  </div>
                )}
              </div>

              <div className="card p-4.5 p-5 mt-7 flex gap-3.5">
                <span className="w-10 h-10 rounded-xl bg-pinesoft text-pine grid place-items-center shrink-0"><Icon name="shield" className="w-5 h-5" strokeWidth={1.9} /></span>
                <p className="text-[0.84rem] text-mut font-semibold leading-relaxed">
                  Tu perfil mostrará insignias de <strong className="text-ink">identidad</strong> y <strong className="text-ink">teléfono verificado</strong>. Los perfiles verificados reciben hasta 3× más solicitudes.
                </p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h1 className="font-disp font-bold text-[2rem] sm:text-4xl tracking-tight leading-[1.08]">
                ¿Qué servicios ofreces?
              </h1>
              <p className="text-mut font-medium leading-relaxed mt-4 max-w-md">
                Selecciona al menos una categoría. Podrás añadir más después desde tu panel.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-8">
                {POPULAR_CATS.map((id) => {
                  const c = CATS.find((x) => x.id === id)!;
                  const on = cats.includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggle(cats, id, setCats)}
                      className={`card card-h p-4 flex items-center gap-3 text-left transition-all ${on ? "border-pine bg-pinesoft/70 shadow-none" : ""}`}
                    >
                      <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 transition-colors ${on ? "bg-pine text-white" : "bg-tint text-pine"}`}>
                        <Icon name={c.icon as never} className="w-5 h-5" strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[0.84rem] font-extrabold truncate">{c.name}</span>
                        <span className={`block text-[0.66rem] font-bold ${on ? "text-pine" : "text-soft"}`}>{on ? "Seleccionada" : "Tocar para elegir"}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[0.76rem] font-bold text-soft mt-5">
                {cats.length === 0 ? "Elige al menos 1 categoría" : `${cats.length} categoría${cats.length > 1 ? "s" : ""} seleccionada${cats.length > 1 ? "s" : ""} ✓`}
              </p>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="font-disp font-bold text-[2rem] sm:text-4xl tracking-tight leading-[1.08]">
                ¿Dónde trabajas?
              </h1>
              <p className="text-mut font-medium leading-relaxed mt-4 max-w-md">
                Solo recibirás solicitudes de tus zonas. Por ahora lanzamos en Santiago de los Caballeros.
              </p>
              <div className="flex flex-wrap gap-2.5 mt-8">
                {ZONES.map((z) => {
                  const on = zones.includes(z.id);
                  return (
                    <button
                      key={z.id}
                      onClick={() => toggle(zones, z.id, setZones)}
                      className={`chip px-4 py-2.5 text-[0.82rem] transition-all ${on ? "chip-on" : ""}`}
                    >
                      <Icon name="pin" className="w-4 h-4" strokeWidth={2.1} /> {z.name}
                      {on && <Icon name="check" className="w-3.5 h-3.5" strokeWidth={2.8} />}
                    </button>
                  );
                })}
              </div>
              <div className="card p-4.5 p-5 mt-7 flex gap-3.5">
                <span className="w-10 h-10 rounded-xl bg-sunsoft text-sun2 grid place-items-center shrink-0"><Icon name="pin" className="w-5 h-5" strokeWidth={1.9} /></span>
                <p className="text-[0.84rem] text-mut font-semibold leading-relaxed">
                  Próximamente: Santo Domingo, Puerto Plata y Punta Cana. Los fundadores de Santiago tendrán <strong className="text-ink">prioridad</strong> al abrir nuevas ciudades.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className="font-disp font-bold text-[2rem] sm:text-4xl tracking-tight leading-[1.08]">
                Disponibilidad y verificación
              </h1>
              <p className="text-mut font-medium leading-relaxed mt-4 max-w-md">
                Ya casi. Configura tu estado inicial y envía tu documento para activar la insignia de verificado.
              </p>

              <div className="card p-5 mt-8 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <span className={`w-11 h-11 rounded-2xl grid place-items-center ${available ? "bg-oksoft text-ok" : "bg-tint text-soft"}`}>
                    <Icon name="bolt" className="w-5.5 h-5.5" strokeWidth={1.9} />
                  </span>
                  <div>
                    <p className="font-disp font-bold">Estar disponible al entrar</p>
                    <p className="text-[0.76rem] text-soft font-semibold mt-0.5">Podrás cambiarlo cuando quieras con un toque.</p>
                  </div>
                </div>
                <Toggle on={available} onChange={setAvailable} label="Disponible" />
              </div>

              <div className="card p-5 mt-4">
                <div className="flex items-center gap-3.5">
                  <span className="w-11 h-11 rounded-2xl bg-pinesoft text-pine grid place-items-center shrink-0">
                    <Icon name="shield" className="w-5.5 h-5.5" strokeWidth={1.9} />
                  </span>
                  <div className="flex-1">
                    <p className="font-disp font-bold">Verificación de identidad</p>
                    <p className="text-[0.76rem] text-soft font-semibold mt-0.5">
                      {docSent ? "Documento recibido — revisamos en menos de 24 h." : "Sube tu cédula para la insignia ✓ Verificado."}
                    </p>
                  </div>
                  {docSent ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-oksoft text-ok px-3.5 py-2 text-[0.74rem] font-extrabold shrink-0">
                      <Icon name="check" className="w-4 h-4" strokeWidth={2.6} /> Enviado
                    </span>
                  ) : (
                    <button onClick={() => setDocSent(true)} className="btn-ghost h-10 px-4 text-[0.78rem] shrink-0">
                      Subir cédula
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-2xl bg-night text-ntxt p-5 mt-4 flex gap-3.5 relative overflow-hidden">
                <div className="absolute inset-0 mapgrid-dark opacity-40 pointer-events-none" aria-hidden />
                <span className="relative w-11 h-11 rounded-2xl bg-namber/15 text-namber grid place-items-center shrink-0"><Icon name="gift" className="w-5.5 h-5.5" strokeWidth={1.9} /></span>
                <div className="relative">
                  <p className="font-disp font-bold">Eres de los primeros 100 🎉</p>
                  <p className="text-[0.8rem] text-nmut font-semibold leading-relaxed mt-1">
                    Al completar tu registro recibes <strong className="text-namber">3 meses de plan Pro gratis</strong> y entras al Programa Fundador: refiere colegas verificados y gana meses extra.
                  </p>
                </div>
              </div>
            </div>
          )}
        </FadeUp>
      </main>

      {/* footer fijo */}
      <footer className="sticky bottom-0 z-40 bg-paper/90 backdrop-blur-md border-t border-line2">
        <div className="max-w-2xl mx-auto px-5 py-4 flex gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {step > 0 && (
            <button onClick={() => { setStep(step - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="btn-ghost h-13 px-5 text-[0.9rem]">
              Atrás
            </button>
          )}
          <button onClick={next} disabled={!canNext} className="btn-pine flex-1 h-13 text-[0.95rem]">
            {step < 3 ? (
              <>Continuar <Icon name="arrow" className="w-4.5 h-4.5" strokeWidth={2.2} /></>
            ) : (
              <>
                <Icon name="bolt" className="w-4.5 h-4.5" strokeWidth={2.2} />
                {available ? "Entrar al panel · Disponible" : "Entrar al panel"}
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[0.74rem] font-extrabold text-mut mb-1.5">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full h-13 rounded-xl border border-line bg-card px-4 font-semibold outline-none focus:border-pine transition-colors placeholder:text-soft/70";
