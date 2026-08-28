'use client';

// Anillo de progreso que acompaña al formulario por el lateral. Minimalista a
// propósito: un aro, un número y nada más. Aparece cuando ya se ha contestado algo
// (si sale con un 0 % desde el principio, desanima en vez de ayudar).
//
// Solo en pantallas anchas: en móvil el sitio del lateral no existe y el progreso
// vive en la barra inferior, que ahí siempre está a la vista.
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';

interface Props {
  hechos: number;
  total: number;
  /** Color del formulario mientras se rellena; al completar, siempre vira a verde. */
  color: string;
}

const RADIO = 26;
const PERIMETRO = 2 * Math.PI * RADIO;

export function ProgresoAnillo({ hechos, total, color }: Props) {
  const quieto = useReducedMotion();
  const pct = total > 0 ? Math.min(100, Math.round((hechos / total) * 100)) : 0;
  const completo = hechos >= total && total > 0;

  return (
    <AnimatePresence>
      {hechos > 0 && (
        <motion.div
          initial={quieto ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="pointer-events-none fixed right-5 top-1/2 z-30 hidden -translate-y-1/2 md:block"
          aria-hidden
        >
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/85 shadow-lg ring-1 ring-zinc-200/70 backdrop-blur dark:bg-zinc-900/85 dark:ring-zinc-700/70">
            <svg width="64" height="64" viewBox="0 0 64 64" className="absolute -rotate-90">
              <circle cx="32" cy="32" r={RADIO} fill="none" strokeWidth="4" className="stroke-zinc-200 dark:stroke-zinc-700" />
              <motion.circle
                cx="32"
                cy="32"
                r={RADIO}
                fill="none"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={PERIMETRO}
                className={completo ? 'stroke-emerald-500' : ''}
                style={completo ? undefined : { stroke: color }}
                initial={false}
                animate={{ strokeDashoffset: PERIMETRO * (1 - pct / 100) }}
                transition={quieto ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 22 }}
              />
            </svg>
            <AnimatePresence mode="wait" initial={false}>
              {completo ? (
                <motion.span
                  key="ok"
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  className="text-emerald-600 dark:text-emerald-400"
                >
                  <Check className="h-6 w-6" strokeWidth={3} />
                </motion.span>
              ) : (
                <motion.span
                  key={pct}
                  initial={quieto ? false : { y: 7, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -7, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="text-sm font-bold tabular-nums text-zinc-700 dark:text-zinc-200"
                >
                  {pct}
                  <span className="text-[9px] font-semibold text-zinc-400">%</span>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
