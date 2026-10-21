import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

// Un recuadro que avisa de algo en la página (no un toast, que se va solo): informativo en
// azul, «ojo» en ámbar, error en rojo y «hecho» en verde. Lleva su icono por defecto.

const TONOS = {
  info: {
    caja: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100',
    icono: 'text-blue-600 dark:text-blue-400',
    Icono: Info,
  },
  aviso: {
    caja: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
    icono: 'text-amber-600 dark:text-amber-400',
    Icono: TriangleAlert,
  },
  error: {
    caja: 'border-red-200 bg-red-50 text-red-950 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100',
    icono: 'text-red-600 dark:text-red-400',
    Icono: CircleAlert,
  },
  ok: {
    caja: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100',
    icono: 'text-emerald-600 dark:text-emerald-400',
    Icono: CircleCheck,
  },
} as const;

export type TonoAviso = keyof typeof TONOS;

export function Aviso({
  tono = 'info',
  titulo,
  icono,
  accion,
  className,
  children,
}: {
  tono?: TonoAviso;
  titulo?: React.ReactNode;
  /** Otro icono de lucide, o `false` para ninguno. */
  icono?: React.ReactNode | false;
  accion?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  const t = TONOS[tono];
  return (
    <div
      role={tono === 'error' ? 'alert' : undefined}
      className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed', t.caja, className)}
    >
      {icono !== false && (
        <span aria-hidden className={cn('mt-0.5 shrink-0 [&_svg]:size-4', t.icono)}>
          {icono ?? <t.Icono />}
        </span>
      )}
      <div className="min-w-0 flex-1">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children}
      </div>
      {accion && <div className="flex shrink-0 items-center gap-2 self-center">{accion}</div>}
    </div>
  );
}
