'use client';

// Vocabulario visual del módulo Puntualidad. El acento es naranja (cada módulo tiene el
// suyo: teal el ABC, azul Salidas, violeta Evaluaciones) y los objetivos táctiles son
// grandes porque esto se usa de pie, con un iPad en la mano, a las ocho y cinco.
import { motion } from 'motion/react';
import { haptic } from '@/lib/haptics';

export function Seccion({
  titulo,
  aviso,
  children,
}: {
  titulo: string;
  aviso?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{titulo}</h2>
        {aviso && <span className="text-xs text-orange-600 dark:text-orange-400">{aviso}</span>}
      </div>
      {children}
    </section>
  );
}

export function Chip({
  activo,
  onClick,
  children,
  tamano = 'normal',
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tamano?: 'normal' | 'pequeno';
}) {
  return (
    <motion.button
      type="button"
      aria-pressed={activo}
      whileTap={{ scale: 0.96 }}
      onClick={() => {
        haptic.tap();
        onClick();
      }}
      className={[
        'rounded-xl border font-medium transition-colors select-none',
        tamano === 'normal' ? 'min-h-[44px] px-3.5 py-2 text-sm' : 'px-3 py-1.5 text-xs',
        activo
          ? 'border-orange-500 bg-orange-500 text-white shadow-sm dark:border-orange-400 dark:bg-orange-500'
          : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-200 dark:hover:border-zinc-600',
      ].join(' ')}
    >
      {children}
    </motion.button>
  );
}

/** Etiqueta de clase ("2ESO B"): siempre igual en todo el módulo. */
export function ClaseChip({ clase }: { clase: string }) {
  return (
    <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
      {clase}
    </span>
  );
}

const TONOS = {
  primero: 'bg-zinc-50 text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400',
  lejano: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  atencion: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  alerta: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200',
} as const;

export function HistorialPill({ tono, children }: { tono: keyof typeof TONOS; children: React.ReactNode }) {
  return <p className={`rounded-lg px-2.5 py-1.5 text-xs leading-snug ${TONOS[tono]}`}>{children}</p>;
}

export function Interruptor({
  activo,
  onChange,
  etiqueta,
  descripcion,
}: {
  activo: boolean;
  onChange: (v: boolean) => void;
  etiqueta: string;
  descripcion?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={() => {
        haptic.tap();
        onChange(!activo);
      }}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-left transition-colors hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800/50"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">{etiqueta}</span>
        {descripcion && <span className="block text-xs text-zinc-400">{descripcion}</span>}
      </span>
      <span
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
          activo ? 'bg-orange-500' : 'bg-zinc-200 dark:bg-zinc-700'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            activo ? 'left-[1.125rem]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}
