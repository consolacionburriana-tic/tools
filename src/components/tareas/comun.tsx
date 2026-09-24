'use client';

// Piezas compartidas entre el panel flotante y el tablero de /gestion/tareas.
import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { copiarTexto } from '@/components/alumnado/copiable';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import {
  ESTADOS_TAREA,
  ESTADO_LABELS,
  type ActualizarTarea,
  type CrearTarea,
  type EstadoTarea,
  type Tarea,
} from '@/lib/tareas';

// ─── Llamadas a la API ───────────────────────────────────────────────────────
async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? 'Algo ha fallado');
  return json as T;
}

export const apiTareas = {
  listar: () => pedir<{ tareas: Tarea[] }>('/api/tareas').then((r) => r.tareas),
  crear: (datos: CrearTarea) =>
    pedir<{ tarea: Tarea }>('/api/tareas', { method: 'POST', body: JSON.stringify(datos) }).then((r) => r.tarea),
  actualizar: (id: string, cambios: ActualizarTarea) =>
    pedir<{ tarea: Tarea }>(`/api/tareas/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) }).then(
      (r) => r.tarea,
    ),
  borrar: (id: string) => pedir<{ ok: true }>(`/api/tareas/${id}`, { method: 'DELETE' }),
};

// ─── Estado ──────────────────────────────────────────────────────────────────
export const COLOR_ESTADO: Record<EstadoTarea, string> = {
  pendiente: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  en_curso: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  hecho: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  descartado: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

export function EstadoBadge({ estado }: { estado: EstadoTarea }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', COLOR_ESTADO[estado])}>
      {ESTADO_LABELS[estado]}
    </span>
  );
}

/** Un `<select>` nativo con pinta de chip: en iPad abre la rueda del sistema, que es lo cómodo. */
export function EstadoSelect({
  estado,
  onChange,
  className,
}: {
  estado: EstadoTarea;
  onChange: (e: EstadoTarea) => void;
  className?: string;
}) {
  return (
    <select
      value={estado}
      onChange={(e) => onChange(e.target.value as EstadoTarea)}
      aria-label="Estado"
      className={cn(
        'field-sizing-content cursor-pointer appearance-none rounded-full border-0 px-2.5 py-1 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
        COLOR_ESTADO[estado],
        className,
      )}
    >
      {ESTADOS_TAREA.map((e) => (
        <option key={e} value={e}>
          {ESTADO_LABELS[e]}
        </option>
      ))}
    </select>
  );
}

// ─── Copiar ──────────────────────────────────────────────────────────────────
export function BotonCopiar({
  texto,
  etiqueta,
  className,
  compacto = false,
}: {
  /** Se calcula al pulsar, no al pintar: el texto del módulo puede ser largo. */
  texto: () => string;
  etiqueta?: string;
  className?: string;
  compacto?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (temporizador.current && clearTimeout(temporizador.current)), []);

  async function copiar() {
    const t = texto();
    if (!t) return;
    const ok = await copiarTexto(t);
    if (!ok) {
      toast.error('No se ha podido copiar');
      return;
    }
    haptic.success();
    setCopiado(true);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setCopiado(false), 1400);
  }

  return (
    <button
      type="button"
      onClick={copiar}
      title={etiqueta ?? 'Copiar para pegárselo a Claude'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg text-xs font-medium transition-colors',
        compacto
          ? 'h-8 w-8 justify-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
          : 'border border-zinc-200 px-2.5 py-1.5 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800',
        copiado && 'text-emerald-600 dark:text-emerald-400',
        className,
      )}
    >
      {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {!compacto && <span>{copiado ? 'Copiado' : (etiqueta ?? 'Copiar')}</span>}
    </button>
  );
}

export const ESTILO_CAMPO =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';
