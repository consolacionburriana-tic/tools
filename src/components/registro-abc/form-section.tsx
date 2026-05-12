'use client';

interface FormSectionProps {
  title: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}

export function FormSection({ title, required, error, children }: FormSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{title}</h3>
        {required && <span className="text-teal-600 dark:text-teal-400 text-xs font-medium">*</span>}
      </div>
      {children}
      {error && (
        <p className="text-xs text-rose-500/90 dark:text-rose-400/90 mt-1">{error}</p>
      )}
    </div>
  );
}

interface OptionalDividerProps {
  label?: string;
}

export function OptionalDivider({ label = 'Información adicional (opcional)' }: OptionalDividerProps) {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
      <span className="text-xs text-zinc-400 dark:text-zinc-500 italic shrink-0">{label}</span>
      <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
    </div>
  );
}
