'use client';

// Piezas compartidas de Nouvinguts: llamadas a la API, el nodo de un paso y la «línea de
// metro» de la lista (un nodo por paso, unidos en verde cuando los dos lados están hechos).
import { AlertTriangle, Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RESPONSABLE_LABEL, type EstadoPaso, type Responsable, type ResultadoPaso } from '@/lib/nouvinguts';
import type { FichaNouvingut } from '@/lib/nouvinguts-server';

// ─── API ─────────────────────────────────────────────────────────────────────
export async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? 'Algo ha fallado');
  return json as T;
}

export function pedirFicha(url: string, metodo: 'POST' | 'PATCH', cuerpo: unknown): Promise<FichaNouvingut> {
  return pedir<{ ficha: FichaNouvingut }>(url, { method: metodo, body: JSON.stringify(cuerpo) }).then((r) => r.ficha);
}

// ─── Estados de un paso ──────────────────────────────────────────────────────
// Los colores de estado de toda la app: verde hecho, ámbar aviso, gris lo demás.
export const ETIQUETA_ESTADO: Record<EstadoPaso, string> = {
  hecho: 'hecho',
  pendiente: 'pendiente',
  aviso: 'aviso',
  no_aplica: 'no le toca',
};

export const COLOR_TEXTO: Record<EstadoPaso, string> = {
  hecho: 'text-emerald-700 dark:text-emerald-400',
  pendiente: 'text-zinc-500 dark:text-zinc-400',
  aviso: 'font-semibold text-amber-700 dark:text-amber-400',
  no_aplica: 'text-zinc-500 dark:text-zinc-400',
};

const COLOR_RESPONSABLE: Record<Responsable, string> = {
  secretaria: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  tic: 'bg-cyan-50 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-300',
};

export const BORDE_RESPONSABLE: Record<Responsable, string> = {
  secretaria: 'bg-indigo-400 dark:bg-indigo-500',
  tic: 'bg-cyan-500 dark:bg-cyan-500',
};

export function ChipResponsable({ responsable }: { responsable: Responsable }) {
  return (
    <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap', COLOR_RESPONSABLE[responsable])}>
      {RESPONSABLE_LABEL[responsable]}
    </span>
  );
}

// ─── Nodo de un paso ─────────────────────────────────────────────────────────
export function NodoPaso({ estado, grande = false }: { estado: EstadoPaso; grande?: boolean }) {
  const tam = grande ? 'h-7 w-7' : 'h-[18px] w-[18px]';
  const icono = grande ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5';
  if (estado === 'hecho') {
    return (
      <span className={cn('relative flex shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white', tam)}>
        <Check className={icono} strokeWidth={3.5} />
      </span>
    );
  }
  if (estado === 'aviso') {
    return (
      <span className={cn('relative flex shrink-0 items-center justify-center rounded-full bg-amber-600 text-white', tam)}>
        <AlertTriangle className={icono} strokeWidth={3} />
      </span>
    );
  }
  if (estado === 'pendiente') {
    return (
      <span
        className={cn(
          'relative flex shrink-0 items-center justify-center rounded-full border-2 border-zinc-400 bg-white dark:border-zinc-500 dark:bg-zinc-900',
          tam,
        )}
      >
        {grande && <Minus className="h-3 w-3 text-zinc-400" strokeWidth={3} />}
      </span>
    );
  }
  return (
    <span className={cn('relative flex shrink-0 items-center justify-center rounded-full bg-transparent', tam)}>
      <span className="h-0.5 w-2 rounded bg-zinc-300 dark:bg-zinc-600" />
    </span>
  );
}

/** Ancho de cada columna de paso en la lista; lo comparten la cabecera y las filas. */
export const ANCHO_PASO = 'w-9 lg:w-10';

/** La línea de pasos de un alumno: un nodo por paso, unidos en verde si los dos están hechos. */
export function LineaPasos({ pasos }: { pasos: ResultadoPaso[] }) {
  return (
    <div className="flex items-center" role="list" aria-label="Pasos">
      {pasos.map((p, i) => {
        const izq = i > 0 && p.estado === 'hecho' && pasos[i - 1].estado === 'hecho';
        const der = i < pasos.length - 1 && p.estado === 'hecho' && pasos[i + 1].estado === 'hecho';
        return (
          <div
            key={p.clave}
            role="listitem"
            title={`${p.titulo} · ${ETIQUETA_ESTADO[p.estado]}${p.estado !== 'no_aplica' ? ` — ${p.texto}` : ''}`}
            className={cn('relative flex h-7 shrink-0 items-center justify-center', ANCHO_PASO)}
          >
            {i > 0 && (
              <span className={cn('absolute top-1/2 left-0 h-0.5 w-1/2 -translate-y-1/2', izq ? 'bg-emerald-600' : 'bg-zinc-200 dark:bg-zinc-700')} />
            )}
            {i < pasos.length - 1 && (
              <span className={cn('absolute top-1/2 right-0 h-0.5 w-1/2 -translate-y-1/2', der ? 'bg-emerald-600' : 'bg-zinc-200 dark:bg-zinc-700')} />
            )}
            <span className="relative rounded-full ring-[3px] ring-white dark:ring-zinc-900">
              <NodoPaso estado={p.estado} />
            </span>
            <span className="sr-only">
              {p.titulo}: {ETIQUETA_ESTADO[p.estado]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function Leyenda() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-600 dark:text-zinc-400">
      <span className="flex items-center gap-2">
        <NodoPaso estado="hecho" /> Hecho (un «no» decidido también cuenta)
      </span>
      <span className="flex items-center gap-2">
        <NodoPaso estado="pendiente" /> Pendiente: todavía no se sabe
      </span>
      <span className="flex items-center gap-2">
        <NodoPaso estado="aviso" /> Aviso: hay que hacer algo
      </span>
      <span className="flex items-center gap-2">
        <NodoPaso estado="no_aplica" /> No le toca
      </span>
      <span className="flex items-center gap-2">
        <span className="h-1 w-4 rounded bg-indigo-400" /> Secretaría
        <span className="ml-2 h-1 w-4 rounded bg-cyan-500" /> TIC
      </span>
    </div>
  );
}

export function textoDias(dias: number): string {
  return dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `día ${dias}`;
}
