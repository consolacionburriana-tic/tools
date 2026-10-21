'use client';

// Botón con el emoji actual que abre un selector: primero los típicos de colegio, y debajo
// el selector estándar completo (búsqueda, categorías) para el resto.
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { EmojiStyle, Theme } from 'emoji-picker-react';
import { useTheme } from 'next-themes';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { EMOJIS_ACADEMICOS } from '@/lib/mihorario';

// Pesa bastante: solo se descarga cuando alguien abre el selector.
const Picker = dynamic(() => import('emoji-picker-react'), {
  ssr: false,
  loading: () => <Skeleton className="h-80 rounded-xl" />,
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
        className="flex h-10 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-zinc-300 bg-white text-xl outline-none hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        {valor}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[22rem] max-w-[calc(100vw-1.5rem)] p-2">
        <div className="grid grid-cols-8 gap-0.5">
          {sugeridos.map((e) => (
            <button
              key={e}
              type="button"
              aria-label={`Elegir ${e}`}
              onClick={() => elegir(e)}
              className="flex h-10 cursor-pointer items-center justify-center rounded-lg text-xl outline-none hover:bg-zinc-100 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-zinc-800"
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
