'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { format, parseISO, subDays, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronRight, Filter, X, ArrowRight } from 'lucide-react';
import { BEHAVIORS, CONTEXTS, TIME_SLOTS } from '@/lib/constants';
import type { AbcStudent, Teacher } from '@/db/schema';

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

// ─────────────────────────────────────────────────────────────────────────
export default function RegistrosPage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [students, setStudents] = useState<AbcStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'list' | 'informe'>('list');
  const [timePreset, setTimePreset] = useState<string>('30');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);

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

    setLoading(true);
    fetch(`/api/reports?${params}`)
      .then((r) => r.json())
      .then((data) => { setReports(data); setLoading(false); });
  }, [mode, timePreset, selectedStudentIds, page]);

  const studentMap = useMemo(() => {
    const m = new Map<string, AbcStudent>();
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Registros</h1>
        <div className="flex rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden text-sm bg-white dark:bg-zinc-900">
          <button
            onClick={() => setMode('list')}
            className={`px-4 py-2 transition-colors ${mode === 'list' ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-medium' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
          >Listado</button>
          <button
            onClick={() => setMode('informe')}
            className={`px-4 py-2 transition-colors ${mode === 'informe' ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-medium' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
          >Informe agregado</button>
        </div>
      </div>

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
  students: AbcStudent[];
  selectedStudentIds: string[];
  onStudentsChange: (ids: string[]) => void;
}) {
  const [studentsOpen, setStudentsOpen] = useState(false);

  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500 font-medium uppercase tracking-widest pl-1">
        <Filter className="w-3.5 h-3.5" />
        Filtros
      </div>

      <div className="flex gap-1 p-1 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
        {TIME_PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => onTimePresetChange(p.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              timePreset === p.value
                ? 'bg-white dark:bg-zinc-900 text-teal-700 dark:text-teal-400 shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <button
          onClick={() => setStudentsOpen(!studentsOpen)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:border-teal-300 dark:hover:border-teal-700 transition-colors"
        >
          {selectedStudentIds.length === 0
            ? 'Todos los alumnos'
            : `${selectedStudentIds.length} alumno${selectedStudentIds.length > 1 ? 's' : ''}`}
          <ChevronRight className={`w-3 h-3 transition-transform ${studentsOpen ? 'rotate-90' : ''}`} />
        </button>

        {studentsOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setStudentsOpen(false)} />
            <div className="absolute top-full mt-1 left-0 z-40 w-64 max-h-80 overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-lg p-1.5">
              <button
                onClick={() => onStudentsChange([])}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Todos los alumnos
              </button>
              <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />
              {students.map((s) => {
                const checked = selectedStudentIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      onStudentsChange(
                        checked
                          ? selectedStudentIds.filter((id) => id !== s.id)
                          : [...selectedStudentIds, s.id]
                      );
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left"
                  >
                    <span className={`w-4 h-4 rounded border ${checked ? 'bg-teal-500 border-teal-500' : 'border-zinc-300 dark:border-zinc-600'} flex items-center justify-center shrink-0`}>
                      {checked && <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd"/></svg>}
                    </span>
                    <span className="flex-1 truncate">{s.displayName}</span>
                    <span className="text-zinc-400 text-[10px]">{s.className}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {selectedStudentIds.length > 0 && (
        <button
          onClick={() => onStudentsChange([])}
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors inline-flex items-center gap-1"
        >
          <X className="w-3 h-3" />
          Limpiar
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function ListView({
  reports, studentMap, loading, page, onPageChange,
}: {
  reports: ReportRow[];
  studentMap: Map<string, AbcStudent>;
  loading: boolean;
  page: number;
  onPageChange: (p: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-zinc-400 text-center">Cargando…</p>
        ) : reports.length === 0 ? (
          <p className="p-12 text-sm text-zinc-400 text-center">Sin registros para estos filtros.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {reports.map((r) => {
              const student = studentMap.get(r.studentId);
              const behaviors = r.behaviors ?? [];
              return (
                <li key={r.id}>
                  <Link
                    href={`/admin/registros/${r.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 flex items-center justify-center font-bold text-sm shrink-0">
                      {student?.displayName?.charAt(0) ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">
                          {student?.displayName ?? '—'}
                        </span>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">
                          {label(CONTEXTS, r.context)} · {label(TIME_SLOTS, r.timeSlot)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {behaviors.slice(0, 3).map((b) => (
                          <span
                            key={b}
                            className="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30"
                          >
                            {label(BEHAVIORS, b)}
                          </span>
                        ))}
                        {behaviors.length > 3 && (
                          <span className="text-[10px] text-zinc-400">+{behaviors.length - 3}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                        {format(parseISO(r.reportDate), "d MMM", { locale: es })}
                      </p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 capitalize">
                        {format(parseISO(r.reportDate), 'EEE', { locale: es })}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-300 dark:text-zinc-600 group-hover:text-teal-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Anterior
        </button>
        <span className="text-sm text-zinc-500">Página {page}</span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={reports.length < 20}
          className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

