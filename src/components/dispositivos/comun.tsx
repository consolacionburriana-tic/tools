'use client';

// Piezas compartidas de Dispositivos 1:1: llamadas a la API, estilos y los chips de estado.
import { cn } from '@/lib/utils';
import { MODALIDAD_LABEL, type EstadoSeguro, type Modalidad } from '@/lib/dispositivos';

// ─── API ─────────────────────────────────────────────────────────────────────
export async function pedir<T>(url: string, metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET', cuerpo?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: metodo,
    headers: cuerpo !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? 'Algo ha fallado');
  return json as T;
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
export const ESTILO_CAMPO =
  'h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-[15px] text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';

export const ESTILO_BOTON =
  'inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:cursor-default disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800';

export const ESTILO_BOTON_PRINCIPAL =
  'inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-default disabled:opacity-60';

/** Color de cada modalidad: el mismo en la tabla, en los chips y en la ficha. */
export const COLOR_MODALIDAD: Record<Modalidad, string> = {
  comprado: 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900',
  casa: 'border-violet-600 bg-violet-600 text-white dark:border-violet-400 dark:bg-violet-500',
  prestado: 'border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-500',
  hermano: 'border-teal-600 bg-teal-600 text-white dark:border-teal-400 dark:bg-teal-500',
};

export const COLOR_SEGURO: Record<EstadoSeguro, string> = {
  vigente: 'text-emerald-700 dark:text-emerald-400',
  ultimo: 'bg-sky-50 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  vencido: 'bg-amber-100 font-semibold text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  sin_dato: 'bg-amber-50 font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
};

export function ChipModalidad({ modalidad, className }: { modalidad: Modalidad | null; className?: string }) {
  if (!modalidad) {
    return (
      <span className={cn('rounded-md border border-dashed border-amber-500 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300', className)}>
        Sin informar
      </span>
    );
  }
  return <span className={cn('rounded-md border px-2 py-0.5 text-xs font-semibold', COLOR_MODALIDAD[modalidad], className)}>{MODALIDAD_LABEL[modalidad]}</span>;
}

/** «14/10/2026 · Ana». */
export function cuandoYQuien(at: string, quien: string | null): string {
  const d = new Date(at);
  const fecha = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `${fecha} ${hora}${quien ? ` · ${quien}` : ''}`;
}

/** Busca sin acentos ni mayúsculas. */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
