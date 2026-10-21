'use client';

import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import type { AlumnoSeguimiento } from '@/lib/abc-server';

/** Selección del formulario: siempre una fila de config del ABC. */
export type StudentSelection = { abcStudentId: string; label: string } | null;

interface StudentPickerProps {
  alumnos: AlumnoSeguimiento[];
  value: StudentSelection;
  onChange: (sel: StudentSelection) => void;
}

// Sin buscador a propósito: el alumnado del ABC se da de alta a mano en el panel (son unos
// pocos, con muchas necesidades), así que aquí salen todos de un vistazo — dos iniciales y
// su clase — y se elige de un toque. El elegido, en negro como las pastillas de `Filtro`.
export function StudentPicker({ alumnos, value, onChange }: StudentPickerProps) {
  if (alumnos.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
        No hay alumnos dados de alta en el módulo. Se añaden desde el panel de gestión.
      </p>
    );
  }

  return (
    <div role="group" aria-label="Alumno" className="flex flex-wrap gap-2">
      {alumnos.map((a) => {
        const activo = value?.abcStudentId === a.abcStudentId;
        return (
          <button
            key={a.abcStudentId}
            type="button"
            onClick={() => {
              haptic.tap();
              onChange({ abcStudentId: a.abcStudentId, label: a.siglas });
            }}
            aria-pressed={activo}
            className={cn(
              'inline-flex min-h-12 cursor-pointer items-baseline gap-1.5 rounded-xl border px-4 py-3 text-base font-semibold tracking-wide transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              activo
                ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                : 'border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800',
            )}
          >
            {a.siglas}
            <span className={cn('text-xs font-normal', activo ? 'opacity-80' : 'text-zinc-500 dark:text-zinc-400')}>
              {a.clase}
            </span>
          </button>
        );
      })}
    </div>
  );
}
