'use client';

// El navegador de horarios. Vocabulario visual índigo (cada módulo tiene su acento).
//
// Dos decisiones de diseño mandan sobre todo lo demás:
//
//  1. **En móvil se ve UN día, no cinco.** Una cuadrícula de 5×9 en un teléfono no se lee:
//     o haces zoom o scroll horizontal, y las dos cosas son peores que no tenerla. Así que
//     en móvil se pinta el día en curso con flechas para moverse, y en pantalla grande la
//     semana entera. Es el mismo componente y los mismos datos.
//  2. **"Ahora" se calcula en el cliente.** El servidor está en UTC y el indicador saldría
//     una hora corrido media parte del año.

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, DoorOpen, MapPin, Palette, Users, X } from 'lucide-react';

import {
  colorDeCelda,
  construirCuadricula,
  DIAS,
  repartirColores,
  situarAhora,
  type CeldaHorario,
  type ColorCategoria,
  type ColorearPor,
  type FilaHorario,
} from '@/lib/horarios';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

const COLOR_ACTIVIDAD: Record<string, string> = {
  clase: 'bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800',
  tutoria: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/30',
  apoyo_pt: 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30',
  apoyo_al: 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30',
  guardia: 'bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30',
};

function colorDe(actividad: string, lectiva: boolean): string {
  return (
    COLOR_ACTIVIDAD[actividad] ??
    (lectiva
      ? 'bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800'
      : 'bg-zinc-100 border-zinc-200 border-dashed dark:bg-zinc-800/60 dark:border-zinc-700')
  );
}

export function Navegador({ celdas, titulo }: { celdas: CeldaHorario[]; titulo: string }) {
  const filas = useMemo(() => construirCuadricula(celdas), [celdas]);
  const [ahora, setAhora] = useState<ReturnType<typeof situarAhora> | null>(null);
  // El día que se ve en móvil NO se guarda en estado hasta que alguien toca una flecha: por
  // defecto se DERIVA de "hoy". Así no hay que sincronizar dos fuentes de verdad (ni meter
  // un setState dentro del efecto, que dispara renders en cascada), y en fin de semana cae
  // al lunes solo.
  const [diaElegido, setDiaElegido] = useState<number | null>(null);
  const [colorear, setColorear] = useState<ColorearPor>('nada');
  const reparto = useMemo(() => repartirColores(celdas, colorear), [celdas, colorear]);
  const dia = diaElegido ?? ahora?.dia ?? 1;
  const [detalle, setDetalle] = useState<CeldaHorario | null>(null);

  // El indicador se refresca solo cada minuto: la pantalla se queda abierta en la sala de
  // profesores y un "ahora" congelado engaña más que no tenerlo.
  useEffect(() => {
    const calcular = () => setAhora(situarAhora(filas, new Date()));
    calcular();
    const t = setInterval(calcular, 60_000);
    return () => clearInterval(t);
  }, [filas]);

  if (filas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <CalendarDays className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">No hay horario para {titulo} en este periodo.</p>
      </div>
    );
  }

  return (
    <>
      <InterruptorColor valor={colorear} onCambio={setColorear} />

      {/* Móvil: un solo día, con flechas */}
      <div className="lg:hidden">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => { haptic.tap(); setDiaElegido(dia > 1 ? dia - 1 : 5); }}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 active:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:active:bg-zinc-800"
            aria-label="Día anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold capitalize text-zinc-900 dark:text-zinc-100">{DIAS[dia - 1]}</p>
            {ahora?.dia === dia && <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">hoy · {ahora.hora}</p>}
          </div>
          <button
            type="button"
            onClick={() => { haptic.tap(); setDiaElegido(dia < 5 ? dia + 1 : 1); }}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 active:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:active:bg-zinc-800"
            aria-label="Día siguiente"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-1.5">
          {filas.map((f, i) => (
            <FilaMovil
              key={`${f.horaInicio}-${f.horaFin}`}
              fila={f}
              dia={dia}
              enCurso={ahora?.dia === dia && ahora.filaActual === i}
              onCelda={setDetalle}
              colorDe2={(c) => colorDeCelda(c, reparto, colorear)}
            />
          ))}
        </div>
      </div>

      {/* Pantalla grande: la semana */}
      <div className="hidden lg:block">
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-[70px] border-b border-zinc-200 p-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                  Hora
                </th>
                {DIAS.map((d, i) => (
                  <th
                    key={d}
                    className={cn(
                      'border-b border-l border-zinc-200 p-2 text-center text-xs font-semibold capitalize dark:border-zinc-800',
                      ahora?.dia === i + 1
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                        : 'text-zinc-500 dark:text-zinc-400',
                    )}
                  >
                    {d}
                    {ahora?.dia === i + 1 && <span className="ml-1 text-[10px] font-normal">· hoy</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <FilaSemana
                  key={`${f.horaInicio}-${f.horaFin}`}
                  fila={f}
                  ahora={ahora}
                  enCurso={ahora?.filaActual === i}
                  onCelda={setDetalle}
                  colorDe2={(c) => colorDeCelda(c, reparto, colorear)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detalle && <Detalle celda={detalle} onCerrar={() => setDetalle(null)} />}
    </>
  );
}

function FilaMovil({
  fila,
  dia,
  enCurso,
  onCelda,
  colorDe2,
}: {
  fila: FilaHorario;
  dia: number;
  enCurso: boolean;
  onCelda: (c: CeldaHorario) => void;
  colorDe2: (c: CeldaHorario) => ColorCategoria | null;
}) {
  const celdas = fila.dias[dia - 1];
  if (fila.tipo !== 'sesion') return <Separador fila={fila} />;
  return (
    <div className={cn('flex gap-2 rounded-lg p-1.5', enCurso && 'bg-indigo-50 ring-1 ring-indigo-300 dark:bg-indigo-500/10 dark:ring-indigo-500/40')}>
      <div className="w-16 shrink-0 pt-1.5 text-right">
        <p className="text-xs font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">{fila.horaInicio}</p>
        <p className="text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">{fila.horaFin}</p>
      </div>
      <div className="flex-1 space-y-1.5">
        {celdas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-3 text-xs text-zinc-400 dark:border-zinc-700 dark:text-zinc-600">
            Libre
          </div>
        ) : (
          celdas.map((c) => <Celda key={c.sesionId} celda={c} onClick={() => onCelda(c)} grande color={colorDe2(c)} />)
        )}
      </div>
    </div>
  );
}

function FilaSemana({
  fila,
  ahora,
  enCurso,
  onCelda,
  colorDe2,
}: {
  fila: FilaHorario;
  ahora: ReturnType<typeof situarAhora> | null;
  enCurso: boolean;
  onCelda: (c: CeldaHorario) => void;
  colorDe2: (c: CeldaHorario) => ColorCategoria | null;
}) {
  if (fila.tipo !== 'sesion') {
    return (
      <tr>
        <td colSpan={6} className="border-b border-zinc-200 bg-zinc-50 px-3 py-1 dark:border-zinc-800 dark:bg-zinc-800/50">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
            {fila.etiqueta} · {fila.horaInicio}–{fila.horaFin}
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
          </div>
        </td>
      </tr>
    );
  }
  return (
    <tr className={cn(enCurso && 'bg-indigo-50/60 dark:bg-indigo-500/5')}>
      <td className="border-b border-zinc-200 p-2 align-top dark:border-zinc-800">
        <p className="text-xs font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">{fila.horaInicio}</p>
        <p className="text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">{fila.horaFin}</p>
        <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-600">{fila.etiqueta}</p>
      </td>
      {fila.dias.map((celdas, i) => (
        <td
          key={i}
          className={cn(
            'border-b border-l border-zinc-200 p-1 align-top dark:border-zinc-800',
            ahora?.dia === i + 1 && 'bg-indigo-50/40 dark:bg-indigo-500/5',
            enCurso && ahora?.dia === i + 1 && 'bg-indigo-100/70 dark:bg-indigo-500/15',
          )}
        >
          <div className="space-y-1">
            {celdas.map((c) => (
              <Celda key={c.sesionId} celda={c} onClick={() => onCelda(c)} color={colorDe2(c)} />
            ))}
          </div>
        </td>
      ))}
    </tr>
  );
}

/**
 * Colorear es OPCIONAL y por defecto está apagado: en el horario de una clase el color no
 * añade nada (todo es la misma clase) y en el de un profe es justo lo que hace falta para
 * ver de un vistazo cuántas veces entra en cada grupo.
 */
function InterruptorColor({ valor, onCambio }: { valor: ColorearPor; onCambio: (v: ColorearPor) => void }) {
  const opciones: { id: ColorearPor; label: string }[] = [
    { id: 'nada', label: 'Sin color' },
    { id: 'clase', label: 'Por clase' },
    { id: 'materia', label: 'Por materia' },
  ];
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">
        <Palette className="h-3.5 w-3.5" /> Colorear
      </span>
      <div className="flex gap-1 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
        {opciones.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => { haptic.tap(); onCambio(o.id); }}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              valor === o.id
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Separador({ fila }: { fila: FilaHorario }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
      <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
      {fila.etiqueta} · {fila.horaInicio}–{fila.horaFin}
      <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
    </div>
  );
}

function Celda({
  celda,
  onClick,
  grande,
  color,
}: {
  celda: CeldaHorario;
  onClick: () => void;
  grande?: boolean;
  color?: ColorCategoria | null;
}) {
  return (
    <button
      type="button"
      onClick={() => { haptic.tap(); onClick(); }}
      // El color de categoría va como filete lateral + un tinte muy suave del mismo tono.
      // El texto NUNCA se tiñe: se queda en la tinta de siempre y el color solo acompaña,
      // que es lo que mantiene el contraste en claro y en oscuro.
      style={
        color
          ? ({ '--hc': color.claro, '--hc-dark': color.oscuro } as React.CSSProperties)
          : undefined
      }
      className={cn(
        'w-full rounded-lg border px-2 text-left transition-colors hover:border-indigo-300 hover:shadow-sm dark:hover:border-indigo-500/50',
        grande ? 'py-2.5' : 'py-1.5',
        color
          ? 'border-l-[3px] border-l-[var(--hc)] bg-[color-mix(in_oklab,var(--hc)_9%,white)] dark:border-l-[var(--hc-dark)] dark:bg-[color-mix(in_oklab,var(--hc-dark)_16%,#18181b)]'
          : colorDe(celda.actividad, celda.lectiva),
      )}
    >
      <p
        className={cn(
          'font-medium leading-tight text-zinc-900 dark:text-zinc-100',
          grande ? 'text-sm' : 'line-clamp-2 text-xs',
        )}
        title={celda.titulo}
      >
        {celda.titulo}
      </p>
      {celda.subtitulo && (
        <p className={cn('leading-tight text-zinc-500 dark:text-zinc-400', grande ? 'text-xs' : 'line-clamp-2 text-[10px]')}>
          {celda.subtitulo}
        </p>
      )}
      {celda.espacio && (
        <p className="mt-0.5 flex items-center gap-0.5 truncate text-[10px] text-zinc-400 dark:text-zinc-500">
          <MapPin className="h-2.5 w-2.5 shrink-0" />
          {celda.espacio}
        </p>
      )}
    </button>
  );
}

function Detalle({ celda, onCerrar }: { celda: CeldaHorario; onCerrar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onCerrar}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-md rounded-t-2xl border border-zinc-200 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{celda.titulo}</h3>
            <p className="mt-0.5 text-sm capitalize text-zinc-500 dark:text-zinc-400">
              {DIAS[celda.dia - 1]} · {celda.horaInicio}–{celda.horaFin}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <dl className="space-y-2.5 text-sm">
          {celda.grupos.length > 0 && (
            <Dato icono={<Users className="h-4 w-4" />} titulo="Grupo">
              {celda.grupos.join(', ')}
            </Dato>
          )}
          {celda.profes.length > 0 && (
            <Dato icono={<DoorOpen className="h-4 w-4" />} titulo={celda.profes.length > 1 ? 'Profesorado' : 'Profesor/a'}>
              <ul className="space-y-0.5">
                {celda.profes.map((p) => (
                  <li key={p.id}>
                    {p.nombre}
                    {p.rol !== 'titular' && <span className="ml-1.5 text-xs text-amber-600 dark:text-amber-400">{p.rol.toUpperCase()}</span>}
                  </li>
                ))}
              </ul>
            </Dato>
          )}
          {celda.espacio && (
            <Dato icono={<MapPin className="h-4 w-4" />} titulo="Aula">
              {celda.espacio}
            </Dato>
          )}
          <Dato icono={<Clock className="h-4 w-4" />} titulo="Tipo">
            <span className="capitalize">{celda.actividad.replace(/_/g, ' ')}</span>
            <span className={cn('ml-2 rounded px-1.5 py-0.5 text-xs', celda.lectiva ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400')}>
              {celda.lectiva ? 'lectiva' : 'no lectiva'}
            </span>
          </Dato>
          {celda.notas && <Dato titulo="Notas">{celda.notas}</Dato>}
        </dl>
      </motion.div>
    </div>
  );
}

function Dato({ icono, titulo, children }: { icono?: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 text-zinc-400 dark:text-zinc-500">{icono}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{titulo}</dt>
        <dd className="text-zinc-800 dark:text-zinc-200">{children}</dd>
      </div>
    </div>
  );
}
