'use client';

import { useState } from 'react';
import { Search, Star } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import type { DestacadoItem, RosterItem } from '@/lib/abc-server';

/** Selección: fila de config del ABC (destacado) o alumno de la BBDD central (buscador). */
export type StudentSelection = { abcStudentId?: string; eduStudentId?: string; label: string } | null;

interface StudentPickerProps {
  destacados: DestacadoItem[];
  roster: RosterItem[];
  value: StudentSelection;
  onChange: (sel: StudentSelection) => void;
}

// Los alumnos configurados por el admin salen destacados arriba (1 toque);
// cualquier otro alumno del cole se encuentra por el buscador.
export function StudentPicker({ destacados, roster, value, onChange }: StudentPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      {destacados.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {destacados.map((d) => {
            const activo = value?.abcStudentId === d.abcStudentId;
            return (
              <button
                key={d.abcStudentId}
                type="button"
                onClick={() => onChange({ abcStudentId: d.abcStudentId, label: d.nombre })}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                  activo
                    ? 'border-teal-600 bg-teal-600 text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-teal-300 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-200 dark:hover:border-teal-600'
                }`}
              >
                <Star className={`h-3.5 w-3.5 ${activo ? 'text-white' : 'text-amber-400'}`} />
                <span>
                  {d.nombre}
                  <span className={`ml-1.5 text-xs font-normal ${activo ? 'text-teal-100' : 'text-zinc-400'}`}>{d.detalle}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-expanded={open}
          className="inline-flex w-full items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 py-3 px-4 text-left transition-colors cursor-pointer focus-visible:outline-none"
        >
          {value && !value.abcStudentId ? (
            <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{value.label}</span>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500">
              {destacados.length > 0 ? 'O busca a cualquier otro alumno…' : 'Buscar alumno…'}
            </span>
          )}
          <Search className="ml-2 h-4 w-4 shrink-0 text-zinc-400" />
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 rounded-xl" align="start">
          <Command>
            <CommandInput placeholder="Nombre, apellidos o clase…" autoFocus />
            <CommandList>
              <CommandEmpty>Sin resultados.</CommandEmpty>
              <CommandGroup>
                {roster.map((s) => (
                  <CommandItem
                    key={s.eduStudentId}
                    value={`${s.nombre} ${s.clase}`}
                    onSelect={() => {
                      onChange({ eduStudentId: s.eduStudentId, label: s.nombre });
                      setOpen(false);
                    }}
                    className="py-2.5 cursor-pointer"
                  >
                    <div className="flex w-full items-baseline justify-between gap-2">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{s.nombre}</span>
                      <span className="shrink-0 text-xs text-zinc-400">{s.clase}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
