'use client';

// Selector de color de la actividad, en dos presentaciones que comparten la misma
// tira de 20 círculos: `ActividadColorButton` (insignia con letra, para los bloques
// del editor) y `ColorDotButton` (un punto suelto, para el listado de actividades).
// Sin explicación de más — "Color de la actividad" y los círculos ya dicen lo que hacen.
import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { COLORES_ACTIVIDAD } from '@/lib/evaluaciones';

const AZUL_POR_DEFECTO = '#2563eb';

function TiraDeColores({ color, onChange }: { color: string | null; onChange: (color: string) => void }) {
  return (
    <>
      <p className="mb-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Color de la actividad</p>
      <div className="flex flex-wrap gap-1.5">
        {COLORES_ACTIVIDAD.map((c) => {
          const activo = (color ?? AZUL_POR_DEFECTO).toLowerCase() === c.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => onChange(c)}
              style={{ background: c }}
              className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${
                activo ? 'ring-2 ring-offset-2 ring-zinc-900 dark:ring-white dark:ring-offset-zinc-900' : ''
              }`}
            />
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
}: {
  abierto: boolean;
  setAbierto: (v: boolean) => void;
  color: string | null;
  onChange: (color: string) => void;
}) {
  const quieto = useReducedMotion();
  if (!abierto) return null;
  return (
    <>
      <motion.div
        initial={quieto ? false : { opacity: 0, y: -4, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.14 }}
        className="absolute left-0 top-full z-40 mt-1.5 w-56 rounded-xl border border-zinc-200 bg-white p-2.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      >
        <TiraDeColores
          color={color}
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
      style={{ background: color ?? AZUL_POR_DEFECTO }}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm ${className}`}
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
}: {
  letra: string;
  color: string | null;
  onChange: (color: string) => void;
  disabled?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        title={disabled ? undefined : 'Color de la actividad'}
        onClick={() => setAbierto((v) => !v)}
        className="mt-0.5 rounded-lg transition-transform enabled:hover:scale-110 enabled:active:scale-95 disabled:opacity-60"
      >
        <LetraBadge letra={letra} color={color} />
      </button>
      {!disabled && <Desplegable abierto={abierto} setAbierto={setAbierto} color={color} onChange={onChange} />}
    </div>
  );
}

/** Punto de color suelto (sin letra): para listados planos como el de actividades. */
export function ColorDotButton({ color, onChange }: { color: string | null; onChange: (color: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        title="Color de la actividad"
        onClick={() => setAbierto((v) => !v)}
        style={{ background: color ?? AZUL_POR_DEFECTO }}
        className="h-5 w-5 shrink-0 rounded-full ring-1 ring-black/5 transition-transform hover:scale-110 active:scale-95 dark:ring-white/10"
      />
      <Desplegable abierto={abierto} setAbierto={setAbierto} color={color} onChange={onChange} />
    </div>
  );
}
