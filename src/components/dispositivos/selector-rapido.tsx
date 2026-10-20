'use client';

// Cómo tiene el iPad un alumno, en pequeño: para resolverlo desde otro módulo sin salir
// (lo estrena el paso «iPad» de Nouvinguts). Lo fino —qué iPad del cole, de qué hermano,
// la firma— se hace en Dispositivos 1:1, y para eso está el enlace.
import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { academicYearActual } from '@/lib/constants';
import { cursosDeCompra, esModalidad, llevaCompra, MODALIDAD_LABEL, MODALIDADES, type Modalidad } from '@/lib/dispositivos';
import { COLOR_MODALIDAD, pedir } from './comun';

export interface DispositivoActual {
  modalidad: string;
  texto: string;
  cursoCompra: string | null;
  aCasa: boolean | null;
}

export function SelectorRapido({
  eduStudentId,
  actual,
  onGuardado,
}: {
  eduStudentId: string;
  actual: DispositivoActual | null;
  onGuardado: () => void | Promise<void>;
}) {
  const cursoActual = academicYearActual();
  const [modalidad, setModalidad] = useState<Modalidad | null>(actual && esModalidad(actual.modalidad) ? actual.modalidad : null);
  const [curso, setCurso] = useState(actual?.cursoCompra ?? (actual ? '' : cursoActual));
  const [aCasa, setACasa] = useState(Boolean(actual?.aCasa));
  const [ocupado, setOcupado] = useState(false);

  async function guardar() {
    if (!modalidad) return;
    setOcupado(true);
    try {
      await pedir('/api/dispositivos/alumnos', 'POST', {
        eduStudentId,
        modalidad,
        cursoCompra: llevaCompra(modalidad) ? curso || null : null,
        aCasa: modalidad === 'prestado' ? aCasa : null,
      });
      haptic.success();
      toast.success('Guardado en Dispositivos 1:1');
      await onGuardado();
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se ha podido guardar');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MODALIDADES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={modalidad === m}
            onClick={() => {
              haptic.tap();
              setModalidad(m);
            }}
            className={cn(
              'h-11 cursor-pointer rounded-xl border text-sm transition-colors',
              modalidad === m ? cn(COLOR_MODALIDAD[m], 'font-semibold') : 'border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800',
            )}
          >
            {MODALIDAD_LABEL[m]}
          </button>
        ))}
      </div>
      {modalidad && llevaCompra(modalidad) && (
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Curso de compra{modalidad === 'hermano' ? ' (el del hermano)' : ''}</span>
          <select
            value={curso}
            onChange={(e) => setCurso(e.target.value)}
            className="h-10 rounded-lg border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">No se sabe</option>
            {cursosDeCompra(cursoActual, 8).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      )}
      {modalidad === 'prestado' && (
        <div className="flex flex-wrap gap-2">
          {[
            { v: true, t: 'Se lo lleva a casa' },
            { v: false, t: 'Se queda en el cole' },
          ].map((o) => (
            <button
              key={o.t}
              type="button"
              aria-pressed={aCasa === o.v}
              onClick={() => setACasa(o.v)}
              className={cn(
                'h-10 cursor-pointer rounded-lg border px-3 text-sm',
                aCasa === o.v ? 'border-zinc-900 bg-zinc-100 font-semibold dark:border-zinc-100 dark:bg-zinc-800' : 'border-zinc-300 dark:border-zinc-700',
              )}
            >
              {o.t}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!modalidad || ocupado}
          onClick={() => void guardar()}
          className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-default disabled:opacity-50"
        >
          {ocupado && <Loader2 className="h-4 w-4 animate-spin" />} {actual ? 'Cambiar' : 'Guardar'}
        </button>
        <Link
          href={`/gestion/dispositivos?vista=alumnado&alumno=${eduStudentId}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline dark:text-blue-300"
        >
          {modalidad === 'prestado' || modalidad === 'hermano' ? 'Qué iPad y el resto, en Dispositivos 1:1' : 'Abrir en Dispositivos 1:1'}
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
