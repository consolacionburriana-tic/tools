'use client';

// Selector de color de la actividad, en dos presentaciones que comparten la misma
// tira de 20 círculos: `ActividadColorButton` (insignia con letra, para los bloques
// del editor) y `ColorDotButton` (un punto suelto, para el listado de actividades).
// Sin explicación de más — "Color de la actividad" y los círculos ya dicen lo que hacen.
import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COLORES_ACTIVIDAD } from '@/lib/evaluaciones';
import { tintaSobre } from '@/components/evaluaciones/ui';

const AZUL_POR_DEFECTO = '#2563eb';

function TiraDeColores({
  color,
  onChange,
  etiqueta,
}: {
  color: string | null;
  onChange: (color: string) => void;
  etiqueta: string;
}) {
  return (
    <>
      <p className="mb-1.5 px-0.5 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">{etiqueta}</p>
      <div className="grid grid-cols-5 gap-1">
        {COLORES_ACTIVIDAD.map((c) => {
          const activo = (color ?? AZUL_POR_DEFECTO).toLowerCase() === c.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              aria-pressed={activo}
              onClick={() => onChange(c)}
              className="flex size-10 items-center justify-center rounded-xl outline-none hover:bg-zinc-100 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-zinc-800"
            >
              <span
                style={{ background: c, color: tintaSobre(c) }}
                className={cn(
                  'flex size-7 items-center justify-center rounded-full',
                  activo && 'ring-2 ring-zinc-900 ring-offset-2 dark:ring-white dark:ring-offset-zinc-900',
                )}
              >
                {activo && <Check aria-hidden className="size-4" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Desplegable común a los dos triggers: se cierra tocando fuera o al elegir color. */
function Desplegable({
  abierto,
  setAbierto,
  color,
  onChange,
  etiqueta,
}: {
  abierto: boolean;
  setAbierto: (v: boolean) => void;
  color: string | null;
  onChange: (color: string) => void;
  etiqueta: string;
}) {
  const quieto = useReducedMotion();
  if (!abierto) return null;
  return (
    <>
      <motion.div
        initial={quieto ? false : { opacity: 0, y: -4, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.14 }}
        className="absolute top-full left-0 z-40 mt-1.5 w-60 rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      >
        <TiraDeColores
          color={color}
          etiqueta={etiqueta}
          onChange={(c) => {
            onChange(c);
            setAbierto(false);
          }}
        />
      </motion.div>
      {/* Capa para cerrar al tocar fuera, sin meter listeners globales de document. */}
      <button type="button" aria-hidden onClick={() => setAbierto(false)} className="fixed inset-0 z-30 cursor-default" />
    </>
  );
}

/** Insignia de letra sola, de solo lectura (dashboards, listados). */
export function LetraBadge({ letra, color, className = '' }: { letra: string; color: string | null; className?: string }) {
  return (
    <span
      style={{ background: color ?? AZUL_POR_DEFECTO, color: tintaSobre(color ?? AZUL_POR_DEFECTO) }}
      className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold', className)}
    >
      {letra}
    </span>
  );
}

/**
 * Insignia con letra que además es el botón para cambiar el color de la actividad.
 * Si `disabled` (bloque sin actividad detrás), se queda como insignia muda.
 */
export function ActividadColorButton({
  letra,
  color,
  onChange,
  disabled,
  etiqueta = 'Color de la actividad',
}: {
  letra: string;
  color: string | null;
  onChange: (color: string) => void;
  disabled?: boolean;
  etiqueta?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-label={disabled ? `Actividad ${letra}` : `${etiqueta} (actividad ${letra})`}
        aria-expanded={disabled ? undefined : abierto}
        onClick={() => setAbierto((v) => !v)}
        className="flex size-10 items-center justify-center rounded-xl outline-none transition-transform focus-visible:ring-3 focus-visible:ring-ring/50 enabled:active:scale-95 disabled:cursor-default"
      >
        <LetraBadge letra={letra} color={color} />
      </button>
      {!disabled && <Desplegable abierto={abierto} setAbierto={setAbierto} color={color} onChange={onChange} etiqueta={etiqueta} />}
    </div>
  );
}

/** Punto de color suelto (sin letra): para listados planos como el de actividades, o
 *  para el color dominante de un formulario entero (ver `etiqueta`). */
export function ColorDotButton({
  color,
  onChange,
  etiqueta = 'Color de la actividad',
}: {
  color: string | null;
  onChange: (color: string) => void;
  etiqueta?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        aria-label={etiqueta}
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className="flex size-10 shrink-0 items-center justify-center rounded-xl outline-none hover:bg-zinc-100 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95 dark:hover:bg-zinc-800"
      >
        <span
          aria-hidden
          style={{ background: color ?? AZUL_POR_DEFECTO }}
          className="size-5 rounded-full ring-1 ring-black/5 dark:ring-white/10"
        />
      </button>
      <Desplegable abierto={abierto} setAbierto={setAbierto} color={color} onChange={onChange} etiqueta={etiqueta} />
    </div>
  );
}
