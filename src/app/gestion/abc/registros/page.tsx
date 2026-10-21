'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { format, parseISO, subDays, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { SkeletonRows } from '@/components/ui/skeleton';
import { claseTarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { BEHAVIORS, CONTEXTS, TIME_SLOTS } from '@/lib/constants';
import type { Teacher } from '@/db/schema';
import type { AbcStudentPanel } from '@/lib/abc-server';

// El informe agregado (recharts, el chunk de cliente más pesado del repo) solo se pinta en
// mode === 'informe'; el listado (modo por defecto) nunca debe descargarlo.
const RegistrosCharts = dynamic(() => import('@/components/registro-abc/registros-charts'), { ssr: false });

export type ReportRow = {
  id: string;
  studentId: string;
  teacherId: string | null;
  otherTeacherName: string | null;
  reportDate: string;
  dayOfWeek: number;
  context: string;
  contextNote: string | null;
  timeSlot: string;
  presentPeople: string[];
  presentNames: string | null;
  behaviors: string[];
  involvedWith: string | null;
  situationDescription: string | null;
  antecedents: string | null;
  consequences: string | null;
  redirectActions: string | null;
  reasons: string[] | null;
  reasonOther: string | null;
  effectivenessRating: string | null;
  comments: string | null;
  createdAt: string;
};

export const TIME_PRESETS: { value: string; label: string }[] = [
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: 'curso', label: 'Este curso' },
  { value: 'all', label: 'Todo' },
];

export function getDateRange(preset: string): { from: Date; to: Date } | null {
  const now = new Date();
  if (preset === 'all') return null;
  if (preset === 'curso') {
    const year = now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear();
    return { from: new Date(year, 8, 1), to: endOfDay(now) };
  }
  const days = parseInt(preset);
  return { from: startOfDay(subDays(now, days - 1)), to: endOfDay(now) };
}

export function label<T extends { value: string; label: string }>(arr: readonly T[], val: string): string {
  return arr.find((x) => x.value === val)?.label ?? val;
}

// Recuerda el filtro temporal y de alumnos entre visitas (por navegador, no por usuario):
// David entra a mirar siempre el mismo caso, no tiene sentido reconfigurar cada vez.
const FILTROS_KEY = 'abc-registros-filtros';
type FiltrosGuardados = { timePreset: string; selectedStudentIds: string[] };

function cargarFiltros(): FiltrosGuardados {
  const porDefecto: FiltrosGuardados = { timePreset: 'curso', selectedStudentIds: [] };
  if (typeof window === 'undefined') return porDefecto;
  try {
    const raw = localStorage.getItem(FILTROS_KEY);
    if (!raw) return porDefecto;
    const guardado = JSON.parse(raw) as Partial<FiltrosGuardados>;
    return {
      timePreset: guardado.timePreset ?? porDefecto.timePreset,
      selectedStudentIds: Array.isArray(guardado.selectedStudentIds) ? guardado.selectedStudentIds : [],
    };
  } catch {
    return porDefecto;
  }
}

// ─────────────────────────────────────────────────────────────────────────
export default function RegistrosPage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [students, setStudents] = useState<AbcStudentPanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'list' | 'informe'>('informe');
  const [timePreset, setTimePreset] = useState<string>('curso');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [filtrosListos, setFiltrosListos] = useState(false);

  // Los filtros guardados solo se leen en el cliente (evita el desajuste con el HTML
  // del servidor); hasta que carguen no se persiste nada, para no pisarlos con el default.
  useEffect(() => {
    const t = setTimeout(() => {
      const guardados = cargarFiltros();
      setTimePreset(guardados.timePreset);
      setSelectedStudentIds(guardados.selectedStudentIds);
      setFiltrosListos(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!filtrosListos) return;
    try {
      localStorage.setItem(FILTROS_KEY, JSON.stringify({ timePreset, selectedStudentIds }));
    } catch {
      // localStorage no disponible: sin persistencia, sin más
    }
  }, [filtrosListos, timePreset, selectedStudentIds]);

  const [teachers, setTeachers] = useState<Teacher[]>([]);

  useEffect(() => {
    fetch('/api/students').then((r) => r.json()).then(setStudents);
    fetch('/api/teachers').then((r) => r.json()).then(setTeachers);
  }, []);

  useEffect(() => {
    const range = getDateRange(timePreset);
    const params = new URLSearchParams();
    if (range) {
      params.set('from', format(range.from, 'yyyy-MM-dd'));
      params.set('to', format(range.to, 'yyyy-MM-dd'));
    }
    if (selectedStudentIds.length > 0) params.set('studentIds', selectedStudentIds.join(','));

    if (mode === 'informe') {
      params.set('all', 'true');
    } else {
      params.set('page', String(page));
      params.set('limit', '20');
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga al montar/cambiar el filtro: el spinner tiene que encenderse aquí
    setLoading(true);
    fetch(`/api/reports?${params}`)
      .then((r) => r.json())
      .then((data) => { setReports(data); setLoading(false); });
  }, [mode, timePreset, selectedStudentIds, page]);

  const studentMap = useMemo(() => {
    const m = new Map<string, AbcStudentPanel>();
    students.forEach((s) => m.set(s.id, s));
    return m;
  }, [students]);

  const teacherMap = useMemo(() => {
    const m = new Map<string, Teacher>();
    teachers.forEach((t) => m.set(t.id, t));
    return m;
  }, [teachers]);

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Registros</h1>
      {/* Bajo las secciones del módulo no va otro segmentado: las dos vistas son filtros. */}
      <Filtros etiqueta="Ver">
        <Filtro activo={mode === 'informe'} onClick={() => setMode('informe')}>
          Informe agregado
        </Filtro>
        <Filtro activo={mode === 'list'} onClick={() => setMode('list')}>
          Listado
        </Filtro>
      </Filtros>

      <FiltersBar
        timePreset={timePreset}
        onTimePresetChange={setTimePreset}
        students={students}
        selectedStudentIds={selectedStudentIds}
        onStudentsChange={setSelectedStudentIds}
      />

      {mode === 'list'
        ? <ListView reports={reports} studentMap={studentMap} loading={loading} page={page} onPageChange={setPage} />
        : <RegistrosCharts reports={reports} loading={loading} timePreset={timePreset} studentMap={studentMap} teacherMap={teacherMap} selectedStudentIds={selectedStudentIds} />
      }
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function FiltersBar({
  timePreset, onTimePresetChange, students, selectedStudentIds, onStudentsChange,
}: {
  timePreset: string;
  onTimePresetChange: (v: string) => void;
  students: AbcStudentPanel[];
  selectedStudentIds: string[];
  onStudentsChange: (ids: string[]) => void;
}) {
  const [studentsOpen, setStudentsOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Filtros etiqueta="Periodo">
        {TIME_PRESETS.map((p) => (
          <Filtro key={p.value} activo={timePreset === p.value} onClick={() => onTimePresetChange(p.value)}>
            {p.label}
          </Filtro>
        ))}
      </Filtros>

      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          aria-expanded={studentsOpen}
          onClick={() => setStudentsOpen(!studentsOpen)}
        >
          {selectedStudentIds.length === 0
            ? 'Todos los alumnos'
            : `${selectedStudentIds.length} alumno${selectedStudentIds.length > 1 ? 's' : ''}`}
          <ChevronRight aria-hidden className={cn('transition-transform', studentsOpen && 'rotate-90')} />
        </Button>

        {studentsOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setStudentsOpen(false)} />
            <div className="absolute top-full left-0 z-40 mt-1 max-h-80 w-64 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => onStudentsChange([])}
                className="flex h-10 w-full items-center rounded-lg px-3 text-left text-sm font-medium text-zinc-600 outline-none hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Todos los alumnos
              </button>
              <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
              {students.map((s) => {
                const checked = selectedStudentIds.includes(s.id);
                return (
                  <button
                    type="button"
                    key={s.id}
                    aria-pressed={checked}
                    onClick={() => {
                      onStudentsChange(
                        checked
                          ? selectedStudentIds.filter((id) => id !== s.id)
                          : [...selectedStudentIds, s.id]
                      );
                    }}
                    className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-zinc-700 outline-none hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <span
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded border',
                        checked ? 'border-blue-600 bg-blue-600' : 'border-zinc-300 dark:border-zinc-600',
                      )}
                    >
                      {checked && <Check aria-hidden className="size-3 text-white" />}
                    </span>
                    <span className="flex-1 truncate">{s.siglas}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{s.clase}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {selectedStudentIds.length > 0 && (
        <Button variant="ghost" size="sm" onClick={() => onStudentsChange([])}>
          <X aria-hidden />
          Limpiar
        </Button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function ListView({
  reports, studentMap, loading, page, onPageChange,
}: {
  reports: ReportRow[];
  studentMap: Map<string, AbcStudentPanel>;
  loading: boolean;
  page: number;
  onPageChange: (p: number) => void;
}) {
  return (
    <div className="space-y-3">
      {loading ? (
        <SkeletonRows n={6} />
      ) : reports.length === 0 ? (
        <Vacio titulo="Sin registros para estos filtros." />
      ) : (
        <ul className={cn(claseTarjeta, 'divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800')}>
          {reports.map((r) => {
            const student = studentMap.get(r.studentId);
            const behaviors = r.behaviors ?? [];
            return (
              <li key={r.id}>
                <Link
                  href={`/gestion/abc/registros/${r.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 outline-none transition-colors hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset dark:hover:bg-zinc-800/50"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-sm font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {student?.siglas?.charAt(0) ?? '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {student?.siglas ?? '—'}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {label(CONTEXTS, r.context)} · {label(TIME_SLOTS, r.timeSlot)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {behaviors.slice(0, 3).map((b) => (
                        <Etiqueta key={b}>{label(BEHAVIORS, b)}</Etiqueta>
                      ))}
                      {behaviors.length > 3 && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">+{behaviors.length - 3}</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-medium whitespace-nowrap text-zinc-600 tabular-nums dark:text-zinc-300">
                      {format(parseISO(r.reportDate), "d MMM", { locale: es })}
                    </p>
                    <p className="text-xs text-zinc-500 capitalize dark:text-zinc-400">
                      {format(parseISO(r.reportDate), 'EEE', { locale: es })}
                    </p>
                  </div>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-zinc-400" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="sm" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}>
          Anterior
        </Button>
        <span className="text-sm text-zinc-500 tabular-nums dark:text-zinc-400">Página {page}</span>
        <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={reports.length < 20}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}
