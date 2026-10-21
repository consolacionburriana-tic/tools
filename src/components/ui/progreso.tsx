import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Cuánto lleva algo: barra azul que pasa a verde al llegar al 100 %. Con `cuenta`, pinta
 * «7/12» al lado. `etiqueta` es el nombre para el lector de pantalla.
 */
export function Progreso({
  hechos,
  total,
  etiqueta,
  cuenta = false,
  className,
}: {
  hechos: number;
  total: number;
  etiqueta: string;
  cuenta?: boolean;
  className?: string;
}) {
  const pct = total > 0 ? Math.round((Math.min(hechos, total) / total) * 100) : 0;
  const lleno = total > 0 && hechos >= total;
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        role="progressbar"
        aria-label={etiqueta}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={Math.min(hechos, total)}
        className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
      >
        <div
          className={cn('h-full rounded-full transition-all duration-300', lleno ? 'bg-emerald-500' : 'bg-blue-600 dark:bg-blue-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
      {cuenta && (
        <span className="shrink-0 font-mono text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
          {hechos}/{total}
        </span>
      )}
    </div>
  );
}

/**
 * Una tarea larga del servidor en marcha (crear 40 correos, borrar 12 clases): ruedecita,
 * qué está haciendo y, si se sabe el total, la barra. Se anuncia sola (`role="status"`).
 */
export function EnCurso({
  texto,
  hechos,
  total,
  className,
}: {
  texto: React.ReactNode;
  hechos?: number;
  total?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        'space-y-2 rounded-xl bg-blue-50 px-3.5 py-2.5 text-sm text-blue-900 dark:bg-blue-500/10 dark:text-blue-100',
        className,
      )}
    >
      <p className="flex items-center gap-2">
        <Loader2 aria-hidden className="h-4 w-4 shrink-0 animate-spin" />
        <span className="min-w-0 flex-1">{texto}</span>
        {total ? (
          <span className="shrink-0 font-mono text-xs tabular-nums">
            {hechos ?? 0}/{total}
          </span>
        ) : null}
      </p>
      {total ? <Progreso hechos={hechos ?? 0} total={total} etiqueta="Progreso" /> : null}
    </div>
  );
}
