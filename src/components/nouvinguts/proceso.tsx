'use client';

// /gestion/nouvinguts/proceso: el orden de los pasos (arrastrando, con ratón, dedo o teclado),
// quién lleva cada uno, desde qué curso le toca y si está activo. Solo SuperTIC y TIC. Aquí
// también se traen las altas que ya había al estrenar el módulo.
import { useState } from 'react';
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
import { GripVertical, Loader2, Mail } from 'lucide-react';
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
import { Aviso } from '@/components/ui/aviso';
import { BarraAcciones } from '@/components/ui/barra-acciones';
import { Button } from '@/components/ui/button';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Input } from '@/components/ui/input';
import { Interruptor } from '@/components/ui/interruptor';
import { Rotulo } from '@/components/ui/rotulo';
import { Selector } from '@/components/ui/selector';
import { Tarjeta, claseTarjeta } from '@/components/ui/tarjeta';
import { EnlaceVolver } from '@/components/ui/cabecera-modulo';
import { BORDE_RESPONSABLE, pedir } from './comun';

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
      <EnlaceVolver href="/gestion/nouvinguts">Nouvinguts</EnlaceVolver>
      <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        Arrastra los pasos para cambiar el orden: es el de la ficha de cada alumno y el de las columnas de la lista. Lo que
        desactives deja de contar para todos.
      </p>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className={cn(claseTarjeta, 'overflow-hidden')}>
          {/* `id` fijo: sin él, los ids de accesibilidad de dnd-kit no casan entre servidor y cliente */}
          <DndContext id="nouvinguts-proceso" sensors={sensores} collisionDetection={closestCenter} onDragEnd={alSoltar}>
            <SortableContext items={pasos.map((p) => p.clave)} strategy={verticalListSortingStrategy}>
              {pasos.map((p, i) => (
                <FilaPaso key={p.clave} paso={p} n={i + 1} onCambiar={(c) => cambiar(p.clave, c)} />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <aside className="space-y-4">
          <Tarjeta className="space-y-3 p-5">
            <Rotulo>Aviso de atasco</Rotulo>
            <label className="flex flex-wrap items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              El día sale en ámbar si lleva más de
              <Input
                type="number"
                min={1}
                max={365}
                value={diasAtasco}
                onChange={(e) => {
                  setDiasAtasco(Math.max(1, Math.min(365, Number(e.target.value) || 1)));
                  setSucio(true);
                }}
                className="w-20 font-mono"
              />
              días
            </label>
          </Tarjeta>
          <Tarjeta className="space-y-2 p-5 text-sm">
            <Rotulo>«Desde» cambia cada curso</Rotulo>
            <p className="text-zinc-700 dark:text-zinc-300">
              En 2026-27 iPad, ASM y licencias van desde 6º EP. El curso que viene 6º deja de tener iPad y licencias: se pone
              «1º ESO» aquí y listo, sin tocar código. El banco de libros sigue los ajustes del centro.
            </p>
          </Tarjeta>
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
            <Rotulo>Bajas · más adelante</Rotulo>
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

      <BarraAcciones visible={sucio} resumen="Hay cambios sin guardar" ancho="ancho">
        <Button type="button" onClick={guardar} disabled={guardando}>
          {guardando && <Loader2 className="animate-spin" />} Guardar el proceso
        </Button>
      </BarraAcciones>
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
        className="flex h-11 w-9 cursor-grab touch-none items-center justify-center rounded-lg text-zinc-400 outline-none hover:text-zinc-700 focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing dark:hover:text-zinc-200"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <span className="w-6 font-mono text-sm text-zinc-500 dark:text-zinc-400">{String(n).padStart(2, '0')}</span>
      <span className={cn('h-8 w-1 rounded', BORDE_RESPONSABLE[paso.responsable])} />
      <span className="min-w-0 flex-[1_1_12rem]">
        <span className="block font-medium text-zinc-900 dark:text-zinc-100">{paso.titulo}</span>
        <span className="block text-xs text-zinc-500 dark:text-zinc-400">{paso.fuente}</span>
      </span>
      <Selector
        aria-label={`Quién lleva ${paso.titulo}`}
        value={paso.responsable}
        onChange={(e) => onCambiar({ responsable: e.target.value as Responsable })}
        className="w-36"
      >
        {RESPONSABLES.map((r) => (
          <option key={r} value={r}>
            {RESPONSABLE_LABEL[r]}
          </option>
        ))}
      </Selector>
      {paso.desdeFijo ? (
        <span className="w-40 text-xs text-zinc-500 dark:text-zinc-400">{paso.desdeFijo}</span>
      ) : (
        <Selector
          aria-label={`Desde qué curso le toca ${paso.titulo}`}
          value={paso.desde ?? ''}
          onChange={(e) => onCambiar({ desde: e.target.value || null })}
          className="w-40"
        >
          <option value="">Todos</option>
          {CURSOS.map((c) => (
            <option key={c.codigo} value={c.codigo}>
              Desde {c.etiqueta}
            </option>
          ))}
        </Selector>
      )}
      <Interruptor
        activo={paso.activo}
        onChange={(activo) => onCambiar({ activo })}
        etiqueta={`${paso.titulo} activo`}
        etiquetaOculta
      />
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
    <Tarjeta className="space-y-3 p-5 text-sm">
      <Rotulo className="flex items-center gap-1.5">
        <Mail className="h-3.5 w-3.5" /> Avisos por correo
      </Rotulo>
      {!correoConfigurado && <Aviso tono="aviso">El correo no está configurado en este servidor: se guarda, pero no saldrá nada.</Aviso>}
      {EVENTOS_AVISO.map((e) => (
        <div key={e} className="space-y-1.5 border-t border-zinc-100 pt-3 first:border-t-0 first:pt-0 dark:border-zinc-800">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">{EVENTO_AVISO[e].titulo}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{EVENTO_AVISO[e].detalle}</p>
          <Filtros etiqueta={`A quién avisar: ${EVENTO_AVISO[e].titulo}`}>
            {GRUPOS_AVISO.map((g) => {
              const on = avisos[e].includes(g);
              return (
                <Filtro
                  key={g}
                  activo={on}
                  onClick={() => onCambiar(e, on ? avisos[e].filter((x) => x !== g) : GRUPOS_AVISO.filter((x) => x === g || avisos[e].includes(x)))}
                >
                  {GRUPO_AVISO_LABEL[g]}
                </Filtro>
              );
            })}
            {avisos[e].length === 0 && <span className="text-xs text-zinc-500 dark:text-zinc-400">No avisa a nadie</span>}
          </Filtros>
        </div>
      ))}
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Va a las personas con ese rol en Usuarios (TIC incluye SuperTIC), nunca a quien lo provoca.
      </p>
    </Tarjeta>
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
    <Tarjeta className="space-y-3 p-5 text-sm">
      <Rotulo>Traer altas que ya había</Rotulo>
      <p className="text-zinc-600 dark:text-zinc-400">
        Para estrenarlo: las altas de la BBDD central desde una fecha que todavía no están aquí (sin los 3 años de verano).
      </p>
      <div className="flex gap-2">
        <Input
          type="date"
          aria-label="Desde"
          value={desde}
          onChange={(e) => {
            setDesde(e.target.value);
            setPrevia(null);
          }}
        />
        <Button type="button" variant="outline" disabled={ocupado || !desde} onClick={() => llamar(true)}>
          Ver cuántas
        </Button>
      </div>
      {previa && (
        <div className="space-y-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
          <p>
            <strong>{previa.nuevos}</strong> entrarían
            {previa.inicioCurso > 0 && ` (y ${previa.inicioCurso} de 3 años de inicio de curso, que no)`}.
          </p>
          {previa.nombres.length > 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {previa.nombres.join(', ')}
              {previa.nuevos > previa.nombres.length && '…'}
            </p>
          )}
          {previa.nuevos > 0 && (
            <Button type="button" size="sm" disabled={ocupado} onClick={() => llamar(false)}>
              {ocupado && <Loader2 className="animate-spin" />} Traer {previa.nuevos}
            </Button>
          )}
        </div>
      )}
    </Tarjeta>
  );
}
