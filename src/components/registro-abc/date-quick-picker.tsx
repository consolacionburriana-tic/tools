'use client';

import { useState } from 'react';
import { differenceInCalendarDays, format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type QuickOption = 'hoy' | 'ayer' | 'anteayer' | 'otra';

interface DateQuickPickerProps {
  value: Date;
  onChange: (date: Date) => void;
}

export function DateQuickPicker({ value, onChange }: DateQuickPickerProps) {
  const today = new Date();
  const [calendarOpen, setCalendarOpen] = useState(false);
  // Se deduce de la fecha elegida (no de lo último pulsado): un borrador restaurado que trae
  // «ayer» enseña «Ayer» marcado, y una fecha del calendario que cae en hoy se queda en «Hoy».
  const diasAtras = differenceInCalendarDays(today, value);
  const selected: QuickOption = diasAtras === 0 ? 'hoy' : diasAtras === 1 ? 'ayer' : diasAtras === 2 ? 'anteayer' : 'otra';

  const quickOptions: { key: QuickOption; label: string; date: Date }[] = [
    { key: 'hoy', label: 'Hoy', date: today },
    { key: 'ayer', label: 'Ayer', date: subDays(today, 1) },
    { key: 'anteayer', label: 'Anteayer', date: subDays(today, 2) },
  ];

  const handleQuick = (opt: (typeof quickOptions)[number]) => {
    onChange(opt.date);
  };

  return (
    <div className="space-y-3">
      <Filtros etiqueta="Fecha">
        {quickOptions.map((opt) => (
          <Filtro key={opt.key} activo={selected === opt.key} onClick={() => handleQuick(opt)} acento="verde" className="h-12 px-5">
            {opt.label}
          </Filtro>
        ))}

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger
            onClick={() => haptic.tap()}
            aria-pressed={selected === 'otra'}
            className={cn(
              'inline-flex h-12 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4',
              selected === 'otra'
                ? 'border-emerald-700 bg-emerald-700 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-emerald-950'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800',
            )}
          >
            <CalendarIcon aria-hidden />
            Otra fecha
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 rounded-xl" align="start">
            <Calendar
              mode="single"
              selected={value}
              onSelect={(date) => {
                if (date) {
                  haptic.tap();
                  onChange(date);
                  setCalendarOpen(false);
                }
              }}
              disabled={(date) => date > today}
              locale={es}
            />
          </PopoverContent>
        </Popover>
      </Filtros>

      <AnimatePresence mode="wait">
        <motion.p
          key={value.toISOString()}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-zinc-500 first-letter:uppercase dark:text-zinc-400"
        >
          {format(value, "EEEE, d 'de' MMMM", { locale: es })}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
