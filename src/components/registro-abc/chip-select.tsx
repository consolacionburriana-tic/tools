'use client';

import { motion } from 'motion/react';
import { haptic } from '@/lib/haptics';

interface Option {
  value: string;
  label: string;
}

interface ChipSelectProps {
  options: Option[];
  value: string | null;
  onChange: (value: string) => void;
  emphasized?: boolean;
}

export function ChipSelect({ options, value, onChange, emphasized = false }: ChipSelectProps) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <motion.button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              haptic.tap();
              onChange(opt.value);
            }}
            className={[
              'min-h-[48px] px-4 py-2 rounded-xl border text-sm font-medium transition-colors duration-150 cursor-pointer select-none',
              selected
                ? emphasized
                  ? 'bg-teal-600 border-teal-500 text-white shadow-sm dark:bg-teal-500 dark:border-teal-400'
                  : 'bg-teal-50 border-teal-400 text-teal-800 shadow-sm dark:bg-teal-900/40 dark:border-teal-500 dark:text-teal-200'
                : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600',
            ].join(' ')}
          >
            {opt.label}
          </motion.button>
        );
      })}
    </div>
  );
}
