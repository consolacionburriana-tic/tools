'use client';

// Los arreglos: lo que hay que hacer en un aula o en un kit de robótica. Una lista que se marca
// de un toque (y se desmarca, con Deshacer), ordenada por prioridad; y la hoja de apuntar uno.
// La misma lista sale en la ficha del aula, en la hoja de un kit y en la sección Arreglos.
import { useState } from 'react';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import {
  AREAS,
  AREA_LABEL,
  PRIORIDADES,
  PRIORIDAD_LABEL,
  PRIORIDAD_PESO,
  type Area,
  type Prioridad,
} from '@/lib/inventario';
import type { ArregloInv } from '@/lib/inventario-server';
import { borrarArreglo, guardarArreglo, marcarArreglo } from '@/app/gestion/inventario/acciones';
import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { Textarea } from '@/components/ui/textarea';
import { Selector } from '@/components/ui/selector';
import { Segmentado } from '@/components/ui/segmentado';
import { Estado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { ConfirmarEnLinea } from '@/components/ui/confirmar';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cuando, OpcionesAulas, useAccion, type FilaAula } from './comun';

export const TONO_PRIORIDAD: Record<Prioridad, 'error' | 'neutro' | 'info'> = { urgente: 'error', normal: 'neutro', baja: 'info' };

export function ordenarArreglos(lista: readonly ArregloInv[]): ArregloInv[] {
  return [...lista].sort(
    (a, b) =>
      Number(Boolean(a.hechoAt)) - Number(Boolean(b.hechoAt)) ||
      PRIORIDAD_PESO[a.prioridad as Prioridad] - PRIORIDAD_PESO[b.prioridad as Prioridad] ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

/** Una fila de arreglo: el check de 44 px, el texto, dónde y la prioridad. */
export function FilaArreglo({
  a,
  donde,
  onEditar,
}: {
  a: ArregloInv;
  /** Dónde está («Aula 12 · 3º EP B», «L3»), si la lista mezcla sitios. */
  donde?: string | null;
  onEditar?: (a: ArregloInv) => void;
}) {
  const { correr, ocupado } = useAccion();
  const hecho = Boolean(a.hechoAt);

  async function alternar() {
    const r = await correr(() => marcarArreglo(a.id, !hecho));
    if (r !== false && !hecho) {
      toast.success('Hecho', { action: { label: 'Deshacer', onClick: () => void marcarArreglo(a.id, false) } });
    }
  }

  return (
    <li className="flex items-start gap-2 py-1.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={hecho}
        aria-label={hecho ? `Marcar como pendiente: ${a.texto}` : `Marcar como hecho: ${a.texto}`}
        disabled={ocupado}
        onClick={alternar}
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        <span
          className={cn(
            'flex size-6 items-center justify-center rounded-md border-2 transition-colors',
            hecho ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-zinc-400 bg-white dark:border-zinc-500 dark:bg-zinc-900',
          )}
        >
          {hecho && <Check className="size-4" strokeWidth={3} />}
        </span>
      </button>
      <div className="min-w-0 flex-1 pt-2">
        <p className={cn('text-sm', hecho ? 'text-zinc-500 line-through dark:text-zinc-400' : 'text-zinc-900 dark:text-zinc-100')}>{a.texto}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          {donde && <Etiqueta>{donde}</Etiqueta>}
          {!hecho && a.prioridad !== 'normal' && <Estado tono={TONO_PRIORIDAD[a.prioridad as Prioridad]}>{PRIORIDAD_LABEL[a.prioridad as Prioridad]}</Estado>}
          <span>{AREA_LABEL[a.area as Area] ?? a.area}</span>
          {hecho && <span>· hecho el {cuando(a.hechoAt, a.hechoPor)}</span>}
        </div>
      </div>
      {onEditar && (
        <Button variant="ghost" size="icon-sm" aria-label={`Editar: ${a.texto}`} onClick={() => onEditar(a)}>
          <Pencil />
        </Button>
      )}
    </li>
  );
}

/** Los arreglos de un sitio (un aula o un kit), con «Apuntar» y la hoja de editar. */
export function ListaArreglos({
  arreglos,
  aulaId = null,
  kitId = null,
  areaPorDefecto = 'otro',
  filas,
  verHechos = true,
}: {
  arreglos: readonly ArregloInv[];
  aulaId?: string | null;
  kitId?: string | null;
  areaPorDefecto?: Area;
  filas: readonly FilaAula[];
  verHechos?: boolean;
}) {
  const [editando, setEditando] = useState<ArregloInv | 'nuevo' | null>(null);
  const [mostrarHechos, setMostrarHechos] = useState(false);
  const ordenados = ordenarArreglos(arreglos);
  const pendientes = ordenados.filter((a) => !a.hechoAt);
  const hechos = ordenados.filter((a) => a.hechoAt);
  return (
    <div className="space-y-1">
      {pendientes.length === 0 && <p className="py-2 text-sm text-zinc-500 dark:text-zinc-400">Nada pendiente.</p>}
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {pendientes.map((a) => (
          <FilaArreglo key={a.id} a={a} onEditar={setEditando} />
        ))}
        {mostrarHechos && hechos.map((a) => <FilaArreglo key={a.id} a={a} onEditar={setEditando} />)}
      </ul>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="suave" size="sm" onClick={() => setEditando('nuevo')}>
          <Plus aria-hidden /> Apuntar arreglo
        </Button>
        {verHechos && hechos.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setMostrarHechos((v) => !v)}>
            {mostrarHechos ? 'Ocultar lo hecho' : `Ver lo hecho (${hechos.length})`}
          </Button>
        )}
      </div>
      {editando && (
        <HojaArreglo
          arreglo={editando === 'nuevo' ? null : editando}
          aulaId={aulaId}
          kitId={kitId}
          areaPorDefecto={areaPorDefecto}
          filas={filas}
          fijo
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  );
}

/**
 * Apuntar o editar un arreglo. `fijo` = el sitio ya viene dado (desde la ficha del aula o el kit)
 * y no se pregunta; sin él, se elige el aula.
 */
export function HojaArreglo({
  arreglo,
  aulaId = null,
  kitId = null,
  areaPorDefecto = 'otro',
  filas,
  fijo = false,
  onCerrar,
}: {
  arreglo: ArregloInv | null;
  aulaId?: string | null;
  kitId?: string | null;
  areaPorDefecto?: Area;
  filas: readonly FilaAula[];
  fijo?: boolean;
  onCerrar: () => void;
}) {
  const [texto, setTexto] = useState(arreglo?.texto ?? '');
  const [area, setArea] = useState<Area>((arreglo?.area as Area) ?? areaPorDefecto);
  const [prioridad, setPrioridad] = useState<Prioridad>((arreglo?.prioridad as Prioridad) ?? 'normal');
  const [aula, setAula] = useState(arreglo?.aulaId ?? aulaId ?? '');
  const { correr, ocupado } = useAccion();

  async function guardar() {
    const r = await correr(
      () =>
        guardarArreglo({
          id: arreglo?.id,
          aulaId: (fijo ? (arreglo?.aulaId ?? aulaId) : aula) || null,
          kitId: arreglo?.kitId ?? kitId,
          area,
          texto,
          prioridad,
        }),
      arreglo ? 'Arreglo guardado' : 'Arreglo apuntado',
    );
    if (r !== false) onCerrar();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent variante="hoja" className="sm:max-w-lg">
        <DialogTitle>{arreglo ? 'Editar arreglo' : 'Apuntar arreglo'}</DialogTitle>
        <DialogDescription>Lo que hay que hacer, en una línea. Se marca como hecho desde la lista.</DialogDescription>
        <div className="space-y-4">
          <Campo etiqueta="Qué hay que hacer" id="arr-texto">
            <Textarea
              id="arr-texto"
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={2}
              placeholder="Cambiar el filtro del proyector, falta una pieza del L3…"
            />
          </Campo>
          {!fijo && (
            <Campo etiqueta="Dónde" id="arr-aula">
              <Selector id="arr-aula" value={aula} onChange={(e) => setAula(e.target.value)}>
                <option value="">Sin aula (general)</option>
                <OpcionesAulas filas={filas} />
              </Selector>
            </Campo>
          )}
          <Campo etiqueta="Prioridad">
            <Segmentado
              etiqueta="Prioridad"
              lleno
              opciones={PRIORIDADES.map((p) => ({ valor: p, etiqueta: PRIORIDAD_LABEL[p] }))}
              valor={prioridad}
              onChange={setPrioridad}
            />
          </Campo>
          <Campo etiqueta="De qué es" id="arr-area">
            <Selector id="arr-area" value={area} onChange={(e) => setArea(e.target.value as Area)}>
              {AREAS.map((x) => (
                <option key={x} value={x}>
                  {AREA_LABEL[x]}
                </option>
              ))}
            </Selector>
          </Campo>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              onClick={() => {
                haptic.tap();
                void guardar();
              }}
              cargando={ocupado}
              disabled={!texto.trim()}
            >
              <Check aria-hidden /> {arreglo ? 'Guardar' : 'Apuntar'}
            </Button>
            {arreglo && (
              <ConfirmarEnLinea
                etiqueta="Borrar"
                icono={<Trash2 aria-hidden />}
                pregunta="¿Borrarlo? Si ya está hecho, mejor márcalo."
                onConfirmar={async () => {
                  const r = await correr(() => borrarArreglo(arreglo.id), 'Arreglo borrado');
                  if (r !== false) onCerrar();
                }}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
