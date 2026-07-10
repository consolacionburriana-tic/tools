'use client';

import { useRef, useState } from 'react';
import { Check, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';

interface Resumen {
  altas: number;
  cambios: number;
  sinCambios: number;
  bajas: number;
  errores: string[];
}

// Import de profesorado: vista previa (dry-run) → confirmar → aplicado.
export function ProfesImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [cargando, setCargando] = useState(false);
  const [previa, setPrevia] = useState<Resumen | null>(null);
  const [aplicado, setAplicado] = useState<Resumen | null>(null);

  async function enviar(f: File, dryRun: boolean) {
    setCargando(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      if (dryRun) fd.append('dryRun', '1');
      const res = await fetch('/api/educamos/admin/sync/profesores', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Error procesando el fichero');
      if (dryRun) {
        setPrevia(data.resumen);
        haptic.tap();
      } else {
        setAplicado(data.resumen);
        setPrevia(null);
        setFile(null);
        if (fileRef.current) fileRef.current.value = '';
        toast.success('Profesorado actualizado');
        haptic.success();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
      haptic.warning();
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-3">
      <label
        htmlFor="fichero-profes"
        className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 px-4 py-6 text-center hover:border-blue-400 hover:bg-blue-50/50 dark:border-zinc-700 dark:hover:border-blue-500 dark:hover:bg-blue-500/5"
      >
        {file ? (
          <>
            <FileSpreadsheet className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{file.name}</span>
          </>
        ) : (
          <>
            <Upload className="h-6 w-6 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Export de profesorado</span>
            <span className="text-xs text-zinc-500">.csv, .xls o .xlsx — se procesa en memoria</span>
          </>
        )}
      </label>
      <input
        ref={fileRef}
        id="fichero-profes"
        type="file"
        accept=".csv,.xls,.xlsx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setFile(f);
          setPrevia(null);
          setAplicado(null);
          if (f) void enviar(f, true);
        }}
      />

      {cargando && (
        <p className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Procesando…
        </p>
      )}

      {previa && file && (
        <div className="space-y-2 rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-800/60">
          <p className="text-zinc-700 dark:text-zinc-200">
            {previa.altas} altas · {previa.cambios} cambios · {previa.sinCambios} sin cambios · {previa.bajas} con baja
          </p>
          {previa.errores.length > 0 && (
            <ul className="list-inside list-disc text-xs text-amber-700 dark:text-amber-300">
              {previa.errores.slice(0, 5).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => void enviar(file, false)}
            disabled={cargando}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> Aplicar import
          </button>
        </div>
      )}

      {aplicado && (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <Check className="h-4 w-4" /> {aplicado.altas} altas · {aplicado.cambios} cambios · {aplicado.bajas} con baja
        </p>
      )}
    </div>
  );
}
