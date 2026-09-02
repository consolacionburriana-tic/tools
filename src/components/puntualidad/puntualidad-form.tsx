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
import { Loader2, Search, UserPlus, X, ChevronDown, Clock, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';

import { Chip, ClaseChip, HistorialPill, Interruptor, Seccion } from './ui';
import { haptic } from '@/lib/haptics';
import {
  JUSTIFICACION_TIPOS,
  fraseHistorial,
  formatoRetraso,
  horaAhora,
  minutosRetraso,
  registroPayloadSchema,
  type JustificacionTipo,
  type ResumenHistorial,
} from '@/lib/puntualidad';
import type { AlumnoBusqueda } from '@/lib/puntualidad-server';

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
        if (vivo) setResultados(res.ok ? (data.alumnos ?? []) : []);
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
        setElegidos((prev) =>
          prev.map((e) => (e.alumno.eduStudentId === eduStudentId ? { ...e, resumen: data.resumen } : e)),
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
    setElegidos((prev) => [...prev, { alumno, detalle: detalleVacio(), resumen: null }]);
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
    <div className="space-y-7 pb-40">
      {/* ── Quién ─────────────────────────────────────────────────────────── */}
      <Seccion titulo="Quién ha llegado tarde">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            ref={buscadorRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && resultados.length > 0) {
                e.preventDefault();
                añadir(resultados[0]);
              }
              if (e.key === 'Escape') setQuery('');
            }}
            placeholder="Nombre o apellido…"
            enterKeyHint="done"
            autoComplete="off"
            className="h-14 w-full rounded-2xl border border-zinc-200 bg-white pl-11 pr-11 text-base text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          {buscando && <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-300" />}
          {!buscando && query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Limpiar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <AnimatePresence>
          {resultados.length > 0 && (
            <motion.ul
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {resultados.map((a) => (
                <li key={a.eduStudentId}>
                  <button
                    type="button"
                    onClick={() => añadir(a)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-orange-50/60 active:bg-orange-100/60 dark:hover:bg-orange-500/5"
                  >
                    <UserPlus className="h-4 w-4 shrink-0 text-orange-500" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                      {a.nombre}
                    </span>
                    <ClaseChip clase={a.clase} />
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
          {!buscando && query.trim().length >= 2 && resultados.length === 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl border border-dashed border-zinc-200 px-4 py-3 text-sm text-zinc-400 dark:border-zinc-700"
            >
              Nadie de secundaria con ese nombre. (El módulo solo lleva ESO y PDC.)
            </motion.p>
          )}
        </AnimatePresence>

        {/* Alumnado elegido */}
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {elegidos.map((e) => (
              <motion.div
                key={e.alumno.eduStudentId}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="flex items-start gap-3 p-3.5">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{e.alumno.nombre}</span>
                      <ClaseChip clase={e.alumno.clase} />
                    </div>
                    {e.resumen ? (
                      <HistorialPill tono={e.resumen.tono}>
                        {fraseHistorial(e.resumen, fechaCorta)}
                        {e.resumen.faltanParaConsecuencia === 0 && !e.detalle.justificado && (
                          <strong className="block">
                            Con este cierra el ciclo de tres: se avisará al tutor/a y le toca quedarse sin patio.
                          </strong>
                        )}
                        {e.resumen.justificados > 0 && (
                          <span className="block text-[11px] opacity-70">
                            {e.resumen.justificados}{' '}
                            {e.resumen.justificados === 1 ? 'justificado' : 'justificados'} (no cuentan para el ciclo)
                          </span>
                        )}
                      </HistorialPill>
                    ) : (
                      <p className="text-xs text-zinc-400">Cargando historial…</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => quitar(e.alumno.eduStudentId)}
                    className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
                    aria-label={`Quitar ${e.alumno.nombre}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Datos opcionales, escondidos hasta que hagan falta */}
                <button
                  type="button"
                  onClick={() => cambiarDetalle(e.alumno.eduStudentId, { abierto: !e.detalle.abierto })}
                  className="flex w-full items-center justify-between gap-2 border-t border-zinc-100 px-3.5 py-2 text-xs text-zinc-500 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                >
                  <span className="flex items-center gap-2">
                    Más datos
                    {e.detalle.justificado && (
                      <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        justificado
                      </span>
                    )}
                    {e.detalle.subeAClase && (
                      <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                        sube a clase
                      </span>
                    )}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${e.detalle.abierto ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence initial={false}>
                  {e.detalle.abierto && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 border-t border-zinc-100 p-3.5 dark:border-zinc-800">
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
                          <div className="space-y-2 pl-1">
                            <div className="flex flex-wrap gap-2">
                              {JUSTIFICACION_TIPOS.map((t) => (
                                <Chip
                                  key={t.value}
                                  tamano="pequeno"
                                  activo={e.detalle.justificacionTipo === t.value}
                                  onClick={() => cambiarDetalle(e.alumno.eduStudentId, { justificacionTipo: t.value })}
                                >
                                  {t.label}
                                </Chip>
                              ))}
                            </div>
                            <input
                              value={e.detalle.justificacionNota}
                              onChange={(ev) =>
                                cambiarDetalle(e.alumno.eduStudentId, { justificacionNota: ev.target.value })
                              }
                              placeholder="Detalle de la justificación (opcional)"
                              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 dark:border-zinc-700 dark:bg-zinc-800"
                            />
                          </div>
                        )}
                        <Interruptor
                          activo={e.detalle.subeAClase}
                          etiqueta="Sube a clase"
                          onChange={(v) => cambiarDetalle(e.alumno.eduStudentId, { subeAClase: v })}
                        />
                        <textarea
                          value={e.detalle.observaciones}
                          onChange={(ev) => cambiarDetalle(e.alumno.eduStudentId, { observaciones: ev.target.value })}
                          placeholder="Observaciones (opcional)"
                          rows={2}
                          className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 dark:border-zinc-700 dark:bg-zinc-800"
                        />
                        {varios && (
                          <div className="space-y-2">
                            <p className="text-[11px] uppercase tracking-wide text-zinc-400">
                              Asignatura solo para {e.alumno.nombre.split(' ')[0]}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {asignaturas.map((a) => (
                                <Chip
                                  key={a.id}
                                  tamano="pequeno"
                                  activo={e.detalle.subjectId === a.id}
                                  onClick={() =>
                                    cambiarDetalle(e.alumno.eduStudentId, {
                                      subjectId: e.detalle.subjectId === a.id ? null : a.id,
                                    })
                                  }
                                >
                                  {a.abreviatura ?? a.nombre}
                                </Chip>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </Seccion>

      {/* ── Asignatura ────────────────────────────────────────────────────── */}
      <Seccion titulo="En qué asignatura" aviso={varios ? 'obligatoria al registrar varios' : undefined}>
        {asignaturas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-3 text-sm text-zinc-400 dark:border-zinc-700">
            No hay asignaturas configuradas. Se añaden en el panel de gestión.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {asignaturas.map((a) => (
              <Chip key={a.id} activo={subjectId === a.id} onClick={() => setSubjectId(subjectId === a.id ? null : a.id)}>
                {a.nombre}
              </Chip>
            ))}
          </div>
        )}
        <p className="text-xs text-zinc-400">
          Mientras los horarios no estén en la app se elige a mano. Cuando estén, saldrá sola por día y hora.
        </p>
      </Seccion>

      {/* ── Cuándo ────────────────────────────────────────────────────────── */}
      <Seccion titulo="Cuándo">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-12 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900">
            <CalendarDays className="h-4 w-4 text-zinc-400" />
            <input
              type="date"
              value={fecha}
              max={hoy}
              onChange={(e) => cambiarFecha(e.target.value || hoy)}
              className="bg-transparent text-sm text-zinc-800 outline-none dark:text-zinc-100"
            />
          </label>
          <label className="flex h-12 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900">
            <Clock className="h-4 w-4 text-zinc-400" />
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value || horaAhora())}
              className="bg-transparent text-sm tabular-nums text-zinc-800 outline-none dark:text-zinc-100"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              haptic.tap();
              cambiarFecha(hoy);
              setHora(horaAhora());
            }}
            className="h-12 rounded-xl border border-zinc-200 px-3 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Ahora
          </button>
          <span
            className={`rounded-xl px-3 py-2 text-sm font-semibold tabular-nums ${
              retraso === 0
                ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                : 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
            }`}
          >
            {retraso === 0 ? 'Sin retraso (límite 08:05)' : `${formatoRetraso(retraso)} tarde`}
          </span>
        </div>
      </Seccion>

      {/* ── Guardar ───────────────────────────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div
          className="container mx-auto max-w-2xl px-4 py-3"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
            <span>
              {elegidos.length === 0
                ? 'Busca al alumno para empezar'
                : `${elegidos.length} ${elegidos.length === 1 ? 'alumno' : 'alumnos'} · ${fechaCorta(fecha)} · ${hora}${
                    asignaturaNombre ? ` · ${asignaturaNombre}` : ''
                  }`}
            </span>
            <span className="truncate pl-2">{registradoPor}</span>
          </div>
          <button
            type="button"
            disabled={elegidos.length === 0 || guardando}
            onClick={guardar}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-base font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
          >
            {guardando && <Loader2 className="h-5 w-5 animate-spin" />}
            {elegidos.length > 1 ? `Guardar ${elegidos.length} retrasos` : 'Guardar retraso'}
          </button>
        </div>
      </div>
    </div>
  );
}
