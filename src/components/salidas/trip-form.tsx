'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';

export interface ClaseOption {
  curso: string;
  letra: string | null;
  label: string;
}
export interface ProfeOption {
  id: string;
  nombre: string;
}

interface TripFormProps {
  clases: ClaseOption[];
  profes: ProfeOption[];
  /** Si viene, es edición */
  inicial?: {
    id: string;
    nombre: string;
    descripcion: string | null;
    fecha: string | null;
    importe: string | null;
    clases: { curso: string; letra: string | null }[];
    responsables: string[];
  };
}

const claseKey = (c: { curso: string; letra: string | null }) => `${c.curso}|${c.letra ?? ''}`;

export function TripForm({ clases, profes, inicial }: TripFormProps) {
  const router = useRouter();
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? '');
  const [fecha, setFecha] = useState(inicial?.fecha ?? '');
  const [importe, setImporte] = useState(inicial?.importe ?? '');
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set((inicial?.clases ?? []).map(claseKey)));
  const [responsables, setResponsables] = useState<Set<string>>(new Set(inicial?.responsables ?? []));
  const [guardando, setGuardando] = useState(false);

  function toggle<T>(set: Set<T>, valor: T, setter: (s: Set<T>) => void) {
    const s = new Set(set);
    if (s.has(valor)) s.delete(valor);
    else s.add(valor);
    setter(s);
  }

  async function guardar() {
    if (nombre.trim().length < 3) return void toast.error('Ponle un nombre a la salida');
    if (seleccion.size === 0) return void toast.error('Selecciona al menos una clase');
    setGuardando(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        fecha: fecha || null,
        importe: importe.trim() ? importe.trim().replace(',', '.') : null,
        clases: clases.filter((c) => seleccion.has(claseKey(c))).map(({ curso, letra }) => ({ curso, letra })),
        responsables: [...responsables],
      };
      const res = await fetch(inicial ? `/api/salidas/admin/trips/${inicial.id}` : '/api/salidas/admin/trips', {
        method: inicial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar');
      haptic.success();
      toast.success(inicial ? 'Salida actualizada' : 'Salida creada');
      router.push(inicial ? `/gestion/salidas/${inicial.id}` : `/gestion/salidas/${data.trip.id}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
      haptic.warning();
    } finally {
      setGuardando(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100';

  return (
    <div className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Nombre *</label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Excursión al Oceanogràfic" className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Descripción (la ven las familias)</label>
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} placeholder="Salida de todo el día. Llevar almuerzo y gorra." className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Importe (€)</label>
          <input inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="12,50" className={inputCls} />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Clases a las que va dirigida *</label>
        <div className="flex flex-wrap gap-1.5">
          {clases.map((c) => {
            const k = claseKey(c);
            const activa = seleccion.has(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggle(seleccion, k, setSeleccion)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  activa
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Responsables (reciben aviso por email con cada justificante)
        </label>
        <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
          {profes.map((p) => {
            const activo = responsables.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(responsables, p.id, setResponsables)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  activo
                    ? 'bg-emerald-600 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                {p.nombre}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => void guardar()}
        disabled={guardando}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {guardando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
        {inicial ? 'Guardar cambios' : 'Crear salida'}
      </button>
    </div>
  );
}
