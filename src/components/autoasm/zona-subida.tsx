'use client';

import { useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const ACEPTA = /\.(zip|csv)$/i;

/**
 * Suelta aquí el ZIP del curso pasado (o los CSV sueltos). Acepta varios ficheros a la
 * vez porque lo normal es tener los seis por separado en la carpeta de Descargas.
 */
export function ZonaSubida({
  onFicheros,
  ocupado,
  leyendo,
}: {
  onFicheros: (files: File[]) => void;
  ocupado?: boolean;
  /** Mientras se leen los ficheros elegidos: la ruedecita en el botón. */
  leyendo?: boolean;
}) {
  const [sobre, setSobre] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function aceptar(lista: FileList | null) {
    const files = Array.from(lista ?? []).filter((f) => ACEPTA.test(f.name));
    if (files.length === 0) {
      haptic.warning();
      return;
    }
    haptic.tap();
    onFicheros(files);
  }

  return (
    <div
      onDragEnter={(e) => { e.preventDefault(); setSobre(true); }}
      onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobre(false); }}
      onDrop={(e) => { e.preventDefault(); setSobre(false); aceptar(e.dataTransfer.files); }}
      className={cn(
        'flex h-full flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-colors',
        sobre
          ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-500/10'
          : 'border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900',
      )}
    >
      <input
        ref={input}
        type="file"
        multiple
        accept=".zip,.csv,text/csv,application/zip"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => { aceptar(e.target.files); e.target.value = ''; }}
      />
      <FileUp aria-hidden className={cn('h-7 w-7', sobre ? 'text-blue-500' : 'text-zinc-400')} />
      <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Arrastra aquí el ZIP del curso pasado</p>
      <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
        o los CSV sueltos: se leen en el navegador, no se suben a ningún sitio
      </p>
      <Button variant="outline" className="mt-3" disabled={ocupado} cargando={leyendo} onClick={() => input.current?.click()}>
        {leyendo ? 'Leyendo…' : 'Elegir ficheros'}
      </Button>
    </div>
  );
}
