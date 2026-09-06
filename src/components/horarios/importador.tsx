'use client';

// Importar un horario: arrastrar el fichero → ver qué va a entrar → confirmar.
//
// La vista previa NO es un adorno. Importar sobrescribe el periodo entero de esa etapa, así
// que aquí se ve, antes de tocar nada, cuántas sesiones trae cada clase, qué códigos no ha
// reconocido y qué notas del fichero no caben en la cuadrícula.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, FileUp, Loader2, StickyNote } from 'lucide-react';
import { toast } from 'sonner';

import { academicYearActual } from '@/lib/constants';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

interface Previa {
  bloquesTotales: number;
  deProfesor: number;
  clases: { codigo: string; nombre: string; etapa: string | null; sesiones: number; tramos: number; conAula: number; apoyos: number; incidencias: number }[];
  incidencias: { clave: string; veces: number }[];
  notas: string[];
  periodoSugerido: 'Ordinario' | 'Septiembre/Junio';
}

export function Importador() {
  const router = useRouter();
  const [fichero, setFichero] = useState<File | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [cargando, setCargando] = useState(false);
  const [sobre, setSobre] = useState(false);

  const year = academicYearActual();
  const [periodo, setPeriodo] = useState('Ordinario');
  const [desde, setDesde] = useState(`${year.slice(0, 4)}-09-01`);
  const [hasta, setHasta] = useState(`20${year.slice(5)}-05-31`);

  async function enviar(f: File, confirmar: boolean) {
    setCargando(true);
    try {
      const fd = new FormData();
      fd.set('fichero', f);
      fd.set('confirmar', String(confirmar));
      if (confirmar) {
        fd.set('academicYear', year);
        fd.set('periodo', periodo);
        fd.set('desde', desde);
        fd.set('hasta', hasta);
        fd.set('prioridad', periodo === 'Ordinario' ? '0' : '10');
        fd.set('ordinario', String(periodo === 'Ordinario'));
      }
      const res = await fetch('/api/horarios/admin/importar', { method: 'POST', body: fd });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? 'Error al importar');
      setPrevia(datos.previa);
      if (confirmar) {
        haptic.success();
        toast.success(`Importadas ${datos.resumen.sesiones} sesiones de ${datos.previa.clases.length} clases`);
        router.push('/gestion/horarios');
        router.refresh();
      } else {
        setPeriodo(datos.previa.periodoSugerido);
      }
    } catch (e) {
      haptic.warning();
      toast.error((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  function elegir(f: File | null | undefined) {
    if (!f) return;
    setFichero(f);
    setPrevia(null);
    void enviar(f, false);
  }

  return (
    <div className="space-y-5">
      <label
        onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => { e.preventDefault(); setSobre(false); elegir(e.dataTransfer.files?.[0]); }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors',
          sobre ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10' : 'border-zinc-300 bg-white hover:border-indigo-300 dark:border-zinc-700 dark:bg-zinc-900',
        )}
      >
        <input
          type="file"
          accept=".docx,.xlsx"
          className="sr-only"
          onChange={(e) => elegir(e.target.files?.[0])}
        />
        {cargando && !previa ? (
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        ) : (
          <FileUp className="h-8 w-8 text-zinc-400 dark:text-zinc-500" />
        )}
        <p className="mt-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {fichero ? fichero.name : 'Arrastra aquí el horario de Educamos'}
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          El <strong>.docx</strong> es el bueno: es el único que trae el aula. También vale el .xlsx.
        </p>
      </label>

      {previa && (
        <>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Esto es lo que va a entrar</h2>
            <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
              {previa.clases.length} clases · {previa.clases.reduce((n, c) => n + c.sesiones, 0)} sesiones.
              {previa.deProfesor > 0 && ` Los ${previa.deProfesor} horarios de profesor del fichero no se importan: son la misma información vista del revés, y el horario de cada profe sale solo.`}
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {previa.clases.map((c) => (
                <div key={c.codigo} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-xs dark:bg-zinc-800/60">
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">{c.nombre}</span>
                  <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                    {c.sesiones} ses{c.conAula > 0 && ` · ${c.conAula} aula`}
                    {c.incidencias > 0 && <span className="ml-1 text-amber-600 dark:text-amber-400">⚠{c.incidencias}</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {previa.incidencias.length > 0 && (
            <Aviso icono={<AlertTriangle className="h-4 w-4" />} titulo="Códigos que no reconoce">
              <p className="mb-2 text-xs">
                No se inventan: entran como actividad genérica y se pueden arreglar luego desde el catálogo.
              </p>
              <ul className="space-y-0.5 text-xs">
                {previa.incidencias.map((i) => (
                  <li key={i.clave} className="tabular-nums">
                    <strong>{i.veces}×</strong> {i.clave}
                  </li>
                ))}
              </ul>
            </Aviso>
          )}

          {previa.notas.length > 0 && (
            <Aviso icono={<StickyNote className="h-4 w-4" />} titulo="Notas del fichero que no caben en la cuadrícula">
              <ul className="space-y-0.5 text-xs">
                {previa.notas.map((n) => <li key={n}>· {n}</li>)}
              </ul>
            </Aviso>
          )}

          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">¿De qué periodo es?</h2>
            <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
              El fichero no lo dice, pero se nota: <strong>{previa.periodoSugerido}</strong> es lo que parece
              {previa.periodoSugerido === 'Ordinario' ? ' (tiene comedor y jornada partida)' : ' (jornada corta, sin comedor)'}.
              La etapa sí se deduce sola del código de cada clase, eso no hay que decirlo.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo label="Periodo">
                <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className={ESTILO_CAMPO}>
                  <option>Ordinario</option>
                  <option>Septiembre/Junio</option>
                </select>
              </Campo>
              <Campo label="Desde"><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={ESTILO_CAMPO} /></Campo>
              <Campo label="Hasta"><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={ESTILO_CAMPO} /></Campo>
            </div>
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Curso académico: <strong>{year}</strong></p>

            <button
              type="button"
              disabled={cargando || !fichero}
              onClick={() => fichero && enviar(fichero, true)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-600 disabled:opacity-50 sm:w-auto"
            >
              {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Importar {previa.clases.length} clases
            </button>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Sustituye el horario que ya hubiera de estas etapas en este periodo. Lo que hayas
              añadido a mano no se toca.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

const ESTILO_CAMPO =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function Aviso({ icono, titulo, children }: { icono: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">{icono}{titulo}</h3>
      {children}
    </div>
  );
}
