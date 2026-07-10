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
  Loader2,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';

interface Hijo {
  eduStudentId: string;
  maskedName: string;
  curso: string | null;
  letra: string | null;
}
interface Trip {
  tripId: string;
  nombre: string;
  descripcion: string | null;
  fecha: string | null;
  importe: string | null;
  estado: 'pendiente' | 'no_va' | 'subido' | 'validado' | 'rechazado';
}

const stepAnim = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
  transition: { duration: 0.2 },
};

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

export function SalidasFamilia() {
  const [identificador, setIdentificador] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [hijos, setHijos] = useState<Hijo[] | null>(null);
  const [hijo, setHijo] = useState<Hijo | null>(null);
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState<'subido' | 'no_va' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  // Buscar hijos con debounce
  useEffect(() => {
    const q = identificador.trim();
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
        setHijos(res.ok ? (data.hijos ?? []) : []);
      } catch {
        setHijos([]);
      } finally {
        setBuscando(false);
      }
    }, q.length < 5 ? 0 : 350);
    return () => clearTimeout(handle);
  }, [identificador]);

  async function elegirHijo(h: Hijo) {
    setHijo(h);
    setTrips(null);
    setTrip(null);
    setHecho(null);
    try {
      const res = await fetch('/api/salidas/estado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador: identificador.trim(), eduStudentId: h.eduStudentId }),
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
      fd.append('identificador', identificador.trim());
      fd.append('eduStudentId', hijo.eduStudentId);
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

  async function noVa() {
    if (!hijo || !trip) return;
    if (!confirm(`¿Confirmas que ${hijo.maskedName} NO irá a "${trip.nombre}"?`)) return;
    setEnviando(true);
    try {
      const res = await fetch('/api/salidas/no-va', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador: identificador.trim(), eduStudentId: hijo.eduStudentId, tripId: trip.tripId }),
      });
      if (!res.ok) throw new Error();
      setHecho('no_va');
      haptic.success();
    } catch {
      toast.error('No se pudo guardar. Inténtalo de nuevo.');
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
              <div className="mt-3 min-h-[1.25rem]">
                {buscando && (
                  <p className="flex items-center gap-2 text-sm text-zinc-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
                  </p>
                )}
                {!buscando && hijos !== null && hijos.length === 0 && identificador.trim().length >= 5 && (
                  <p className="text-sm text-zinc-500">No encontramos ningún alumno con ese dato. Revisa el DNI o el NIA.</p>
                )}
              </div>
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
                  Marcasteis que no irá a esta salida. Si cambiáis de idea, subid el justificante y quedará apuntado/a.
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

                  {trip.estado === 'pendiente' && (
                    <button
                      type="button"
                      onClick={() => void noVa()}
                      disabled={enviando}
                      className="mt-3 w-full text-center text-sm text-zinc-400 underline-offset-2 hover:text-zinc-600 hover:underline dark:hover:text-zinc-300"
                    >
                      {hijo.maskedName} no irá a esta salida
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}

        {paso === 'hecho' && hijo && trip && (
          <motion.div key="hecho" {...stepAnim}>
            <div className="flex flex-col items-center rounded-3xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                {hecho === 'subido' ? (
                  <CheckCircle2 className="h-16 w-16 text-emerald-500" />
                ) : (
                  <CircleSlash className="h-16 w-16 text-zinc-400" />
                )}
              </motion.div>
              <p className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {hecho === 'subido' ? '¡Justificante enviado!' : 'Anotado: no irá'}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                {hecho === 'subido'
                  ? `El equipo responsable de "${trip.nombre}" lo revisará. ${email.trim() ? 'Te hemos enviado una confirmación por email.' : ''}`
                  : `Hemos registrado que ${hijo.maskedName} no irá a "${trip.nombre}".`}
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
