import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Cuánto lleva algo, de un vistazo: un aro que se llena con un color con significado (el de
 * la actividad, el del colectivo) y la cifra en medio. Al llegar al 100 % vira a verde con un
 * ✓. Sin total conocido (`total` 0 o nulo) el aro queda vacío y en medio va la cuenta tal cual.
 * Es un indicador, no un adorno: úsalo donde la pregunta sea «¿cuánto falta?».
 */
export function Anillo({
  hechos,
  total,
  color = 'var(--color-blue-600)',
  tamano = 'md',
  etiqueta,
  className,
}: {
  hechos: number;
  total: number | null;
  /** Un color CSS (`var(--eval-alumnos)`, `#0e9f6e`…). */
  color?: string;
  tamano?: 'sm' | 'md';
  /** Para el lector de pantalla («38 de 52 respuestas»). */
  etiqueta: string;
  className?: string;
}) {
  const con = total != null && total > 0;
  const pct = con ? Math.min(100, Math.round((hechos / total) * 100)) : 0;
  const lleno = con && hechos >= total;
  const lado = tamano === 'sm' ? 40 : 52;
  const grosor = tamano === 'sm' ? 4 : 5;
  const radio = (lado - grosor) / 2;
  const perimetro = 2 * Math.PI * radio;
  return (
    <span
      role="img"
      aria-label={etiqueta}
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: lado, height: lado }}
    >
      <svg width={lado} height={lado} viewBox={`0 0 ${lado} ${lado}`} className="absolute -rotate-90" aria-hidden>
        <circle cx={lado / 2} cy={lado / 2} r={radio} fill="none" strokeWidth={grosor} className="stroke-zinc-200 dark:stroke-zinc-700" />
        {con && pct > 0 && (
          <circle
            cx={lado / 2}
            cy={lado / 2}
            r={radio}
            fill="none"
            strokeWidth={grosor}
            strokeLinecap="round"
            strokeDasharray={perimetro}
            strokeDashoffset={perimetro * (1 - pct / 100)}
            className={cn('transition-[stroke-dashoffset] duration-500', lleno && 'stroke-emerald-500')}
            style={lleno ? undefined : { stroke: color }}
          />
        )}
      </svg>
      <span aria-hidden className={cn('font-semibold text-zinc-900 tabular-nums dark:text-zinc-100', tamano === 'sm' ? 'text-xs' : 'text-sm')}>
        {lleno ? <Check className="size-5 text-emerald-600 dark:text-emerald-400" strokeWidth={3} /> : con ? `${pct}%` : hechos}
      </span>
    </span>
  );
}
