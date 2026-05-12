'use client';

import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { haptic } from '@/lib/haptics';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type QuickOption = 'hoy' | 'ayer' | 'anteayer' | 'otra';

interface DateQuickPickerProps {
  value: Date;
  onChange: (date: Date) => void;
}

export function DateQuickPicker({ value, onChange }: DateQuickPickerProps) {
  const today = new Date();
  const [selected, setSelected] = useState<QuickOption>('hoy');
  const [calendarOpen, setCalendarOpen] = useState(false);

  const quickOptions: { key: QuickOption; label: string; date: Date }[] = [
    { key: 'hoy', label: 'Hoy', date: today },
    { key: 'ayer', label: 'Ayer', date: subDays(today, 1) },
    { key: 'anteayer', label: 'Anteayer', date: subDays(today, 2) },
  ];

  const handleQuick = (opt: (typeof quickOptions)[number]) => {
    haptic.tap();
    setSelected(opt.key);
    onChange(opt.date);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {quickOptions.map((opt) => (
          <motion.button
            key={opt.key}
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => handleQuick(opt)}
            className={[
              'min-h-[48px] px-4 py-2 rounded-xl border text-sm font-medium transition-colors duration-150 cursor-pointer',
              selected === opt.key
                ? 'bg-teal-50 border-teal-400 text-teal-800 shadow-sm dark:bg-teal-900/40 dark:border-teal-500 dark:text-teal-200'
                : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-700 dark:text-zinc-300',
            ].join(' ')}
          >
            {opt.label}
          </motion.button>
        ))}

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger
            onClick={() => haptic.tap()}
            className={[
              'min-h-[48px] px-4 py-2 rounded-xl border text-sm font-medium inline-flex items-center gap-2 transition-colors cursor-pointer focus-visible:outline-none',
              selected === 'otra'
                ? 'bg-teal-50 border-teal-400 text-teal-800 dark:bg-teal-900/40 dark:border-teal-500 dark:text-teal-200'
                : 'bg-white border-zinc-200 text-zinc-700 dark:bg-zinc-800/50 dark:border-zinc-700 dark:text-zinc-300',
            ].join(' ')}
          >
            <CalendarIcon className="w-4 h-4" />
            Otra fecha
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 rounded-xl" align="start">
            <Calendar
              mode="single"
              selected={value}
              onSelect={(date) => {
                if (date) {
                  haptic.tap();
                  setSelected('otra');
                  onChange(date);
                  setCalendarOpen(false);
                }
              }}
              disabled={(date) => date > today}
              locale={es}
            />
          </PopoverContent>
        </Popover>
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={value.toISOString()}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-zinc-400 dark:text-zinc-500 italic"
        >
          {format(value, "EEEE, d 'de' MMMM", { locale: es })}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
