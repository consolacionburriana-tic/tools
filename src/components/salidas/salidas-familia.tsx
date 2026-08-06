'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bus,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleSlash,
  Clock,
  FileUp,
  Link2,
  Loader2,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { stepAnim } from '@/lib/motion';

interface Hijo {
  eduStudentId: string;
  maskedName: string;
  curso: string | null;
  letra: string | null;
  /** Entrada manual: la familia no se encontró y tecleó clase + nombre */
  manual?: boolean;
}
interface ClaseOpt {
  curso: string;
  letra: string | null;
  label: string;
}
interface Trip {
  tripId: string;
  nombre: string;
  descripcion: string | null;
  fecha: string | null;
  importe: string | null;
  estado: 'pendiente' | 'no_va' | 'subido' | 'validado' | 'rechazado';
}

function claseDe(h: Hijo): string {
  if (!h.curso) return '';
  return h.letra && h.letra !== 'PDC' ? `${h.curso} ${h.letra}` : h.curso;
}

function fechaBonita(fecha: string | null): string | null {
  if (!fecha) return null;
  return new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

function EstadoChip({ estado }: { estado: Trip['estado'] }) {
  const map = {
    pendiente: { icon: Clock, texto: 'Justificante pendiente', clase: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
    subido: { icon: Check, texto: 'Justificante enviado', clase: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
    validado: { icon: CheckCircle2, texto: 'Justificante validado', clase: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
    rechazado: { icon: TriangleAlert, texto: 'Revisa el justificante', clase: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
    no_va: { icon: CircleSlash, texto: 'No irá', clase: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300' },
  }[estado];
  const Icon = map.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${map.clase}`}>
      <Icon className="h-3.5 w-3.5" /> {map.texto}
    </span>
  );
}

export function SalidasFamilia({ tokenAcceso = null }: { tokenAcceso?: string | null }) {
  const [identificador, setIdentificador] = useState('');
  // Acceso por enlace: el token hace de identificador en todas las llamadas. Si el enlace ya
  // no identifica a nadie (revocado/caducado), lo soltamos y caemos al DNI/NIA de siempre.
  const [token, setToken] = useState<string | null>(tokenAcceso);
  const [tokenInvalido, setTokenInvalido] = useState(false);
  const autoElegido = useRef(false);
  const [buscando, setBuscando] = useState(false);
  const [hijos, setHijos] = useState<Hijo[] | null>(null);
  const [hijo, setHijo] = useState<Hijo | null>(null);
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState<'subido' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  // Camino manual ("no me encuentra")
  const [modoManual, setModoManual] = useState(false);
  const [clases, setClases] = useState<ClaseOpt[] | null>(null);
  const [claseManual, setClaseManual] = useState<ClaseOpt | null>(null);
  const [nombreManual, setNombreManual] = useState('');

  async function abrirManual() {
    setModoManual(true);
    if (clases === null) {
      try {
        const res = await fetch('/api/salidas/clases');
        const data = await res.json();
        setClases(data.clases ?? []);
      } catch {
        setClases([]);
      }
    }
  }

  async function continuarManual() {
    if (!claseManual || nombreManual.trim().length < 5) {
      toast.error('Elige la clase y escribe el nombre completo del alumno/a');
      return;
    }
    const h: Hijo = {
      eduStudentId: '',
      maskedName: nombreManual.trim(),
      curso: claseManual.curso,
      letra: claseManual.letra,
      manual: true,
    };
    setHijo(h);
    setTrips(null);
    setHecho(null);
    try {
      const res = await fetch('/api/salidas/estado-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curso: claseManual.curso, letra: claseManual.letra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const lista: Trip[] = data.trips ?? [];
      setTrips(lista);
      if (lista.length === 1) setTrip(lista[0]);
      haptic.tap();
    } catch {
      toast.error('No se pudieron cargar las salidas. Inténtalo de nuevo.');
      setHijo(null);
    }
  }

  const identificadorActivo = (token ?? identificador).trim();

  // Buscar hijos con debounce (inmediato si viene de un enlace, sin esperar a que "deje de teclear")
  useEffect(() => {
    const q = identificadorActivo;
    const handle = setTimeout(async () => {
      if (q.length < 5) {
        setHijos(null);
        setBuscando(false);
        return;
      }
      setBuscando(true);
      try {
        const res = await fetch('/api/salidas/identify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identificador: q }),
        });
        const data = await res.json();
        const encontrados: Hijo[] = res.ok ? (data.hijos ?? []) : [];
        setHijos(encontrados);
        if (token && encontrados.length === 0) {
          setTokenInvalido(true);
          setToken(null); // enlace caducado: volvemos al DNI/NIA de siempre
        }
      } catch {
        setHijos([]);
      } finally {
        setBuscando(false);
      }
    }, q.length < 5 || token ? 0 : 350);
    return () => clearTimeout(handle);
  }, [identificadorActivo, token]);

  // Enlace con un solo hijo: entramos directos a sus salidas (un clic menos).
  useEffect(() => {
    if (!token || autoElegido.current) return;
    if (hijo || hijos?.length !== 1) return;
    autoElegido.current = true;
    void elegirHijo(hijos[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, hijos, hijo]);

  function entrarConDocumento() {
    setToken(null);
    setTokenInvalido(false);
    setHijos(null);
    setIdentificador('');
  }

  async function elegirHijo(h: Hijo) {
    setHijo(h);
    setTrips(null);
    setTrip(null);
    setHecho(null);
    try {
      const res = await fetch('/api/salidas/estado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador: identificadorActivo, eduStudentId: h.eduStudentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const lista: Trip[] = data.trips ?? [];
      setTrips(lista);
      if (lista.length === 1) setTrip(lista[0]);
      haptic.tap();
    } catch {
      toast.error('No se pudieron cargar las salidas. Inténtalo de nuevo.');
      setHijo(null);
    }
  }

  async function subir() {
    if (!hijo || !trip || !file) return;
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('identificador', identificadorActivo);
      if (hijo.manual) {
        fd.append('manualNombre', hijo.maskedName);
        fd.append('manualClase', `${hijo.curso ?? ''}${hijo.letra && hijo.letra !== 'PDC' ? ` ${hijo.letra}` : ''}`);
      } else {
        fd.append('eduStudentId', hijo.eduStudentId);
      }
      fd.append('tripId', trip.tripId);
      if (email.trim()) fd.append('email', email.trim());
      fd.append('file', file);
      const res = await fetch('/api/salidas/justificante', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo enviar');
      setHecho('subido');
      haptic.success();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
      haptic.warning();
    } finally {
      setEnviando(false);
    }
  }

  const paso: 'identificar' | 'salidas' | 'subir' | 'hecho' = hecho
    ? 'hecho'
    : trip
      ? 'subir'
      : hijo
        ? 'salidas'
        : 'identificar';

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {paso === 'identificar' && (
          <motion.div key="id" {...stepAnim}>
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Justificante de pago de salidas</h2>
              <p className="mt-2 text-sm text-zinc-500">
                Identifícate para ver las salidas activas de tu hijo/a y enviar el justificante de pago.
              </p>

              {tokenInvalido && (
                <div className="mt-4 flex gap-2 rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700/50 dark:bg-amber-500/10 dark:text-amber-200">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Tu enlace no ha podido identificar a ningún alumno (puede haber caducado). No pasa nada: entra
                    con el DNI/NIE del tutor o el NIA del alumno/a.
                  </span>
                </div>
              )}

              {token ? (
                <div className="mt-5 flex gap-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-500/10 dark:text-blue-100">
                  <Link2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Has entrado con <strong>tu enlace personal</strong>, no hace falta teclear ningún dato.
                    {hijos && hijos.length > 1 && ' Abajo tienes a tus hijos/as: elige por quién empiezas.'}
                  </span>
                </div>
              ) : (
                <>
                  <label className="mt-5 mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    DNI/NIE de la madre, padre o tutor legal — o NIA del alumno/a
                  </label>
                  <input
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                    placeholder="12345678A"
                    autoComplete="off"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 tracking-wide text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100"
                  />
                </>
              )}
              <div className="mt-3 min-h-[1.25rem]">
                {buscando && (
                  <p className="flex items-center gap-2 text-sm text-zinc-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> {token ? 'Entrando…' : 'Buscando…'}
                  </p>
                )}
                {!buscando && !token && hijos !== null && hijos.length === 0 && identificador.trim().length >= 5 && (
                  <p className="text-sm text-zinc-500">No encontramos ningún alumno con ese dato. Revisa el DNI o el NIA.</p>
                )}
              </div>
              {token && (
                <button
                  type="button"
                  onClick={entrarConDocumento}
                  className="mb-1 text-xs text-zinc-400 underline-offset-2 hover:text-zinc-600 hover:underline dark:hover:text-zinc-300"
                >
                  ¿Falta algún hijo/a? Entrar con DNI/NIE o NIA
                </button>
              )}
              {!modoManual && !token && (
                <button
                  type="button"
                  onClick={() => void abrirManual()}
                  className="mb-1 text-sm text-zinc-400 underline-offset-2 hover:text-zinc-600 hover:underline dark:hover:text-zinc-300"
                >
                  ¿No te encuentra? Introduce los datos a mano
                </button>
              )}

              {modoManual && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Sin problema: dinos la clase y el nombre y lo revisamos nosotros.
                    </p>
                    <p className="mb-3 mt-1 text-xs text-amber-700/80 dark:text-amber-300/80">
                      Solo salen las clases con salidas activas.
                    </p>
                    {clases === null ? (
                      <p className="flex items-center gap-2 text-sm text-zinc-400">
                        <Loader2 className="h-4 w-4 animate-spin" /> Cargando clases…
                      </p>
                    ) : clases.length === 0 ? (
                      <p className="text-sm text-zinc-500">Ahora mismo no hay ninguna salida activa.</p>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-1.5">
                          {clases.map((c) => (
                            <button
                              key={c.label}
                              type="button"
                              onClick={() => setClaseManual(c)}
                              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                                claseManual?.label === c.label
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700'
                              }`}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                        <input
                          value={nombreManual}
                          onChange={(e) => setNombreManual(e.target.value)}
                          placeholder="Nombre y apellidos del alumno/a"
                          className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100"
                        />
                        <button
                          type="button"
                          onClick={() => void continuarManual()}
                          className="mt-3 w-full rounded-xl bg-amber-500 px-4 py-2.5 font-semibold text-amber-950 hover:bg-amber-400"
                        >
                          Continuar
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              )}

              {hijos !== null && hijos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-400">
                    {hijos.length > 1 ? 'Selecciona a tu hijo/a' : 'Confirma al alumno/a'} (nombre abreviado por privacidad):
                  </p>
                  {hijos.map((h) => (
                    <button
                      key={h.eduStudentId}
                      type="button"
                      onClick={() => void elegirHijo(h)}
                      className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:bg-zinc-800"
                    >
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {h.maskedName}
                        <span className="ml-2 text-xs font-normal text-zinc-400">{claseDe(h)}</span>
                      </span>
                      <ChevronLeft className="h-4 w-4 rotate-180 text-zinc-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {paso === 'salidas' && hijo && (
          <motion.div key="salidas" {...stepAnim}>
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <button type="button" onClick={() => { setHijo(null); setTrips(null); }} className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                <ChevronLeft className="h-4 w-4" /> Cambiar de alumno
              </button>
              {hijo.manual && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                  Datos introducidos a mano: el equipo del cole los revisará al validar el justificante.
                </p>
              )}
              <h2 className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Salidas de {hijo.maskedName} <span className="text-sm font-normal text-zinc-400">{claseDe(hijo)}</span>
              </h2>
              {trips === null ? (
                <p className="mt-4 flex items-center gap-2 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
                </p>
              ) : trips.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-500">
                  Ahora mismo no hay ninguna salida activa para su clase. Si crees que debería haberla, contacta con el
                  tutor/a.
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {trips.map((t) => (
                    <button
                      key={t.tripId}
                      type="button"
                      onClick={() => setTrip(t)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:bg-zinc-800"
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold text-zinc-900 dark:text-zinc-100">{t.nombre}</span>
                        <span className="block text-xs text-zinc-400">
                          {fechaBonita(t.fecha) ?? 'fecha por concretar'}
                          {t.importe ? ` · ${t.importe} €` : ''}
                        </span>
                      </span>
                      <EstadoChip estado={t.estado} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {paso === 'subir' && hijo && trip && (
          <motion.div key="subir" {...stepAnim}>
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <button type="button" onClick={() => { setTrip(null); setFile(null); }} className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                <ChevronLeft className="h-4 w-4" /> {trips && trips.length > 1 ? 'Otras salidas' : 'Atrás'}
              </button>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{trip.nombre}</h2>
                  <p className="text-sm text-zinc-500">
                    {fechaBonita(trip.fecha) ?? 'fecha por concretar'}
                    {trip.importe ? ` · ${trip.importe} €` : ''} · {hijo.maskedName}
                  </p>
                </div>
                <EstadoChip estado={trip.estado} />
              </div>
              {trip.descripcion && <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{trip.descripcion}</p>}

              {trip.estado === 'validado' ? (
                <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  El justificante ya está validado. No hace falta nada más. 💚
                </p>
              ) : trip.estado === 'no_va' ? (
                <p className="mt-5 rounded-xl bg-zinc-100 px-4 py-3 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  El profesorado ha anotado que no irá a esta salida. Si es un error, subid igualmente el justificante
                  o habladlo con el tutor/a.
                </p>
              ) : null}

              {trip.estado !== 'validado' && (
                <>
                  <label
                    htmlFor="justificante"
                    className="mt-5 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 px-4 py-7 text-center hover:border-blue-400 hover:bg-blue-50/50 dark:border-zinc-700 dark:hover:border-blue-500 dark:hover:bg-blue-500/5"
                  >
                    <FileUp className={`h-7 w-7 ${file ? 'text-emerald-500' : 'text-zinc-400'}`} />
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {file ? file.name : trip.estado === 'subido' || trip.estado === 'rechazado' ? 'Sustituir justificante' : 'Foto o PDF del justificante de pago'}
                    </span>
                    <span className="text-xs text-zinc-400">jpg, png, heic o pdf · máx. 10 MB</span>
                  </label>
                  <input
                    ref={fileRef}
                    id="justificante"
                    type="file"
                    accept="image/jpeg,image/png,image/heic,image/heif,application/pdf"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />

                  <label className="mt-4 mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Tu email (opcional, para confirmarte la entrega)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tucorreo@ejemplo.com"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100"
                  />

                  <button
                    type="button"
                    onClick={() => void subir()}
                    disabled={!file || enviando}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                    Enviar justificante
                  </button>

                </>
              )}
            </div>
          </motion.div>
        )}

        {paso === 'hecho' && hijo && trip && (
          <motion.div key="hecho" {...stepAnim}>
            <div className="flex flex-col items-center rounded-3xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <motion.div initial={{ scale: 0, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
                <CheckCircle2 className="h-16 w-16 text-emerald-500" />
              </motion.div>
              <p className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">¡Justificante enviado!</p>
              <p className="mt-1 text-sm text-zinc-500">
                El equipo responsable de &quot;{trip.nombre}&quot; lo revisará.{' '}
                {email.trim() ? 'Te hemos enviado una confirmación por email.' : ''}
              </p>
              <button
                type="button"
                onClick={() => {
                  setHecho(null);
                  setTrip(null);
                  setFile(null);
                  void elegirHijo(hijo);
                }}
                className="mt-6 inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Bus className="h-4 w-4" /> Ver más salidas
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-center text-xs text-zinc-400">
        ¿Dudas? Escríbenos a{' '}
        <a href="mailto:tic@consolacionburriana.com" className="underline hover:text-zinc-600 dark:hover:text-zinc-300">
          tic@consolacionburriana.com
        </a>
      </p>
    </div>
  );
}
