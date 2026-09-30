'use client';

import { ChevronDown } from 'lucide-react';

interface FormSectionProps {
  title: string;
  required?: boolean;
  multiselect?: boolean;
  error?: string;
  children: React.ReactNode;
}

export function FormSection({ title, required, multiselect, error, children }: FormSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{title}</h3>
        {required && <span className="text-teal-600 dark:text-teal-400 text-xs font-medium">*</span>}
        {multiselect && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-700 select-none">
            selección múltiple
          </span>
        )}
      </div>
      {children}
      {error && (
        <p className="text-xs text-rose-500/90 dark:text-rose-400/90 mt-1">{error}</p>
      )}
    </div>
  );
}

interface OptionalBlockProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

/** Bloque opcional plegado por defecto: se ve claramente que no hace falta rellenarlo. */
export function OptionalBlock({ title, open, onToggle, children }: OptionalBlockProps) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-900/40">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 shrink-0">
          Opcional
        </span>
        <span className="flex-1 text-sm font-medium text-zinc-600 dark:text-zinc-300">{title}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-zinc-400 dark:text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="px-4 pb-5 pt-1 space-y-8">{children}</div>}
    </div>
  );
}
