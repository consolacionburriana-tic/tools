'use client';

// Piezas compartidas entre el panel flotante y el tablero de /gestion/tareas.
import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { copiarTexto } from '@/components/ui/copiable';
import { Estado, TONO_ESTADO, type TonoEstado } from '@/components/ui/estado';
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
// Los estados de una tarea son estados de verdad (falta, en marcha, hecho, no aplica): van
// con los tonos de `Estado`.
const TONO_TAREA: Record<EstadoTarea, TonoEstado> = {
  pendiente: 'aviso',
  en_curso: 'info',
  hecho: 'ok',
  descartado: 'neutro',
};

export function EstadoBadge({ estado }: { estado: EstadoTarea }) {
  return (
    <Estado tono={TONO_TAREA[estado]} className="whitespace-nowrap">
      {ESTADO_LABELS[estado]}
    </Estado>
  );
}

/** Un `<select>` nativo con pinta de pastilla: en iPad abre la rueda del sistema, que es lo cómodo. */
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
        'field-sizing-content h-10 cursor-pointer appearance-none rounded-full border-0 px-3 text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        TONO_ESTADO[TONO_TAREA[estado]],
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
    <Button
      type="button"
      variant={compacto ? 'ghost' : 'outline'}
      size={compacto ? 'icon-sm' : 'sm'}
      onClick={copiar}
      aria-label={compacto ? (etiqueta ?? 'Copiar para pegárselo a Claude') : undefined}
      className={className}
    >
      {copiado ? <Check aria-hidden /> : <Copy aria-hidden />}
      {!compacto && <span>{copiado ? 'Copiado' : (etiqueta ?? 'Copiar')}</span>}
    </Button>
  );
}
