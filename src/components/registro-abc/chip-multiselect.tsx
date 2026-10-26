'use client';

import { Check } from 'lucide-react';
import { Filtro, Filtros } from '@/components/ui/filtro';

interface Option {
  value: string;
  label: string;
}

interface ChipMultiselectProps {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  /** Para el lector de pantalla («Conductas»). */
  etiqueta?: string;
}

// Marcar varias de la lista: las pastillas comunes (`Filtro`), con el visto en las marcadas.
export function ChipMultiselect({ options, value, onChange, etiqueta = 'Marca las que correspondan' }: ChipMultiselectProps) {
  const toggle = (optValue: string) => {
    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  };

  return (
    <Filtros etiqueta={etiqueta}>
      {options.map((opt) => {
        const selected = value.includes(opt.value);
        return (
          <Filtro
            key={opt.value}
            activo={selected}
            onClick={() => toggle(opt.value)}
            icono={selected ? <Check aria-hidden /> : undefined}
            acento="verde"
            className="h-12 px-5"
          >
            {opt.label}
          </Filtro>
        );
      })}
    </Filtros>
  );
}
