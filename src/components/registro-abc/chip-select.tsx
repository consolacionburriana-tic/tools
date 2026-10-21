'use client';

import { Filtro, Filtros } from '@/components/ui/filtro';

interface Option {
  value: string;
  label: string;
}

interface ChipSelectProps {
  options: Option[];
  value: string | null;
  onChange: (value: string) => void;
  /** Para el lector de pantalla («Dónde ocurre»). */
  etiqueta?: string;
}

// Elegir una opción de la lista: las pastillas comunes (`Filtro`), la elegida en negro, a
// 48 px como en Puntualidad porque se rellena de pie, con el iPad en la mano.
export function ChipSelect({ options, value, onChange, etiqueta = 'Elige una opción' }: ChipSelectProps) {
  return (
    <Filtros etiqueta={etiqueta}>
      {options.map((opt) => (
        <Filtro key={opt.value} activo={value === opt.value} onClick={() => onChange(opt.value)} className="h-12 px-5">
          {opt.label}
        </Filtro>
      ))}
    </Filtros>
  );
}
