'use client';

// Botón con el emoji actual que abre un selector: primero los típicos de colegio, y debajo
// el selector estándar completo (búsqueda, categorías) para el resto.
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { EmojiStyle, Theme } from 'emoji-picker-react';
import { useTheme } from 'next-themes';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EMOJIS_ACADEMICOS } from '@/lib/mihorario';

// Pesa bastante: solo se descarga cuando alguien abre el selector.
const Picker = dynamic(() => import('emoji-picker-react'), {
  ssr: false,
  loading: () => <div className="h-[320px] animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />,
});

export function SelectorEmoji({
  valor,
  onChange,
  sugeridos = EMOJIS_ACADEMICOS,
}: {
  valor: string;
  onChange: (emoji: string) => void;
  /** Los de la primera fila (por defecto, los de colegio de Mi horario). */
  sugeridos?: readonly string[];
}) {
  const [abierto, setAbierto] = useState(false);
  const { resolvedTheme } = useTheme();

  function elegir(e: string) {
    onChange(e);
    setAbierto(false);
  }

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger
        aria-label="Elegir emoji"
        className="flex h-10 w-12 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-xl hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        {valor}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[22rem] max-w-[calc(100vw-1.5rem)] p-2">
        <div className="grid grid-cols-8 gap-0.5">
          {sugeridos.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => elegir(e)}
              className="flex h-9 items-center justify-center rounded-md text-xl hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {e}
            </button>
          ))}
        </div>
        <Picker
          width="100%"
          height={320}
          lazyLoadEmojis
          emojiStyle={EmojiStyle.NATIVE}
          theme={resolvedTheme === 'dark' ? Theme.DARK : Theme.LIGHT}
          searchPlaceholder="Buscar emoji"
          previewConfig={{ showPreview: false }}
          onEmojiClick={(d) => elegir(d.emoji)}
        />
      </PopoverContent>
    </Popover>
  );
}
