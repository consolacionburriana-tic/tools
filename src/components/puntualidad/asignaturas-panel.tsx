'use client';

// Catálogo de asignaturas del módulo. Viene sembrado con las de secundaria como relleno de
// ejemplo; aquí se ajustan los nombres, se desactiva lo que no se use y —para el futuro— se
// le puede asignar el profe que la imparte: es el destinatario del aviso "un alumno llegó
// tarde a tu clase", que está escrito pero apagado hasta que los horarios estén en la app.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Interruptor } from './ui';

interface Asignatura {
  id: string;
  nombre: string;
  abreviatura: string | null;
  eduTeacherId: string | null;
  active: boolean;
}

export function AsignaturasPanel({
  asignaturas,
  profes,
}: {
  asignaturas: Asignatura[];
  profes: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [nueva, setNueva] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);

  const refrescar = () => startTransition(() => router.refresh());

  const patch = async (id: string, cambios: Record<string, unknown>) => {
    setOcupado(id);
    try {
      const res = await fetch('/api/puntualidad/admin/asignaturas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...cambios }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'No se pudo guardar');
      refrescar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setOcupado(null);
    }
  };

  const crear = async () => {
    const nombre = nueva.trim();
    if (nombre.length < 2) return;
    setOcupado('nueva');
    try {
      const res = await fetch('/api/puntualidad/admin/asignaturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'No se pudo crear');
      setNueva('');
      toast.success(`"${nombre}" añadida`);
      refrescar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear');
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Asignaturas</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Son las que salen como chips en el formulario. Las que vienen puestas son de ejemplo: cámbialas por las de
          verdad y desactiva las que no uséis.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') crear();
          }}
          placeholder="Añadir asignatura…"
          className="h-11 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-orange-400 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="button"
          onClick={crear}
          disabled={nueva.trim().length < 2 || ocupado === 'nueva'}
          className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800"
        >
          {ocupado === 'nueva' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Añadir
        </button>
      </div>

      <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {asignaturas.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <NombreEditable
              nombre={a.nombre}
              abreviatura={a.abreviatura}
              onGuardar={(nombre, abreviatura) => patch(a.id, { nombre, abreviatura: abreviatura || null })}
            />
            <select
              value={a.eduTeacherId ?? ''}
              onChange={(e) => patch(a.id, { eduTeacherId: e.target.value || null })}
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-600 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              <option value="">Sin profe asignado</option>
              {profes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <div className="w-56 shrink-0">
              <Interruptor activo={a.active} etiqueta={a.active ? 'Activa' : 'Desactivada'} onChange={(v) => patch(a.id, { active: v })} />
            </div>
            {ocupado === a.id && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function NombreEditable({
  nombre,
  abreviatura,
  onGuardar,
}: {
  nombre: string;
  abreviatura: string | null;
  onGuardar: (nombre: string, abreviatura: string) => void;
}) {
  const [n, setN] = useState(nombre);
  const [abrev, setAbrev] = useState(abreviatura ?? '');
  const sucio = n !== nombre || abrev !== (abreviatura ?? '');
  return (
    <div className="flex min-w-[16rem] flex-1 items-center gap-2">
      <input
        value={n}
        onChange={(e) => setN(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-medium text-zinc-900 outline-none hover:border-zinc-200 focus:border-orange-400 dark:text-zinc-100 dark:hover:border-zinc-700"
      />
      <input
        value={abrev}
        onChange={(e) => setAbrev(e.target.value)}
        placeholder="abrev."
        maxLength={12}
        className="w-20 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-xs text-zinc-500 outline-none hover:border-zinc-200 focus:border-orange-400 dark:hover:border-zinc-700"
      />
      {sucio && (
        <button
          type="button"
          onClick={() => onGuardar(n.trim(), abrev.trim())}
          className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-2.5 py-1.5 text-xs font-semibold text-white"
        >
          <Check className="h-3.5 w-3.5" /> Guardar
        </button>
      )}
    </div>
  );
}
