'use client';

import { useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { haptic } from '@/lib/haptics';

const ACEPTA = /\.(zip|csv)$/i;

/**
 * Suelta aquí el ZIP del curso pasado (o los CSV sueltos). Acepta varios ficheros a la
 * vez porque lo normal es tener los seis por separado en la carpeta de Descargas.
 */
export function ZonaSubida({ onFicheros, ocupado }: { onFicheros: (files: File[]) => void; ocupado?: boolean }) {
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
      className={`rounded-2xl border-2 border-dashed p-5 text-center transition-colors ${
        sobre
          ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-500/10'
          : 'border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900'
      }`}
    >
      <input
        ref={input}
        type="file"
        multiple
        accept=".zip,.csv,text/csv,application/zip"
        className="sr-only"
        onChange={(e) => { aceptar(e.target.files); e.target.value = ''; }}
      />
      <FileUp className={`mx-auto h-7 w-7 ${sobre ? 'text-blue-500' : 'text-zinc-400'}`} />
      <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Arrastra aquí el ZIP del curso pasado
      </p>
      <p className="mt-0.5 text-xs text-zinc-500">o los CSV sueltos — se leen en el navegador, no se suben a ningún sitio</p>
      <button
        type="button"
        disabled={ocupado}
        onClick={() => input.current?.click()}
        className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 active:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
      >
        Elegir ficheros
      </button>
    </div>
  );
}
