'use client';

// /gestion/nouvinguts/proceso: el orden de los pasos (arrastrando, con ratón, dedo o teclado),
// quién lleva cada uno, desde qué curso le toca y si está activo. Solo SuperTIC y TIC. Aquí
// también se traen las altas que ya había al estrenar el módulo.
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronLeft, GripVertical, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import {
  cursosOfrecidos,
  EVENTO_AVISO,
  EVENTOS_AVISO,
  GRUPO_AVISO_LABEL,
  GRUPOS_AVISO,
  RESPONSABLE_LABEL,
  RESPONSABLES,
  type AvisosNouvinguts,
  type EventoAviso,
  type GrupoAviso,
  type PasoProceso,
  type Responsable,
} from '@/lib/nouvinguts';
import { BORDE_RESPONSABLE, ESTILO_CAMPO, pedir } from './comun';

const CURSOS = cursosOfrecidos();

export function ProcesoNouvinguts({
  inicial,
  diasAtascoInicial,
  avisosInicial,
  correoConfigurado,
}: {
  inicial: PasoProceso[];
  diasAtascoInicial: number;
  avisosInicial: AvisosNouvinguts;
  correoConfigurado: boolean;
}) {
  const router = useRouter();
  const [pasos, setPasos] = useState(inicial);
  const [diasAtasco, setDiasAtasco] = useState(diasAtascoInicial);
  const [avisos, setAvisos] = useState(avisosInicial);
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function cambiar(clave: string, cambios: Partial<PasoProceso>) {
    setPasos((prev) => prev.map((p) => (p.clave === clave ? { ...p, ...cambios } : p)));
    setSucio(true);
  }

  function alSoltar(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    setPasos((prev) => {
      const de = prev.findIndex((p) => p.clave === e.active.id);
      const a = prev.findIndex((p) => p.clave === e.over!.id);
      return arrayMove(prev, de, a);
    });
    haptic.tap();
    setSucio(true);
  }

  async function guardar() {
    setGuardando(true);
    try {
      await pedir('/api/nouvinguts/proceso', {
        method: 'PUT',
        body: JSON.stringify({
          pasos: pasos.map((p) => ({ clave: p.clave, activo: p.activo, responsable: p.responsable, desdeCurso: p.desde })),
          diasAtasco,
          avisos,
        }),
      });
      haptic.success();
      toast.success('Proceso guardado');
      setSucio(false);
      router.refresh();
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-5">
      <Link
        href="/gestion/nouvinguts"
        className="inline-flex min-h-8 items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
      >
        <ChevronLeft className="h-4 w-4" /> Nouvinguts
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Proceso de nouvinguts</h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Arrastra los pasos para cambiar el orden: es el de la ficha de cada alumno y el de las columnas de la lista. Lo que
          desactives deja de contar para todos.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            {/* `id` fijo: sin él, los ids de accesibilidad de dnd-kit no casan entre servidor y cliente */}
            <DndContext id="nouvinguts-proceso" sensors={sensores} collisionDetection={closestCenter} onDragEnd={alSoltar}>
              <SortableContext items={pasos.map((p) => p.clave)} strategy={verticalListSortingStrategy}>
                {pasos.map((p, i) => (
                  <FilaPaso key={p.clave} paso={p} n={i + 1} onCambiar={(c) => cambiar(p.clave, c)} />
                ))}
              </SortableContext>
            </DndContext>
          </div>
          <div className="sticky bottom-0 flex items-center justify-end gap-3 bg-zinc-50/90 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur dark:bg-zinc-950/90">
            {sucio && <span className="text-sm text-zinc-500">Hay cambios sin guardar</span>}
            <button
              type="button"
              onClick={guardar}
              disabled={!sucio || guardando}
              className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {guardando && <Loader2 className="h-4 w-4 animate-spin" />} Guardar el proceso
            </button>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">Aviso de atasco</p>
            <label className="flex flex-wrap items-center gap-2 text-sm">
              El día sale en naranja si lleva más de
              <input
                type="number"
                min={1}
                max={365}
                value={diasAtasco}
                onChange={(e) => {
                  setDiasAtasco(Math.max(1, Math.min(365, Number(e.target.value) || 1)));
                  setSucio(true);
                }}
                className="h-10 w-20 rounded-lg border border-zinc-300 px-2 font-mono dark:border-zinc-700 dark:bg-zinc-950"
              />
              días
            </label>
          </div>
          <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">«Desde» cambia cada curso</p>
            <p className="text-zinc-700 dark:text-zinc-300">
              En 2026-27 iPad, ASM y licencias van desde 6º EP. El curso que viene 6º deja de tener iPad y licencias: se pone
              «1º ESO» aquí y listo, sin tocar código. El banco de libros sigue los ajustes del centro.
            </p>
          </div>
          <Avisos
            avisos={avisos}
            correoConfigurado={correoConfigurado}
            onCambiar={(evento, grupos) => {
              setAvisos((prev) => ({ ...prev, [evento]: grupos }));
              setSucio(true);
            }}
          />
          <TraerAltas />
          <div className="space-y-2 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm dark:border-zinc-700 dark:bg-zinc-900/50">
            <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">Bajas · más adelante</p>
            <p className="text-zinc-600 dark:text-zinc-400">El mismo motor con otra lista de pasos:</p>
            <ol className="list-inside list-decimal space-y-0.5 text-zinc-600 dark:text-zinc-400">
              <li>Devolver el lote del banco de libros</li>
              <li>Recoger el iPad</li>
              <li>Sacarlo de Apple School Manager</li>
              <li>Licencias: liberar o dar por perdidas</li>
              <li>Suspender el correo de Google</li>
              <li>Baja en Educamos</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}

function FilaPaso({ paso, n, onCambiar }: { paso: PasoProceso; n: number; onCambiar: (c: Partial<PasoProceso>) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: paso.clave });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-zinc-100 bg-white px-3 py-2.5 first:border-t-0 dark:border-zinc-800 dark:bg-zinc-900',
        isDragging && 'relative z-10 rounded-xl shadow-xl ring-1 ring-zinc-300 dark:ring-zinc-600',
        !paso.activo && 'opacity-60',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Mover ${paso.titulo}`}
        className="flex h-10 w-8 cursor-grab touch-none items-center justify-center text-zinc-400 hover:text-zinc-700 active:cursor-grabbing"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <span className="w-6 font-mono text-sm text-zinc-400">{String(n).padStart(2, '0')}</span>
      <span className={cn('h-8 w-1 rounded', BORDE_RESPONSABLE[paso.responsable])} />
      <span className="min-w-0 flex-[1_1_12rem]">
        <span className="block font-medium text-zinc-900 dark:text-zinc-100">{paso.titulo}</span>
        <span className="block text-xs text-zinc-500">{paso.fuente}</span>
      </span>
      <select
        aria-label={`Quién lleva ${paso.titulo}`}
        value={paso.responsable}
        onChange={(e) => onCambiar({ responsable: e.target.value as Responsable })}
        className={cn(ESTILO_CAMPO, 'h-10 w-32 text-sm')}
      >
        {RESPONSABLES.map((r) => (
          <option key={r} value={r}>
            {RESPONSABLE_LABEL[r]}
          </option>
        ))}
      </select>
      {paso.desdeFijo ? (
        <span className="w-36 text-xs text-zinc-500">{paso.desdeFijo}</span>
      ) : (
        <select
          aria-label={`Desde qué curso le toca ${paso.titulo}`}
          value={paso.desde ?? ''}
          onChange={(e) => onCambiar({ desde: e.target.value || null })}
          className={cn(ESTILO_CAMPO, 'h-10 w-36 text-sm')}
        >
          <option value="">Todos</option>
          {CURSOS.map((c) => (
            <option key={c.codigo} value={c.codigo}>
              Desde {c.etiqueta}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={paso.activo}
        aria-label={`${paso.titulo} activo`}
        onClick={() => onCambiar({ activo: !paso.activo })}
        className={cn(
          'relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors',
          paso.activo ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-300 dark:bg-zinc-700',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all dark:bg-zinc-900',
            paso.activo ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  );
}

function Avisos({
  avisos,
  correoConfigurado,
  onCambiar,
}: {
  avisos: AvisosNouvinguts;
  correoConfigurado: boolean;
  onCambiar: (evento: EventoAviso, grupos: GrupoAviso[]) => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
        <Mail className="h-3.5 w-3.5" /> Avisos por correo
      </p>
      {!correoConfigurado && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          El correo no está configurado en este servidor: se guarda, pero no saldrá nada.
        </p>
      )}
      {EVENTOS_AVISO.map((e) => (
        <div key={e} className="space-y-1.5 border-t border-zinc-100 pt-3 first:border-t-0 first:pt-0 dark:border-zinc-800">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">{EVENTO_AVISO[e].titulo}</p>
          <p className="text-xs text-zinc-500">{EVENTO_AVISO[e].detalle}</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={`A quién avisar: ${EVENTO_AVISO[e].titulo}`}>
            {GRUPOS_AVISO.map((g) => {
              const on = avisos[e].includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onCambiar(e, on ? avisos[e].filter((x) => x !== g) : GRUPOS_AVISO.filter((x) => x === g || avisos[e].includes(x)))}
                  className={cn(
                    'h-8 cursor-pointer rounded-full border px-3 text-xs',
                    on
                      ? 'border-blue-600 bg-blue-600 font-medium text-white'
                      : 'border-zinc-300 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400',
                  )}
                >
                  {GRUPO_AVISO_LABEL[g]}
                </button>
              );
            })}
            {avisos[e].length === 0 && <span className="self-center text-xs text-zinc-400">No avisa a nadie</span>}
          </div>
        </div>
      ))}
      <p className="text-xs text-zinc-500">Va a las personas con ese rol en Usuarios (TIC incluye SuperTIC), nunca a quien lo provoca.</p>
    </div>
  );
}

function hace30(): string {
  const d = new Date(Date.now() - 30 * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Previa = { nuevos: number; inicioCurso: number; nombres: string[] };

function TraerAltas() {
  const router = useRouter();
  const [desde, setDesde] = useState(hace30);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function llamar(dry: boolean) {
    setOcupado(true);
    try {
      const r = await pedir<Previa & { vinculados: number; dudosos: number }>('/api/nouvinguts/importar', {
        method: 'POST',
        body: JSON.stringify({ desde, dry }),
      });
      if (dry) {
        setPrevia(r);
        return;
      }
      haptic.success();
      toast.success(`${r.nuevos} entran en nouvinguts${r.vinculados ? ` · ${r.vinculados} vinculados con lo apuntado` : ''}`);
      setPrevia(null);
      router.push('/gestion/nouvinguts');
      router.refresh();
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">Traer altas que ya había</p>
      <p className="text-zinc-600 dark:text-zinc-400">
        Para estrenarlo: las altas de la BBDD central desde una fecha que todavía no están aquí (sin los 3 años de verano).
      </p>
      <div className="flex gap-2">
        <input
          type="date"
          value={desde}
          onChange={(e) => {
            setDesde(e.target.value);
            setPrevia(null);
          }}
          className={cn(ESTILO_CAMPO, 'h-10 text-sm')}
        />
        <button
          type="button"
          disabled={ocupado || !desde}
          onClick={() => llamar(true)}
          className="h-10 shrink-0 cursor-pointer rounded-xl border border-zinc-300 px-3 font-medium disabled:opacity-50 dark:border-zinc-700"
        >
          Ver cuántas
        </button>
      </div>
      {previa && (
        <div className="space-y-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
          <p>
            <strong>{previa.nuevos}</strong> entrarían
            {previa.inicioCurso > 0 && ` (y ${previa.inicioCurso} de 3 años de inicio de curso, que no)`}.
          </p>
          {previa.nombres.length > 0 && (
            <p className="text-xs text-zinc-500">
              {previa.nombres.join(', ')}
              {previa.nuevos > previa.nombres.length && '…'}
            </p>
          )}
          {previa.nuevos > 0 && (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => llamar(false)}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white disabled:opacity-60"
            >
              {ocupado && <Loader2 className="h-4 w-4 animate-spin" />} Traer {previa.nuevos}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
