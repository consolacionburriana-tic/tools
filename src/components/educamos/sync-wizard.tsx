'use client';

import { useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  CircleAlert,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  TriangleAlert,
  Upload,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';

// Tipos espejo (subset) del SyncPlan que devuelve /api/educamos/admin/sync/preview
interface DiffCampo {
  campo: string;
  actual: string | null;
  nuevo: string | null;
  gordo: boolean;
}
interface RowResumen {
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  curso: string | null;
  letra: string | null;
}
interface PlanAlta {
  fila: number;
  codigo: string | null;
  colision: boolean;
  row: RowResumen;
}
interface PlanCambio {
  studentId: string;
  codigo: string | null;
  nombreActual: string;
  diffs: DiffCampo[];
  tieneGordos: boolean;
}
interface PlanListado {
  studentId: string;
  codigo: string | null;
  nombreActual: string;
  curso?: string | null;
  letra?: string | null;
}
interface Plan {
  altas: PlanAlta[];
  cambios: PlanCambio[];
  sinCambios: PlanListado[];
  desaparecidos: PlanListado[];
  cursosEnFichero: string[];
  pareceParcial: boolean;
  warnings: string[];
}
interface PreviewResponse {
  ok: boolean;
  formato: string;
  totalFilas: number;
  cabecerasDescartadas: string[];
  plan: Plan;
  error?: string;
}

const ETIQUETAS: Record<string, string> = {
  codigo: 'Código interno',
  educamosPersonaId: 'ID Educamos',
  nia: 'NIA',
  dni: 'DNI',
  matricula: 'Matrícula',
  nombre: 'Nombre',
  apellido1: 'Primer apellido',
  apellido2: 'Segundo apellido',
  sexo: 'Sexo',
  fechaNacimiento: 'Fecha de nacimiento',
  curso: 'Curso',
  letra: 'Letra',
  claseCodigo: 'Código de clase',
  tutorPersonal: 'Tutor/a de clase',
  modeloLinguistico: 'Modelo lingüístico',
  deficit: 'Déficit',
  email: 'Email',
  emailGoogle: 'Email Google',
  movil1: 'Móvil 1',
  movil2: 'Móvil 2',
  telEmergencia: 'Tel. emergencia',
  familiaId: 'ID familia',
  extra: 'Datos adicionales',
  active: 'Estado',
};

function Cubo({
  icono,
  titulo,
  n,
  tono,
  abierto,
  onToggle,
  children,
}: {
  icono: React.ReactNode;
  titulo: string;
  n: number;
  tono: 'emerald' | 'amber' | 'red' | 'zinc';
  abierto: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  const tonos = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
    zinc: 'text-zinc-500',
  };
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className={`flex items-center gap-2 font-medium ${tonos[tono]}`}>
          {icono}
          {titulo}
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {n}
          </span>
        </span>
        {n > 0 && (
          <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
        )}
      </button>
      {abierto && n > 0 && <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">{children}</div>}
    </div>
  );
}

export function SyncWizard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [respetarCursoDe, setRespetarCursoDe] = useState<'bbdd' | 'excel'>('bbdd');
  const [cargando, setCargando] = useState<'preview' | 'aplicar' | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [conflictos, setConflictos] = useState<Record<string, 'bbdd' | 'excel'>>({});
  const [desactivar, setDesactivar] = useState<Set<string>>(new Set());
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set(['altas', 'cambios', 'desaparecidos']));
  const [resultado, setResultado] = useState<{ altas: number; cambios: number; desactivados: number; conflictosResueltos: number; errores: string[] } | null>(null);

  const toggle = (k: string) =>
    setAbiertos((prev) => {
      const s = new Set(prev);
      if (s.has(k)) s.delete(k);
      else s.add(k);
      return s;
    });

  async function pedirPreview(f: File, curso: 'bbdd' | 'excel') {
    setCargando('preview');
    setResultado(null);
    try {
      const fd = new FormData();
      fd.append('file', f);
      fd.append('respetarCursoDe', curso);
      const res = await fetch('/api/educamos/admin/sync/preview', { method: 'POST', body: fd });
      const data: PreviewResponse = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Error generando la vista previa');
      setPreview(data);
      setConflictos({});
      // Desaparecidos: marcados por defecto solo si el fichero parece completo
      setDesactivar(data.plan.pareceParcial ? new Set() : new Set(data.plan.desaparecidos.map((d) => d.studentId)));
      haptic.tap();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
      haptic.warning();
    } finally {
      setCargando(null);
    }
  }

  function onFile(f: File | null) {
    setFile(f);
    setPreview(null);
    setResultado(null);
    if (f) void pedirPreview(f, respetarCursoDe);
  }

  async function aplicar() {
    if (!file || !preview) return;
    const gordosSinResolver = preview.plan.cambios.filter((c) => c.tieneGordos && !conflictos[c.studentId]);
    if (gordosSinResolver.length > 0) {
      toast.warning(`Hay ${gordosSinResolver.length} conflicto(s) sin decidir: se mantendrá lo de la BBDD en esos alumnos.`);
    }
    setCargando('aplicar');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('respetarCursoDe', respetarCursoDe);
      fd.append('decisiones', JSON.stringify({ conflictos, desactivar: [...desactivar] }));
      const res = await fetch('/api/educamos/admin/sync/aplicar', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Error aplicando el sync');
      setResultado(data.resumen);
      setPreview(null);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      toast.success('Sincronización aplicada');
      haptic.success();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
      haptic.warning();
    } finally {
      setCargando(null);
    }
  }

  const plan = preview?.plan;

  return (
    <div className="space-y-4">
      {/* Paso 1: fichero + opciones */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <label
          htmlFor="fichero-educamos"
          className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 px-4 py-8 text-center hover:border-blue-400 hover:bg-blue-50/50 dark:border-zinc-700 dark:hover:border-blue-500 dark:hover:bg-blue-500/5"
        >
          {file ? (
            <>
              <FileSpreadsheet className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{file.name}</span>
              <span className="text-xs text-zinc-500">Toca para elegir otro fichero</span>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-zinc-400" />
              <span className="font-medium text-zinc-900 dark:text-zinc-100">Sube el export de Educamos</span>
              <span className="text-xs text-zinc-500">.csv, .xls o .xlsx — se procesa en memoria, no se guarda</span>
            </>
          )}
        </label>
        <input
          ref={fileRef}
          id="fichero-educamos"
          type="file"
          accept=".csv,.xls,.xlsx"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-zinc-600 dark:text-zinc-300">Si el curso difiere, respetar el de:</span>
          <div className="flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
            {(['bbdd', 'excel'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setRespetarCursoDe(v);
                  if (file) void pedirPreview(file, v);
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  respetarCursoDe === v
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                {v === 'bbdd' ? 'BBDD actual' : 'Excel subido'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {cargando === 'preview' && (
        <div className="flex items-center justify-center gap-2 py-8 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Comparando con la base de datos…
        </div>
      )}

      {/* Paso 2: vista previa */}
      {plan && preview && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span>
              {preview.totalFilas} filas ({preview.formato}) · cursos: {plan.cursosEnFichero.join(', ') || '—'}
            </span>
            {plan.pareceParcial && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                fichero parcial: solo se compara con esos cursos
              </span>
            )}
            {preview.cabecerasDescartadas.length > 0 && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                {preview.cabecerasDescartadas.length} columnas de pagadores ignoradas
              </span>
            )}
          </div>

          {plan.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <p className="mb-1 flex items-center gap-1.5 font-medium">
                <TriangleAlert className="h-4 w-4" /> Avisos del fichero
              </p>
              <ul className="list-inside list-disc space-y-0.5">
                {plan.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <Cubo
            icono={<UserPlus className="h-4 w-4" />}
            titulo="Altas"
            n={plan.altas.length}
            tono="emerald"
            abierto={abiertos.has('altas')}
            onToggle={() => toggle('altas')}
          >
            <ul className="space-y-1.5 text-sm">
              {plan.altas.map((a) => (
                <li key={a.fila} className="flex items-center justify-between gap-2">
                  <span className="text-zinc-800 dark:text-zinc-200">
                    {[a.row.nombre, a.row.apellido1, a.row.apellido2].filter(Boolean).join(' ')}
                    <span className="ml-2 text-xs text-zinc-500">
                      {a.row.curso}
                      {a.row.letra && a.row.letra !== 'PDC' ? ` ${a.row.letra}` : ''}
                    </span>
                  </span>
                  {a.colision ? (
                    <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/15 dark:text-red-300">
                      <CircleAlert className="h-3 w-3" /> código en conflicto: revisar a mano
                    </span>
                  ) : (
                    <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {a.codigo ?? 'sin código'}
                    </code>
                  )}
                </li>
              ))}
            </ul>
          </Cubo>

          <Cubo
            icono={<RefreshCw className="h-4 w-4" />}
            titulo="Cambios"
            n={plan.cambios.length}
            tono="amber"
            abierto={abiertos.has('cambios')}
            onToggle={() => toggle('cambios')}
          >
            <ul className="space-y-3">
              {plan.cambios.map((c) => (
                <li key={c.studentId} className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{c.nombreActual}</span>
                    {c.codigo && (
                      <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">{c.codigo}</code>
                    )}
                  </div>
                  <ul className="space-y-1 text-sm">
                    {c.diffs.map((d, i) => (
                      <li key={i} className={d.gordo ? 'text-red-700 dark:text-red-300' : 'text-zinc-600 dark:text-zinc-300'}>
                        <span className="font-medium">{ETIQUETAS[d.campo] ?? d.campo}:</span>{' '}
                        {d.campo === 'extra' ? (
                          <span>{d.nuevo}</span>
                        ) : (
                          <>
                            <span className="line-through opacity-60">{d.actual ?? '—'}</span> → <span>{d.nuevo ?? '—'}</span>
                          </>
                        )}
                        {d.gordo && <TriangleAlert className="ml-1 inline h-3.5 w-3.5" />}
                      </li>
                    ))}
                  </ul>
                  {c.tieneGordos && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm dark:border-red-500/30 dark:bg-red-500/10">
                      <span className="font-medium text-red-800 dark:text-red-200">¿Probable mismatch! ¿Qué mantengo?</span>
                      {(['bbdd', 'excel'] as const).map((v) => (
                        <label key={v} className="flex cursor-pointer items-center gap-1.5 text-red-900 dark:text-red-100">
                          <input
                            type="radio"
                            name={`conflicto-${c.studentId}`}
                            checked={conflictos[c.studentId] === v}
                            onChange={() => setConflictos((prev) => ({ ...prev, [c.studentId]: v }))}
                          />
                          {v === 'bbdd' ? 'Lo de la BBDD' : 'Lo del excel'}
                        </label>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Cubo>

          <Cubo
            icono={<UserMinus className="h-4 w-4" />}
            titulo="Desaparecidos"
            n={plan.desaparecidos.length}
            tono="red"
            abierto={abiertos.has('desaparecidos')}
            onToggle={() => toggle('desaparecidos')}
          >
            <p className="mb-2 text-xs text-zinc-500">
              Activos en la BBDD (de los cursos del fichero) que no vienen en el export. Marca a quién desactivar; nunca se borra nada.
            </p>
            <ul className="space-y-1.5 text-sm">
              {plan.desaparecidos.map((d) => (
                <li key={d.studentId}>
                  <label className="flex cursor-pointer items-center gap-2 text-zinc-800 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      checked={desactivar.has(d.studentId)}
                      onChange={(e) =>
                        setDesactivar((prev) => {
                          const s = new Set(prev);
                          if (e.target.checked) s.add(d.studentId);
                          else s.delete(d.studentId);
                          return s;
                        })
                      }
                    />
                    {d.nombreActual}
                    <span className="text-xs text-zinc-500">
                      {d.curso}
                      {d.letra && d.letra !== 'PDC' ? ` ${d.letra}` : ''}
                    </span>
                    {d.codigo && <code className="text-xs text-zinc-400">{d.codigo}</code>}
                  </label>
                </li>
              ))}
            </ul>
          </Cubo>

          <Cubo
            icono={<Users className="h-4 w-4" />}
            titulo="Sin cambios"
            n={plan.sinCambios.length}
            tono="zinc"
            abierto={abiertos.has('sinCambios')}
            onToggle={() => toggle('sinCambios')}
          >
            <ul className="grid grid-cols-1 gap-1 text-sm text-zinc-500 sm:grid-cols-2">
              {plan.sinCambios.map((s) => (
                <li key={s.studentId}>{s.nombreActual}</li>
              ))}
            </ul>
          </Cubo>

          {/* Aplicar (sticky para iPad) */}
          <div className="sticky bottom-0 -mx-4 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95"
            style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
          >
            <button
              type="button"
              onClick={aplicar}
              disabled={cargando !== null || (plan.altas.length === 0 && plan.cambios.length === 0 && desactivar.size === 0)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {cargando === 'aplicar' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
              Aplicar sincronización
              <span className="text-sm font-normal opacity-80">
                ({plan.altas.length} altas · {plan.cambios.length} cambios · {desactivar.size} bajas)
              </span>
            </button>
          </div>
        </>
      )}

      {/* Paso 3: resultado */}
      {resultado && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-200">
            <Check className="h-5 w-5" /> Sincronización aplicada
          </p>
          <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
            {resultado.altas} altas · {resultado.cambios} cambios · {resultado.desactivados} desactivados ·{' '}
            {resultado.conflictosResueltos} conflictos resueltos
          </p>
          {resultado.errores.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-sm text-amber-700 dark:text-amber-300">
              {resultado.errores.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
