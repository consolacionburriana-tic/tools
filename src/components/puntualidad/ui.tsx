// Piezas propias de Puntualidad que no están en `ui/`: el encabezado numerado de cada paso
// del formulario y la frase del historial de un alumno, teñida según lo que preocupa. Lo
// demás (chips, clases, interruptores) son las piezas comunes: `Filtro`, `Etiqueta`,
// `Interruptor`. Los objetivos táctiles son grandes porque esto se usa de pie, con un iPad
// en la mano, a las ocho y cinco.
import { cn } from '@/lib/utils';
import { TONO_ESTADO, type TonoEstado } from '@/components/ui/estado';
import type { ResumenHistorial } from '@/lib/puntualidad';

export function Seccion({
  paso,
  titulo,
  aviso,
  children,
}: {
  /** Número de paso: orienta a quien entra por primera vez sin añadir ruido. */
  paso?: number;
  titulo: string;
  aviso?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {paso !== undefined && (
          <span
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-600 tabular-nums dark:bg-zinc-800 dark:text-zinc-300"
          >
            {paso}
          </span>
        )}
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{titulo}</h2>
        {aviso && <span className="text-sm text-amber-700 dark:text-amber-400">{aviso}</span>}
      </div>
      {children}
    </section>
  );
}

// El tono del historial dice cuánto preocupa: es un estado (primera vez, hace mucho, ojo,
// cierra ciclo), así que va con los colores de `Estado`.
const TONO_HISTORIAL: Record<ResumenHistorial['tono'], TonoEstado> = {
  primero: 'neutro',
  lejano: 'info',
  atencion: 'aviso',
  alerta: 'error',
};

/** La frase del historial («3º este mes, el último el lunes»): una caja con el tono del estado. */
export function Historial({
  tono,
  className,
  children,
}: {
  tono: ResumenHistorial['tono'];
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('rounded-xl px-3 py-2 text-sm leading-snug', TONO_ESTADO[TONO_HISTORIAL[tono]], className)}>
      {children}
    </div>
  );
}
