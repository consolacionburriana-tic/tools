'use client';

import { useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';

const EXTENSIONES = /\.(csv|xls|xlsx)$/i;

/**
 * Zona de subida compartida por los dos importadores de Educamos (alumnado y
 * profesorado): mismo aspecto, y drag & drop de verdad — antes el borde punteado
 * era decoración de la `<label>` y soltar un fichero encima hacía que el navegador
 * lo abriera en la pestaña.
 *
 * El `<input>` se vacía después de cada elección para que volver a soltar el MISMO
 * fichero (típico al reintentar) siga disparando el `onChange`.
 */
export function FileDropzone({
  id,
  file,
  onFile,
  titulo,
  hint = '.csv, .xls o .xlsx — se procesa en memoria, no se guarda',
  compacto = false,
}: {
  id: string;
  file: File | null;
  onFile: (f: File) => void;
  titulo: string;
  hint?: string;
  compacto?: boolean;
}) {
  const [sobre, setSobre] = useState(false);

  function aceptar(f: File | null | undefined) {
    if (!f) return;
    if (!EXTENSIONES.test(f.name)) {
      toast.error('El fichero tiene que ser .csv, .xls o .xlsx');
      haptic.warning();
      return;
    }
    onFile(f);
  }

  const icono = compacto ? 'h-6 w-6' : 'h-8 w-8';

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        setSobre(true);
      }}
      onDragOver={(e) => {
        e.preventDefault(); // sin esto el navegador abre el fichero en vez de soltarlo aquí
        setSobre(true);
      }}
      onDragLeave={(e) => {
        // Al pasar por encima de un hijo salta un dragleave del padre: solo apagamos
        // el resaltado si el puntero ha salido de verdad de la zona.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setSobre(false);
        aceptar(e.dataTransfer.files?.[0]);
      }}
    >
      <label
        htmlFor={id}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed text-center transition-colors ${
          compacto ? 'px-4 py-6' : 'px-4 py-8'
        } ${
          sobre
            ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10'
            : 'border-zinc-300 hover:border-blue-400 hover:bg-blue-50/50 dark:border-zinc-700 dark:hover:border-blue-500 dark:hover:bg-blue-500/5'
        }`}
      >
        {file ? (
          <>
            <FileSpreadsheet className={`${icono} text-emerald-600 dark:text-emerald-400`} />
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{file.name}</span>
            <span className="text-xs text-zinc-500">Suelta otro fichero aquí o toca para elegirlo</span>
          </>
        ) : (
          <>
            <Upload className={`${icono} ${sobre ? 'text-blue-500' : 'text-zinc-400'}`} />
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {sobre ? 'Suelta el fichero' : titulo}
            </span>
            <span className="text-xs text-zinc-500">{hint}</span>
          </>
        )}
      </label>
      <input
        id={id}
        type="file"
        accept=".csv,.xls,.xlsx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          aceptar(f);
        }}
      />
    </div>
  );
}
