'use client';

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
// su clase — y se elige de un toque.
export function StudentPicker({ alumnos, value, onChange }: StudentPickerProps) {
  if (alumnos.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-3 text-sm text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
        No hay alumnos dados de alta en el módulo. Se añaden desde el panel de gestión.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {alumnos.map((a) => {
        const activo = value?.abcStudentId === a.abcStudentId;
        return (
          <button
            key={a.abcStudentId}
            type="button"
            onClick={() => onChange({ abcStudentId: a.abcStudentId, label: a.siglas })}
            aria-pressed={activo}
            className={`inline-flex items-baseline gap-1.5 rounded-xl border px-4 py-3 text-base font-semibold tracking-wide transition-colors ${
              activo
                ? 'border-teal-600 bg-teal-600 text-white'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-teal-300 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-200 dark:hover:border-teal-600'
            }`}
          >
            {a.siglas}
            <span className={`text-xs font-normal ${activo ? 'text-teal-100' : 'text-zinc-400'}`}>{a.clase}</span>
          </button>
        );
      })}
    </div>
  );
}
