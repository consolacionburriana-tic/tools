'use client';

import { useMemo, useState } from 'react';
import { Check, CircleSlash, ExternalLink, Loader2, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';

export interface AlumnoRow {
  eduStudentId: string;
  nombre: string;
  clase: string;
  signupId: string | null;
  estado: 'pendiente' | 'apuntado' | 'no_va';
  justificanteEstado: string | null;
  justificanteSubidoAt: string | null;
  emailContacto: string | null;
}

type Cubo = 'pendientes' | 'entregados' | 'validados' | 'no_van';

function cuboDe(a: AlumnoRow): Cubo {
  if (a.estado === 'no_va') return 'no_van';
  if (a.justificanteEstado === 'validado') return 'validados';
  if (a.justificanteEstado === 'subido' || a.justificanteEstado === 'rechazado') return 'entregados';
  return 'pendientes';
}

// Seguimiento del detalle de salida: filtros por estado + acciones de validación.
export function TripSeguimiento({ alumnos: inicial }: { alumnos: AlumnoRow[] }) {
  const [alumnos, setAlumnos] = useState(inicial);
  const [filtro, setFiltro] = useState<Cubo>('entregados');
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cuentas = useMemo(() => {
    const c: Record<Cubo, number> = { pendientes: 0, entregados: 0, validados: 0, no_van: 0 };
    alumnos.forEach((a) => c[cuboDe(a)]++);
    return c;
  }, [alumnos]);

  const visibles = alumnos.filter((a) => cuboDe(a) === filtro);

  async function patch(a: AlumnoRow, cambios: { justificanteEstado?: string; estado?: string }, optimista: Partial<AlumnoRow>) {
    if (!a.signupId) return;
    setOcupado(a.signupId);
    const previo = alumnos;
    setAlumnos((prev) => prev.map((x) => (x.signupId === a.signupId ? { ...x, ...optimista } : x)));
    try {
      const res = await fetch(`/api/salidas/admin/signups/${a.signupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      haptic.tap();
    } catch (e) {
      setAlumnos(previo);
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
      haptic.warning();
    } finally {
      setOcupado(null);
    }
  }

  const chips: { key: Cubo; label: string; tono: string }[] = [
    { key: 'pendientes', label: 'Pendientes', tono: 'text-amber-600 dark:text-amber-400' },
    { key: 'entregados', label: 'Entregados', tono: 'text-blue-600 dark:text-blue-400' },
    { key: 'validados', label: 'Validados', tono: 'text-emerald-600 dark:text-emerald-400' },
    { key: 'no_van', label: 'No van', tono: 'text-zinc-500' },
  ];

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap gap-1.5 border-b border-zinc-100 p-3 dark:border-zinc-800">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFiltro(c.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              filtro === c.key
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : `bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 ${c.tono}`
            }`}
          >
            {c.label} · {cuentas[c.key]}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <p className="p-6 text-center text-sm text-zinc-400">Nadie en este estado.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {visibles.map((a) => (
            <li key={a.eduStudentId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {a.nombre}
                  <span className="ml-2 text-xs font-normal text-zinc-400">{a.clase}</span>
                  {a.justificanteEstado === 'rechazado' && (
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">
                      rechazado
                    </span>
                  )}
                </p>
                {a.justificanteSubidoAt && (
                  <p className="text-xs text-zinc-400">
                    subido el {new Date(a.justificanteSubidoAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {a.emailContacto ? ` · ${a.emailContacto}` : ''}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {ocupado === a.signupId && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
                {a.signupId && a.justificanteEstado && (
                  <a
                    href={`/api/salidas/admin/justificante/${a.signupId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Ver
                  </a>
                )}
                {filtro === 'entregados' && a.justificanteEstado === 'subido' && (
                  <>
                    <button
                      type="button"
                      onClick={() => void patch(a, { justificanteEstado: 'validado' }, { justificanteEstado: 'validado' })}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      <Check className="h-3.5 w-3.5" /> Validar
                    </button>
                    <button
                      type="button"
                      onClick={() => void patch(a, { justificanteEstado: 'rechazado' }, { justificanteEstado: 'rechazado' })}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      <X className="h-3.5 w-3.5" /> Rechazar
                    </button>
                  </>
                )}
                {filtro === 'validados' && (
                  <button
                    type="button"
                    onClick={() => void patch(a, { justificanteEstado: 'subido' }, { justificanteEstado: 'subido' })}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Quitar validación
                  </button>
                )}
                {filtro === 'no_van' && a.signupId && (
                  <button
                    type="button"
                    onClick={() => void patch(a, { estado: 'apuntado' }, { estado: 'apuntado' })}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Sí que va
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-zinc-100 px-4 py-2.5 text-xs text-zinc-400 dark:border-zinc-800">
        <CircleSlash className="mr-1 inline h-3.5 w-3.5" />
        Para marcar &quot;no va&quot; desde aquí pídeselo a la familia (lo hacen en el enlace público) o usa
        &quot;Rechazar&quot; para reclamar otro justificante.
      </p>
    </div>
  );
}
