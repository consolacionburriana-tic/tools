'use client';

// El formulario del módulo. Una sola pantalla, tres decisiones (quién, qué asignatura, a
// qué hora) y guardar. Todo lo demás está escondido detrás de "Más datos" porque el 95 %
// de los registros son un alumno que llegó tarde sin justificar y no sube a clase.
//
// Cosas pensadas para que se use de verdad a las 8:05 con prisa:
//   · el buscador tiene el foco al abrir y Enter elige el primer resultado;
//   · se pueden encadenar varios alumnos (el mismo día/hora/asignatura) y personalizar
//     luego los datos de cualquiera de ellos;
//   · al seleccionar a alguien se carga su historial en vivo, porque saber si es el 4º de
//     este mes o el primero desde marzo cambia la conversación que toca tener con él;
//   · al guardar no se sale de la pantalla: se limpia el alumnado y se queda lista para el
//     siguiente, que es lo que pasa de verdad (llegan tres o cuatro seguidos).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronDown, Clock, Loader2, Minus, Plus, Search, TriangleAlert, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';

import { Historial, Seccion } from './ui';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { Aviso } from '@/components/ui/aviso';
import { BarraAcciones } from '@/components/ui/barra-acciones';
import { Button } from '@/components/ui/button';
import { Estado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Input } from '@/components/ui/input';
import { Interruptor } from '@/components/ui/interruptor';
import { Skeleton } from '@/components/ui/skeleton';
import { claseTarjeta } from '@/components/ui/tarjeta';
import { Textarea } from '@/components/ui/textarea';
import {
  JUSTIFICACION_TIPOS,
  fraseHistorial,
  formatoRetraso,
  horaAhora,
  horaDeMinutos,
  minutosDeHora,
  minutosRetraso,
  registroPayloadSchema,
  type JustificacionTipo,
  type ResumenHistorial,
} from '@/lib/puntualidad';
import type { AlumnoBusqueda } from '@/lib/puntualidad-server';
import { CONFIGURACION } from '@/lib/configuracion';

interface Asignatura {
  id: string;
  nombre: string;
  abreviatura: string | null;
}

interface Detalle {
  justificado: boolean;
  justificacionTipo: JustificacionTipo | null;
  justificacionNota: string;
  subeAClase: boolean;
  observaciones: string;
  subjectId: string | null;
  abierto: boolean;
}

interface Elegido {
  alumno: AlumnoBusqueda;
  detalle: Detalle;
  resumen: ResumenHistorial | null;
  /** Si ya tiene un retraso registrado en esta misma fecha: hora del que ya hay. */
  yaHoy: string | null;
}

/** Lo que se acaba de guardar, para que quede a la vista al terminar. */
interface Guardado {
  alumno: string;
  clase: string;
  total: number;
  conConsecuencia: boolean;
}

const detalleVacio = (): Detalle => ({
  justificado: false,
  justificacionTipo: null,
  justificacionNota: '',
  // Por defecto NO sube a clase: es lo que pasa siempre (decisión de David). Si el retraso
  // está justificado, se marca solo — que es el único caso en que sí sube.
  subeAClase: false,
  observaciones: '',
  subjectId: null,
  abierto: false,
});

const fechaCorta = (iso: string) => {
  try {
    return format(parseISO(iso), "d 'de' MMMM", { locale: es });
  } catch {
    return iso;
  }
};

export function PuntualidadForm({
  asignaturas,
  registradoPor,
}: {
  asignaturas: Asignatura[];
  registradoPor: string;
}) {
  const hoy = format(new Date(), 'yyyy-MM-dd');
  const [fecha, setFecha] = useState(hoy);
  const [hora, setHora] = useState(() => horaAhora());
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [elegidos, setElegidos] = useState<Elegido[]>([]);
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<AlumnoBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [resaltado, setResaltado] = useState(0);
  const [guardados, setGuardados] = useState<Guardado[]>([]);
  const buscadorRef = useRef<HTMLInputElement>(null);

  const retraso = minutosRetraso(hora);

  // ── Buscador ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(async () => {
      const q = query.trim();
      if (q.length < 2) {
        setResultados([]);
        setBuscando(false);
        return;
      }
      setBuscando(true);
      try {
        const res = await fetch(`/api/puntualidad/alumnos?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (vivo) {
          setResultados(res.ok ? (data.alumnos ?? []) : []);
          setResaltado(0);
        }
      } catch {
        if (vivo) setResultados([]);
      } finally {
        if (vivo) setBuscando(false);
      }
    }, 200);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [query]);

  const cargarHistorial = useCallback(
    async (eduStudentId: string, enFecha: string) => {
      try {
        const res = await fetch(`/api/puntualidad/historial/${eduStudentId}?fecha=${enFecha}`);
        if (!res.ok) return;
        const data = await res.json();
        const mismoDia = (data.retrasos ?? []).find((r: { fecha: string }) => r.fecha === enFecha);
        setElegidos((prev) =>
          prev.map((e) =>
            e.alumno.eduStudentId === eduStudentId
              ? { ...e, resumen: data.resumen, yaHoy: mismoDia?.hora ?? null }
              : e,
          ),
        );
      } catch {
        /* el historial es un extra: si falla, el registro se puede guardar igual */
      }
    },
    [],
  );

  const añadir = (alumno: AlumnoBusqueda) => {
    if (elegidos.some((e) => e.alumno.eduStudentId === alumno.eduStudentId)) {
      toast.info(`${alumno.nombre} ya está en la lista`);
      return;
    }
    haptic.tap();
    setElegidos((prev) => [...prev, { alumno, detalle: detalleVacio(), resumen: null, yaHoy: null }]);
    setQuery('');
    setResultados([]);
    buscadorRef.current?.focus();
    void cargarHistorial(alumno.eduStudentId, fecha);
  };

  const quitar = (eduStudentId: string) => {
    haptic.tap();
    setElegidos((prev) => prev.filter((e) => e.alumno.eduStudentId !== eduStudentId));
  };

  const cambiarDetalle = (eduStudentId: string, cambios: Partial<Detalle>) => {
    setElegidos((prev) =>
      prev.map((e) =>
        e.alumno.eduStudentId === eduStudentId ? { ...e, detalle: { ...e.detalle, ...cambios } } : e,
      ),
    );
  };

  // El resumen depende de la fecha del registro ("este mes"), así que al cambiarla se
  // recarga el historial de quien ya esté elegido. Se hace aquí, en el handler, y no en un
  // efecto: es una consecuencia de lo que acaba de tocar el profe, no una sincronización.
  const cambiarFecha = (nueva: string) => {
    setFecha(nueva);
    for (const e of elegidos) void cargarHistorial(e.alumno.eduStudentId, nueva);
  };

  const ajustarHora = (delta: number) => {
    haptic.tap();
    const actual = minutosDeHora(hora) ?? minutosDeHora(horaAhora()) ?? 0;
    setHora(horaDeMinutos(actual + delta));
  };

  const varios = elegidos.length > 1;
  const asignaturaNombre = useMemo(
    () => asignaturas.find((a) => a.id === subjectId)?.nombre ?? null,
    [asignaturas, subjectId],
  );

  // ── Guardar ─────────────────────────────────────────────────────────────────
  const guardar = async () => {
    const payload = {
      fecha,
      hora,
      subjectId,
      alumnos: elegidos.map((e) => ({
        eduStudentId: e.alumno.eduStudentId,
        subjectId: e.detalle.subjectId ?? subjectId ?? null,
        justificado: e.detalle.justificado,
        justificacionTipo: e.detalle.justificado ? e.detalle.justificacionTipo : null,
        justificacionNota: e.detalle.justificado ? e.detalle.justificacionNota || null : null,
        subeAClase: e.detalle.subeAClase,
        observaciones: e.detalle.observaciones || null,
      })),
    };

    const validado = registroPayloadSchema.safeParse(payload);
    if (!validado.success) {
      haptic.warning();
      toast.error(validado.error.issues[0]?.message ?? 'Revisa los datos');
      return;
    }

    setGuardando(true);
    try {
      const res = await fetch('/api/puntualidad/registros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validado.data),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error del servidor');

      await haptic.success();
      type Resultado = {
        alumno: string;
        clase: string;
        total: number;
        esteMes: number;
        duplicado: boolean;
        consecuencia: { avisados: string[] } | null;
      };
      const resultados: Resultado[] = data.resultados ?? [];

      for (const r of resultados) {
        const detalle = `${r.total}º del curso · ${r.esteMes} este mes`;
        if (r.consecuencia) {
          toast.warning(`${r.alumno} · ${detalle}`, {
            description:
              r.consecuencia.avisados.length > 0
                ? `Tercer retraso: aviso enviado a ${r.consecuencia.avisados.join(', ')} para poner el día sin patio.`
                : 'Tercer retraso: consecuencia creada. No hay tutor con correo, ponla desde el panel.',
            duration: 9000,
          });
        } else if (r.duplicado) {
          toast.warning(`${r.alumno} · guardado`, {
            description: `Ojo: ya tenía otro retraso registrado el ${fechaCorta(fecha)}.`,
            duration: 7000,
          });
        } else {
          toast.success(`${r.alumno} · guardado`, { description: detalle });
        }
      }

      setGuardados(
        resultados.map((r) => ({
          alumno: r.alumno,
          clase: r.clase,
          total: r.total,
          conConsecuencia: Boolean(r.consecuencia),
        })),
      );
      // Listo para el siguiente: se mantienen fecha, hora y asignatura (llegan en fila).
      setElegidos([]);
      setQuery('');
      setResultados([]);
      buscadorRef.current?.focus();
    } catch (error) {
      await haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-8 pb-4">
      {/* ── Quién ─────────────────────────────────────────────────────────── */}
      <Seccion paso={1} titulo="Quién ha llegado tarde">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400"
          />
          <Input
            ref={buscadorRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (resultados.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setResaltado((i) => (i + 1) % resultados.length);
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setResaltado((i) => (i - 1 + resultados.length) % resultados.length);
                  return;
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  añadir(resultados[resaltado] ?? resultados[0]);
                  return;
                }
              }
              if (e.key === 'Escape') setQuery('');
            }}
            role="combobox"
            aria-label="Buscar alumno"
            aria-expanded={resultados.length > 0}
            aria-controls="pun-resultados"
            aria-autocomplete="list"
            placeholder="Nombre o apellido…"
            enterKeyHint="done"
            autoComplete="off"
            className="h-12 pr-12 pl-10"
          />
          {buscando && (
            <Loader2
              aria-hidden
              className="absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-500 dark:text-zinc-400"
            />
          )}
          {!buscando && query.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setQuery('')}
              className="absolute top-1/2 right-1 -translate-y-1/2"
              aria-label="Limpiar la búsqueda"
            >
              <X />
            </Button>
          )}
        </div>

        <AnimatePresence>
          {resultados.length > 0 && (
            <motion.ul
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              id="pun-resultados"
              role="listbox"
              className={cn(claseTarjeta, 'divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800')}
            >
              {resultados.map((a, i) => {
                const activo = i === resaltado;
                return (
                  <li key={a.eduStudentId} role="option" aria-selected={activo}>
                    <button
                      type="button"
                      onClick={() => añadir(a)}
                      onMouseEnter={() => setResaltado(i)}
                      className={cn(
                        'flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset',
                        activo ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60',
                      )}
                    >
                      <UserPlus aria-hidden className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {a.nombre}
                      </span>
                      <Etiqueta>{a.clase}</Etiqueta>
                    </button>
                  </li>
                );
              })}
            </motion.ul>
          )}
          {!buscando && query.trim().length >= 2 && resultados.length === 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
            >
              Nadie de secundaria con ese nombre. (El módulo lleva solo secundaria.)
            </motion.p>
          )}
        </AnimatePresence>
        {resultados.length > 1 && (
          <p className="hidden text-xs text-zinc-500 sm:block dark:text-zinc-400">
            ↑ ↓ para moverte · Enter para añadir · se pueden añadir varios
          </p>
        )}

        {/* Alumnado elegido */}
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {elegidos.map((e) => {
              // Cuando el registro va a cerrar el ciclo de tres, la tarjeta entera lo
              // avisa (borde rojo): es la información que cambia la conversación.
              const cierra = e.resumen?.faltanParaConsecuencia === 0 && !e.detalle.justificado;
              const nombreCorto = e.alumno.nombre.split(' ')[0];
              return (
                <motion.div
                  key={e.alumno.eduStudentId}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className={cn(
                    claseTarjeta,
                    'overflow-hidden',
                    cierra && 'border-red-300 ring-1 ring-red-200 dark:border-red-500/50 dark:ring-red-500/20',
                  )}
                >
                  <div className="flex items-start gap-3 p-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex min-h-10 items-center gap-2">
                        <span className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{e.alumno.nombre}</span>
                        <Etiqueta>{e.alumno.clase}</Etiqueta>
                      </div>
                      <div aria-live="polite">
                        {e.resumen ? (
                          <Historial tono={e.resumen.tono}>
                            {fraseHistorial(e.resumen, fechaCorta)}
                            {cierra && (
                              <strong className="mt-1 block">
                                Con este cierra el ciclo de tres: se avisará al tutor/a y le toca quedarse sin patio.
                              </strong>
                            )}
                            {e.resumen.justificados > 0 && (
                              <span className="mt-1 block text-xs opacity-80">
                                {e.resumen.justificados}{' '}
                                {e.resumen.justificados === 1 ? 'justificado' : 'justificados'} (no cuentan para el ciclo)
                              </span>
                            )}
                          </Historial>
                        ) : (
                          <Skeleton className="h-9 w-3/4 rounded-xl" />
                        )}
                      </div>
                      {e.yaHoy && (
                        <p className="flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-400">
                          <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                          Ya tiene un retraso guardado este día (a las {e.yaHoy}). Si es el mismo, quítalo de la lista.
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => quitar(e.alumno.eduStudentId)}
                      aria-label={`Quitar a ${e.alumno.nombre}`}
                    >
                      <X />
                    </Button>
                  </div>

                  {/* Datos opcionales, escondidos hasta que hagan falta */}
                  <button
                    type="button"
                    aria-expanded={e.detalle.abierto}
                    onClick={() => cambiarDetalle(e.alumno.eduStudentId, { abierto: !e.detalle.abierto })}
                    className="flex min-h-11 w-full items-center justify-between gap-2 border-t border-zinc-100 px-4 py-2 text-sm text-zinc-600 transition-colors outline-none hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      Más datos
                      {e.detalle.justificado && <Estado tono="ok">Justificado</Estado>}
                      {e.detalle.subeAClase && <Estado tono="info">Sube a clase</Estado>}
                    </span>
                    <ChevronDown
                      aria-hidden
                      className={cn('h-4 w-4 shrink-0 transition-transform', e.detalle.abierto && 'rotate-180')}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {e.detalle.abierto && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-3 border-t border-zinc-100 p-4 dark:border-zinc-800">
                          <Interruptor
                            activo={e.detalle.justificado}
                            etiqueta="Retraso justificado"
                            descripcion="Los justificados no cuentan para el ciclo de tres"
                            onChange={(v) =>
                              cambiarDetalle(e.alumno.eduStudentId, {
                                justificado: v,
                                justificacionTipo: v ? (e.detalle.justificacionTipo ?? 'familiar') : null,
                                // Si está justificado, lo normal es que sí suba a clase.
                                subeAClase: v ? true : e.detalle.subeAClase,
                              })
                            }
                          />
                          {e.detalle.justificado && (
                            <div className="space-y-2">
                              <Filtros etiqueta="Tipo de justificación">
                                {JUSTIFICACION_TIPOS.map((t) => (
                                  <Filtro
                                    key={t.value}
                                    activo={e.detalle.justificacionTipo === t.value}
                                    onClick={() => cambiarDetalle(e.alumno.eduStudentId, { justificacionTipo: t.value })}
                                  >
                                    {t.label}
                                  </Filtro>
                                ))}
                              </Filtros>
                              <Input
                                value={e.detalle.justificacionNota}
                                onChange={(ev) =>
                                  cambiarDetalle(e.alumno.eduStudentId, { justificacionNota: ev.target.value })
                                }
                                aria-label="Detalle de la justificación"
                                placeholder="Detalle de la justificación (opcional)"
                              />
                            </div>
                          )}
                          <Interruptor
                            activo={e.detalle.subeAClase}
                            etiqueta="Sube a clase"
                            onChange={(v) => cambiarDetalle(e.alumno.eduStudentId, { subeAClase: v })}
                          />
                          <Textarea
                            value={e.detalle.observaciones}
                            onChange={(ev) => cambiarDetalle(e.alumno.eduStudentId, { observaciones: ev.target.value })}
                            aria-label="Observaciones"
                            placeholder="Observaciones (opcional)"
                            className="min-h-20"
                          />
                          {varios && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Asignatura solo para {nombreCorto}
                              </p>
                              <Filtros etiqueta={`Asignatura solo para ${nombreCorto}`}>
                                {asignaturas.map((a) => (
                                  <Filtro
                                    key={a.id}
                                    activo={e.detalle.subjectId === a.id}
                                    onClick={() =>
                                      cambiarDetalle(e.alumno.eduStudentId, {
                                        subjectId: e.detalle.subjectId === a.id ? null : a.id,
                                      })
                                    }
                                  >
                                    {a.abreviatura ?? a.nombre}
                                  </Filtro>
                                ))}
                              </Filtros>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Lo que se acaba de guardar: los toast se van, esto se queda. */}
        {guardados.length > 0 && elegidos.length === 0 && (
          <Aviso tono="ok" titulo="Guardado">
            <ul className="mt-1.5 space-y-1.5">
              {guardados.map((g, i) => (
                <li key={`${g.alumno}-${i}`} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">{g.alumno}</span>
                  <Etiqueta>{g.clase}</Etiqueta>
                  <span className="shrink-0 text-xs tabular-nums">{g.total}º del curso</span>
                  {g.conConsecuencia && <Estado tono="error">Sin patio</Estado>}
                </li>
              ))}
            </ul>
          </Aviso>
        )}
      </Seccion>

      {/* ── Asignatura ────────────────────────────────────────────────────── */}
      <Seccion paso={2} titulo="En qué asignatura" aviso={varios ? 'obligatoria al registrar varios' : undefined}>
        {asignaturas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            No hay asignaturas configuradas. Se añaden en el panel de gestión.
          </p>
        ) : (
          <Filtros etiqueta="Asignatura">
            {asignaturas.map((a) => (
              <Filtro
                key={a.id}
                activo={subjectId === a.id}
                onClick={() => setSubjectId(subjectId === a.id ? null : a.id)}
                className="h-12 px-5"
              >
                {a.nombre}
              </Filtro>
            ))}
          </Filtros>
        )}
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Mientras los horarios no estén en la app se elige a mano. Cuando estén, saldrá sola por día y hora.
        </p>
      </Seccion>

      {/* ── Cuándo ────────────────────────────────────────────────────────── */}
      <Seccion paso={3} titulo="Cuándo">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={fecha}
            max={hoy}
            onChange={(e) => cambiarFecha(e.target.value || hoy)}
            aria-label="Fecha del retraso"
            className="h-12 w-auto"
          />
          {/* La hora se ajusta a toques: el selector nativo en iPad es un suplicio. */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              onClick={() => ajustarHora(-5)}
              aria-label="Cinco minutos antes"
            >
              <Minus />
            </Button>
            <Input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value || horaAhora())}
              aria-label="Hora de llegada"
              className="h-12 w-28 text-center tabular-nums"
            />
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              onClick={() => ajustarHora(5)}
              aria-label="Cinco minutos después"
            >
              <Plus />
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => {
              haptic.tap();
              cambiarFecha(hoy);
              setHora(horaAhora());
            }}
          >
            Ahora
          </Button>
        </div>
        <Estado tono={retraso === 0 ? 'neutro' : 'aviso'} className="px-3 py-1.5 text-sm tabular-nums">
          <Clock aria-hidden />
          {retraso === 0 ? `Sin retraso (límite ${CONFIGURACION.puntualidad.horaLimite})` : `${formatoRetraso(retraso)} tarde`}
        </Estado>
      </Seccion>

      {/* ── Guardar ───────────────────────────────────────────────────────── */}
      <BarraAcciones
        ancho="estrecho"
        resumen={
          <>
            <span className="block truncate">
              {elegidos.length === 0
                ? 'Busca al alumno para empezar'
                : `${elegidos.length} ${elegidos.length === 1 ? 'alumno' : 'alumnos'} · ${fechaCorta(fecha)} · ${hora}${
                    asignaturaNombre ? ` · ${asignaturaNombre}` : ''
                  }`}
            </span>
            <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">Registra {registradoPor}</span>
          </>
        }
      >
        <Button type="button" size="lg" disabled={elegidos.length === 0} cargando={guardando} onClick={guardar}>
          {elegidos.length > 1 ? `Guardar ${elegidos.length} retrasos` : 'Guardar retraso'}
        </Button>
      </BarraAcciones>
    </div>
  );
}
