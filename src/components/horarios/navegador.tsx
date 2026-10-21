'use client';

// El navegador de horarios. Lo que se pulsa va en azul, como en toda la app; el color de
// cada materia en la rejilla es la excepción aprobada (raya y tinte suave, docs/diseno.md §3).
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
import { useRouter } from 'next/navigation';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, DoorOpen, MapPin, Palette, Pencil, Plus, Users } from 'lucide-react';

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
  type Franja,
} from '@/lib/horarios';
import { EditorAnotacion, type HuecoAnotable } from '@/components/horarios/editor-anotacion';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Segmentado } from '@/components/ui/segmentado';
import { Vacio } from '@/components/ui/vacio';

// Tintes de categoría (qué tipo de hora es), nunca de estado: por eso ni verde, ni ámbar,
// ni rojo, que en la app dicen «hecho», «falta algo» y «error».
const COLOR_ACTIVIDAD: Record<string, string> = {
  clase: 'bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800',
  tutoria: 'bg-violet-50 border-violet-200 dark:bg-violet-500/10 dark:border-violet-500/30',
  apoyo_pt: 'bg-cyan-50 border-cyan-200 dark:bg-cyan-500/10 dark:border-cyan-500/30',
  apoyo_al: 'bg-cyan-50 border-cyan-200 dark:bg-cyan-500/10 dark:border-cyan-500/30',
  guardia: 'bg-fuchsia-50 border-fuchsia-200 dark:bg-fuchsia-500/10 dark:border-fuchsia-500/30',
};

function colorDe(actividad: string, lectiva: boolean): string {
  return (
    COLOR_ACTIVIDAD[actividad] ??
    (lectiva
      ? 'bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800'
      : 'bg-zinc-100 border-zinc-200 border-dashed dark:bg-zinc-800/60 dark:border-zinc-700')
  );
}

/**
 * `franjas` son los huecos de la rejilla, ocupados o no: con ellos se ven el recreo y las
 * horas en las que no hay clase. `editable` (solo en «Mi horario») deja pulsar un hueco libre
 * para anotar algo a mano y cambiar o quitar lo anotado.
 */
export function Navegador({
  celdas,
  titulo,
  franjas,
  editable,
}: {
  celdas: CeldaHorario[];
  titulo: string;
  franjas?: Franja[];
  editable?: { periodoId: string };
}) {
  const router = useRouter();
  const filas = useMemo(() => construirCuadricula(celdas, franjas), [celdas, franjas]);
  // Anotar en un hueco libre, o reabrir una anotación propia para cambiarla o quitarla.
  const [hueco, setHueco] = useState<HuecoAnotable | null>(null);
  const [anotada, setAnotada] = useState<CeldaHorario | null>(null);
  const alHueco = editable
    ? (dia: number, f: FilaHorario) => {
        const tramoId = f.tramos[dia - 1];
        if (tramoId) setHueco({ periodoId: editable.periodoId, tramoId, dia, horaInicio: f.horaInicio, horaFin: f.horaFin });
      }
    : undefined;
  const [ahora, setAhora] = useState<ReturnType<typeof situarAhora> | null>(null);
  // El día que se ve en móvil NO se guarda en estado hasta que alguien toca una flecha: por
  // defecto se DERIVA de "hoy". Así no hay que sincronizar dos fuentes de verdad (ni meter
  // un setState dentro del efecto, que dispara renders en cascada), y en fin de semana cae
  // al lunes solo.
  const [diaElegido, setDiaElegido] = useState<number | null>(null);
  const [colorear, setColorear] = useState<ColorearPor>('materia');
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
      <Vacio icono={<CalendarDays />} titulo="Sin horario en este periodo">
        No hay horario para {titulo} en este periodo.
      </Vacio>
    );
  }

  return (
    <>
      <InterruptorColor valor={colorear} onCambio={setColorear} />

      {/* Móvil: un solo día, con flechas */}
      <div className="lg:hidden">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => { haptic.tap(); setDiaElegido(dia > 1 ? dia - 1 : 5); }}
            aria-label="Día anterior"
          >
            <ChevronLeft />
          </Button>
          <div className="text-center">
            <p className="text-base font-semibold capitalize text-zinc-900 dark:text-zinc-100">{DIAS[dia - 1]}</p>
            {ahora?.dia === dia && (
              <p className="text-xs font-medium text-blue-700 tabular-nums dark:text-blue-300">hoy · {ahora.hora}</p>
            )}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => { haptic.tap(); setDiaElegido(dia < 5 ? dia + 1 : 1); }}
            aria-label="Día siguiente"
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="space-y-1.5">
          {filas.map((f, i) => (
            <FilaMovil
              key={`${f.horaInicio}-${f.horaFin}`}
              fila={f}
              dia={dia}
              enCurso={ahora?.dia === dia && ahora.filaActual === i}
              onCelda={setDetalle}
              onHueco={alHueco}
              colorDe2={(c) => colorDeCelda(c, reparto, colorear)}
            />
          ))}
        </div>
      </div>

      {/* Pantalla grande: la semana */}
      <div className="hidden lg:block">
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-[72px] border-b border-zinc-200 p-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  Hora
                </th>
                {DIAS.map((d, i) => (
                  <th
                    key={d}
                    className={cn(
                      'border-b border-l border-zinc-200 p-2 text-center text-xs font-semibold capitalize dark:border-zinc-800',
                      ahora?.dia === i + 1
                        ? 'bg-blue-50 text-blue-800 dark:bg-blue-500/10 dark:text-blue-200'
                        : 'text-zinc-600 dark:text-zinc-400',
                    )}
                  >
                    {d}
                    {ahora?.dia === i + 1 && <span className="ml-1 font-normal">· hoy</span>}
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
                  onHueco={alHueco}
                  colorDe2={(c) => colorDeCelda(c, reparto, colorear)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {alHueco && (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Toca un hueco libre para anotar algo a mano: una tutoría individual, atención a familias, una guardia…
        </p>
      )}

      {detalle && (
        <Detalle
          key={detalle.sesionId}
          celda={detalle}
          onCerrar={() => setDetalle(null)}
          onEditar={editable && detalle.origen === 'manual' ? () => { setAnotada(detalle); setDetalle(null); } : undefined}
        />
      )}
      {editable && hueco && (
        <EditorAnotacion
          hueco={hueco}
          onCerrar={() => setHueco(null)}
          onGuardado={() => { setHueco(null); router.refresh(); }}
        />
      )}
      {editable && anotada && (
        <EditorAnotacion
          hueco={{ dia: anotada.dia, horaInicio: anotada.horaInicio, horaFin: anotada.horaFin }}
          existente={{ sesionId: anotada.sesionId, actividad: anotada.actividad, etiqueta: anotada.etiqueta ?? null, aula: anotada.espacio, notas: anotada.notas }}
          onCerrar={() => setAnotada(null)}
          onGuardado={() => { setAnotada(null); router.refresh(); }}
        />
      )}
    </>
  );
}

function FilaMovil({
  fila,
  dia,
  enCurso,
  onCelda,
  onHueco,
  colorDe2,
}: {
  fila: FilaHorario;
  dia: number;
  enCurso: boolean;
  onCelda: (c: CeldaHorario) => void;
  onHueco?: (dia: number, fila: FilaHorario) => void;
  colorDe2: (c: CeldaHorario) => ColorCategoria | null;
}) {
  const celdas = fila.dias[dia - 1];
  if (fila.tipo !== 'sesion') return <Separador fila={fila} />;
  return (
    <div className={cn('flex gap-2 rounded-xl p-1.5', enCurso && 'bg-blue-50 ring-1 ring-blue-300 dark:bg-blue-500/10 dark:ring-blue-500/40')}>
      <ColumnaHora fila={fila} className="w-14 shrink-0 pt-1.5" />
      <div className="flex-1 space-y-1.5">
        {celdas.length === 0 ? (
          onHueco && fila.tramos[dia - 1] ? (
            <button
              type="button"
              onClick={() => { haptic.tap(); onHueco(dia, fila); }}
              className="flex min-h-12 w-full items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-3 text-left text-sm text-zinc-600 outline-none hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-blue-500/50 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
              aria-label={`Anotar algo el ${DIAS[dia - 1]} de ${fila.horaInicio} a ${fila.horaFin}`}
            >
              <Plus aria-hidden className="size-4" /> Libre · toca para anotar algo
            </button>
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              Libre
            </div>
          )
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
  onHueco,
  colorDe2,
}: {
  fila: FilaHorario;
  ahora: ReturnType<typeof situarAhora> | null;
  enCurso: boolean;
  onCelda: (c: CeldaHorario) => void;
  onHueco?: (dia: number, fila: FilaHorario) => void;
  colorDe2: (c: CeldaHorario) => ColorCategoria | null;
}) {
  if (fila.tipo !== 'sesion') {
    return (
      <tr>
        <td colSpan={6} className="border-b border-zinc-200 bg-zinc-50 px-3 py-1 dark:border-zinc-800 dark:bg-zinc-800/50">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
            {fila.etiqueta} · {fila.horaInicio}–{fila.horaFin}
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
          </div>
        </td>
      </tr>
    );
  }
  return (
    <tr className={cn(enCurso && 'bg-blue-50/60 dark:bg-blue-500/5')}>
      <td className="border-b border-zinc-200 p-2 align-top dark:border-zinc-800">
        <ColumnaHora fila={fila} conEtiqueta />
      </td>
      {fila.dias.map((celdas, i) => (
        <td
          key={i}
          className={cn(
            'border-b border-l border-zinc-200 p-1 align-top dark:border-zinc-800',
            ahora?.dia === i + 1 && 'bg-blue-50/40 dark:bg-blue-500/5',
            enCurso && ahora?.dia === i + 1 && 'bg-blue-100/70 dark:bg-blue-500/15',
          )}
        >
          <div className="space-y-1">
            {celdas.map((c) => (
              <Celda key={c.sesionId} celda={c} onClick={() => onCelda(c)} color={colorDe2(c)} />
            ))}
            {/* Un hueco libre y anotable: el botón se ve flojito para no ensuciar la
                cuadrícula, pero entero es objetivo táctil. */}
            {celdas.length === 0 && onHueco && fila.tramos[i] && (
              <button
                type="button"
                onClick={() => { haptic.tap(); onHueco(i + 1, fila); }}
                className="flex h-10 w-full items-center justify-center rounded-lg border border-dashed border-zinc-200 text-zinc-400 transition-colors outline-none hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-700 focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-zinc-800 dark:text-zinc-500 dark:hover:border-blue-500/50 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
                aria-label={`Anotar algo el ${DIAS[i]} de ${fila.horaInicio} a ${fila.horaFin}`}
              >
                <Plus aria-hidden className="size-4" />
              </button>
            )}
          </div>
        </td>
      ))}
    </tr>
  );
}

/**
 * Por defecto se colorea **por materia**: es el tipo de clase lo que uno busca de un vistazo
 * («¿cuándo tengo Mates?»), no el aula en la que cae. Decisión de David (13-sep-2026); antes
 * arrancaba apagado y había que ir a encenderlo.
 *
 * «Por clase» (el grupo) sigue a un toque: en el horario de un profe es lo que enseña cuántas
 * veces entra en cada grupo.
 */
function InterruptorColor({ valor, onCambio }: { valor: ColorearPor; onCambio: (v: ColorearPor) => void }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        <Palette aria-hidden className="size-4" /> Colorear
      </span>
      <Segmentado
        etiqueta="Colorear la rejilla"
        valor={valor}
        onChange={onCambio}
        opciones={[
          { valor: 'nada', etiqueta: 'Sin color' },
          { valor: 'clase', etiqueta: 'Por clase' },
          { valor: 'materia', etiqueta: 'Por materia' },
        ]}
      />
    </div>
  );
}

/**
 * La columna de la hora, igual en todas las rejillas de horario (Horarios, Mi horario y
 * Oratorios): la de empezar en negrita y la de acabar debajo.
 */
function ColumnaHora({ fila, conEtiqueta, className }: { fila: FilaHorario; conEtiqueta?: boolean; className?: string }) {
  return (
    <div className={cn('text-right lg:text-left', className)}>
      <p className="text-sm font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">{fila.horaInicio}</p>
      <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{fila.horaFin}</p>
      {conEtiqueta && fila.etiqueta && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{fila.etiqueta}</p>}
    </div>
  );
}

function Separador({ fila }: { fila: FilaHorario }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
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
        'w-full rounded-lg border px-2 text-left transition-colors outline-none hover:border-zinc-400 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:border-zinc-500',
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
      {/* El detalle va ANTES que el profe y con más peso: en un ámbito de PDC todas las
          horas se llaman igual ('Ámbito Científico') y lo que distingue una de otra es
          justo esto — si esa hora toca Mates, Biología o Física y Química. */}
      {celda.detalle && (
        <p className={cn('text-xs font-medium leading-tight text-zinc-700 dark:text-zinc-300', !grande && 'line-clamp-1')}>
          {celda.detalle}
        </p>
      )}
      {celda.subtitulo && (
        <p className={cn('text-xs leading-tight text-zinc-600 dark:text-zinc-400', !grande && 'line-clamp-2')}>
          {celda.subtitulo}
        </p>
      )}
      {celda.espacio && (
        <p className="mt-0.5 flex items-center gap-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
          <MapPin aria-hidden className="size-3 shrink-0" />
          {celda.espacio}
        </p>
      )}
    </button>
  );
}

function Detalle({ celda, onCerrar, onEditar }: { celda: CeldaHorario; onCerrar: () => void; onEditar?: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent variante="hoja">
        <DialogHeader>
          <DialogTitle>{celda.titulo}</DialogTitle>
          {celda.detalle && (
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Esta hora: {celda.detalle}</p>
          )}
          <DialogDescription className="capitalize tabular-nums">
            {DIAS[celda.dia - 1]} · {celda.horaInicio}–{celda.horaFin}
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-3 text-sm">
          {celda.grupos.length > 0 && (
            <Dato icono={<Users className="size-4" />} titulo="Grupo">
              {celda.grupos.join(', ')}
            </Dato>
          )}
          {celda.profes.length > 0 && (
            <Dato icono={<DoorOpen className="size-4" />} titulo={celda.profes.length > 1 ? 'Profesorado' : 'Profesor/a'}>
              <ul className="space-y-1">
                {celda.profes.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-1.5">
                    {p.nombre}
                    {p.rol !== 'titular' && <Etiqueta>{p.rol.toUpperCase()}</Etiqueta>}
                  </li>
                ))}
              </ul>
            </Dato>
          )}
          {celda.espacio && (
            <Dato icono={<MapPin className="size-4" />} titulo="Aula">
              {celda.espacio}
            </Dato>
          )}
          <Dato icono={<Clock className="size-4" />} titulo="Tipo">
            <span className="capitalize">{celda.actividad.replace(/_/g, ' ')}</span>
            <Etiqueta className="ml-2">{celda.lectiva ? 'lectiva' : 'no lectiva'}</Etiqueta>
          </Dato>
          {celda.notas && <Dato titulo="Notas">{celda.notas}</Dato>}
        </dl>

        {onEditar && (
          <Button variant="outline" className="w-full" onClick={() => { haptic.tap(); onEditar(); }}>
            <Pencil aria-hidden /> Cambiar o quitar mi anotación
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Dato({ icono, titulo, children }: { icono?: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <span aria-hidden className="mt-0.5 w-4 shrink-0 text-zinc-400 dark:text-zinc-500">{icono}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{titulo}</dt>
        <dd className="text-zinc-800 dark:text-zinc-200">{children}</dd>
      </div>
    </div>
  );
}
