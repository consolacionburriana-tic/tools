'use client';

import { useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import type { Student } from '@/db/schema';

interface StudentPickerProps {
  students: Student[];
  value: string | null;
  onChange: (id: string) => void;
}

export function StudentPicker({ students, value, onChange }: StudentPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = students.find((s) => s.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-expanded={open}
        className="inline-flex w-full items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 py-3 px-4 text-left transition-colors cursor-pointer focus-visible:outline-none"
      >
        {selected ? (
          <div className="flex flex-col items-start">
            <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{selected.displayName}</span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">{selected.className}</span>
          </div>
        ) : (
          <span className="text-zinc-400 dark:text-zinc-500">Seleccionar alumno…</span>
        )}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-zinc-400" />
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 rounded-xl" align="start">
        <Command>
          <CommandInput placeholder="Buscar alumno…" autoFocus />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {students.map((student) => (
                <CommandItem
                  key={student.id}
                  value={`${student.fullName} ${student.displayName} ${student.className}`}
                  onSelect={() => {
                    onChange(student.id);
                    setOpen(false);
                  }}
                  className="py-3 cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{student.displayName}</span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">{student.className}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
