'use client';

// Piezas compartidas de Inventario y aulas (docs/33-inventario.md): llamar a las acciones con su
// toast, las estrellas de valoración, el índice de todo por aula y el cartel de cada aula.
import { useMemo, useState, useTransition } from 'react';
import { Minus, Plus, Star } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { indexar, etiquetaAula, type FilaAula } from '@/lib/inventario-indice';
import type { Inventario } from '@/lib/inventario-server';
import type { Resultado } from '@/app/gestion/inventario/acciones';

// ─── Acciones ────────────────────────────────────────────────────────────────

/**
 * Lanza una Server Action con su toast. `ocupado` dice si hay una en marcha (para el `cargando`
 * de los botones); devuelve si fue bien, para cerrar la hoja o no.
 */
export function useAccion() {
  const [ocupado, start] = useTransition();
  const [clave, setClave] = useState<string | null>(null);
  async function correr<T>(accion: () => Promise<Resultado<T>>, ok?: string | ((dato: T | undefined) => string), id = 'x'): Promise<T | undefined | false> {
    setClave(id);
    return new Promise((resolve) => {
      start(async () => {
        const r = await accion().catch(() => ({ ok: false as const, error: 'No se ha podido guardar' }));
        setClave(null);
        if (r.ok) {
          haptic.success();
          const texto = typeof ok === 'function' ? ok(r.dato) : ok;
          if (texto) toast.success(texto);
          resolve(r.dato);
        } else {
          haptic.warning();
          toast.error(r.error);
          resolve(false);
        }
      });
    });
  }
  return { correr, ocupado, clave: ocupado ? clave : null };
}

// ─── Índice ──────────────────────────────────────────────────────────────────
// El índice por aula vive en `lib/inventario-indice.ts` (puro) para que lo usen también los
// informes de imprimir, que se pintan en el servidor.
export { indexar, etiquetaAula, type FilaAula } from '@/lib/inventario-indice';

export function useIndice(inv: Inventario) {
  return useMemo(() => indexar(inv), [inv]);
}

// ─── Piezas ──────────────────────────────────────────────────────────────────

/** La valoración de 0 a 5. Con `onChange`, se toca la estrella (tocar la misma la quita). */
export function Estrellas({
  valor,
  onChange,
  className,
}: {
  valor: number | null;
  onChange?: (v: number | null) => void;
  className?: string;
}) {
  const v = valor ?? 0;
  const color = valor === null ? 'text-zinc-300 dark:text-zinc-600' : v <= 1 ? 'text-red-500' : v <= 3 ? 'text-amber-500' : 'text-emerald-500';
  if (!onChange) {
    return (
      <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={valor === null ? 'Sin valorar' : `${valor} de 5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} aria-hidden className={cn('size-3.5', i <= v ? cn('fill-current', color) : 'text-zinc-300 dark:text-zinc-600')} />
        ))}
        {valor === 0 && <span className="ml-1 text-xs font-semibold text-red-700 dark:text-red-400">0</span>}
      </span>
    );
  }
  return (
    <span role="group" aria-label="Valoración" className={cn('inline-flex items-center', className)}>
      <button
        type="button"
        aria-pressed={valor === 0}
        onClick={() => {
          haptic.tap();
          onChange(valor === 0 ? null : 0);
        }}
        className={cn(
          'mr-1 h-10 cursor-pointer rounded-lg px-2 text-xs font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
          valor === 0 ? 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800',
        )}
      >
        0
      </button>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          aria-label={`${i} de 5`}
          aria-pressed={valor === i}
          onClick={() => {
            haptic.tap();
            onChange(valor === i ? null : i);
          }}
          className="flex size-10 cursor-pointer items-center justify-center rounded-lg outline-none hover:bg-zinc-100 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-zinc-800"
        >
          <Star className={cn('size-6', i <= v && valor !== null ? cn('fill-current', color) : 'text-zinc-300 dark:text-zinc-600')} />
        </button>
      ))}
      <span className="ml-2 text-sm text-zinc-500 tabular-nums dark:text-zinc-400">{valor === null ? 'Sin valorar' : `${valor}/5`}</span>
    </span>
  );
}

/** Un número con − y + de 44 px (sillas, mesas, cuántos kits han llegado). Vacío = sin contar. */
export function Contador({
  valor,
  onChange,
  etiqueta,
  min = 0,
  max = 999,
  vacio = true,
}: {
  valor: number | null;
  onChange: (v: number | null) => void;
  etiqueta: string;
  min?: number;
  max?: number;
  vacio?: boolean;
}) {
  const cambiar = (d: number) => {
    haptic.tap();
    onChange(Math.min(max, Math.max(min, (valor ?? 0) + d)));
  };
  return (
    <div role="group" aria-label={etiqueta} className="inline-flex items-center gap-1">
      <button
        type="button"
        aria-label={`Una menos: ${etiqueta}`}
        onClick={() => cambiar(-1)}
        className="flex size-11 cursor-pointer items-center justify-center rounded-xl border border-zinc-300 bg-white outline-none hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        <Minus className="size-4" />
      </button>
      <input
        inputMode="numeric"
        aria-label={etiqueta}
        value={valor ?? ''}
        placeholder={vacio ? '—' : '0'}
        onChange={(e) => {
          const t = e.target.value.replace(/\D/g, '');
          onChange(t === '' ? (vacio ? null : min) : Math.min(max, Number(t)));
        }}
        className="h-11 w-16 rounded-xl border border-zinc-300 bg-white text-center text-base font-semibold tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="button"
        aria-label={`Una más: ${etiqueta}`}
        onClick={() => cambiar(1)}
        className="flex size-11 cursor-pointer items-center justify-center rounded-xl border border-zinc-300 bg-white outline-none hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

/** Cabecera de columna que ordena al tocarla. */
export function ColumnaOrden<T extends string>({
  campo,
  orden,
  setOrden,
  className,
  children,
}: {
  campo: T;
  orden: T;
  setOrden: (o: T) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const activo = orden === campo;
  return (
    <th scope="col" aria-sort={activo ? 'ascending' : undefined} className={cn('px-3 py-2 text-left font-medium', className)}>
      <button
        type="button"
        onClick={() => {
          haptic.tap();
          setOrden(campo);
        }}
        className={cn(
          '-mx-2 inline-flex h-10 cursor-pointer items-center gap-1 rounded-lg px-2 outline-none hover:bg-zinc-100 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-zinc-800',
          activo ? 'font-semibold text-zinc-900 dark:text-zinc-100' : '',
        )}
      >
        {children}
        {activo && <span aria-hidden>↓</span>}
      </button>
    </th>
  );
}

/** Opciones de aula para un `Selector`, por piso. */
export function OpcionesAulas({ filas }: { filas: readonly FilaAula[] }) {
  const pisos = new Map<string, FilaAula[]>();
  for (const f of filas) pisos.set(f.aula.piso ?? 'Otras salas', [...(pisos.get(f.aula.piso ?? 'Otras salas') ?? []), f]);
  return (
    <>
      {[...pisos.entries()].map(([piso, lista]) => (
        <optgroup key={piso} label={piso}>
          {lista.map((f) => (
            <option key={f.aula.id} value={f.aula.id}>
              {etiquetaAula(f)}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

/** «14/10/2026 · ana@…». */
export function cuando(at: string | null, quien?: string | null): string {
  if (!at) return '';
  const d = new Date(at);
  const fecha = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${fecha}${quien ? ` · ${quien.split('@')[0]}` : ''}`;
}
