'use client';

import { useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import type { Teacher } from '@/db/schema';

export const OTHER_TEACHER_VALUE = '__otros__';

interface TeacherPickerProps {
  teachers: Teacher[];
  value: string | null;
  onChange: (id: string) => void;
  otherName: string;
  onOtherNameChange: (name: string) => void;
}

export function TeacherPicker({ teachers, value, onChange, otherName, onOtherNameChange }: TeacherPickerProps) {
  const [open, setOpen] = useState(false);
  const isOther = value === OTHER_TEACHER_VALUE;
  const selected = !isOther ? teachers.find((t) => t.id === value) : null;

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-expanded={open}
          className="inline-flex w-full items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 py-3 px-4 text-left transition-colors cursor-pointer focus-visible:outline-none"
        >
          {selected ? (
            <div className="flex flex-col items-start">
              <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {selected.firstName} {selected.lastName}
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">{selected.email}</span>
            </div>
          ) : isOther ? (
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">Otros</span>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500">Seleccionar profesor/a…</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-zinc-400" />
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 rounded-xl" align="start">
          <Command>
            <CommandInput placeholder="Buscar por nombre o email…" autoFocus />
            <CommandList>
              <CommandEmpty>Sin resultados.</CommandEmpty>
              <CommandGroup>
                {teachers.map((teacher) => (
                  <CommandItem
                    key={teacher.id}
                    value={`${teacher.firstName} ${teacher.lastName} ${teacher.email}`}
                    onSelect={() => {
                      onChange(teacher.id);
                      setOpen(false);
                    }}
                    className="py-3 cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {teacher.firstName} {teacher.lastName}
                      </span>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">{teacher.email}</span>
                    </div>
                  </CommandItem>
                ))}
                <CommandItem
                  value="otros"
                  onSelect={() => {
                    onChange(OTHER_TEACHER_VALUE);
                    setOpen(false);
                  }}
                  className="py-3 cursor-pointer border-t border-zinc-100 dark:border-zinc-700 mt-1"
                >
                  <span className="text-zinc-600 dark:text-zinc-400 italic">Otros…</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <AnimatePresence>
        {isOther && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Input
              placeholder="Nombre de la persona que rellena…"
              value={otherName}
              onChange={(e) => onOtherNameChange(e.target.value)}
              className="rounded-xl border-zinc-200 dark:border-zinc-700"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
