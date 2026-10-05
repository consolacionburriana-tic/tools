'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';

const CICLO = ['system', 'light', 'dark'] as const;
type Tema = (typeof CICLO)[number];

const ETIQUETA: Record<Tema, string> = {
  system: 'Automático (sigue al dispositivo)',
  light: 'Claro',
  dark: 'Oscuro',
};

const ICONO: Record<Tema, typeof Sun> = { system: Monitor, light: Sun, dark: Moon };

// `theme` solo se conoce en el cliente: hasta hidratar se pinta el icono neutro para no
// provocar un desajuste entre el HTML del servidor y el del navegador.
const noopSubscribe = () => () => {};

/**
 * Botón de apariencia para la cabecera del escritorio, junto a «Salir». Cada toque pasa al
 * siguiente modo: Automático → Claro → Oscuro. Automático (el de por defecto) sigue al
 * dispositivo; los otros dos lo fuerzan y next-themes lo recuerda en este navegador, así que
 * vale para toda la app (los módulos no tienen su propio botón).
 */
export function SelectorTema() {
  const { theme, setTheme } = useTheme();
  const montado = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const actual: Tema = montado && CICLO.includes(theme as Tema) ? (theme as Tema) : 'system';
  const siguiente = CICLO[(CICLO.indexOf(actual) + 1) % CICLO.length];
  const Icono = ICONO[actual];

  return (
    <button
      type="button"
      onClick={() => setTheme(siguiente)}
      aria-label={`Apariencia: ${ETIQUETA[actual]}. Cambiar a ${ETIQUETA[siguiente]}`}
      title={`Apariencia: ${ETIQUETA[actual]}`}
      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      <Icono className="h-4 w-4" />
    </button>
  );
}
