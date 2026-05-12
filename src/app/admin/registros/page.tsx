'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format, parseISO, subDays, startOfDay, endOfDay, eachDayOfInterval, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';
import { ChevronRight, Filter, X, Calendar as CalendarIcon, AlertTriangle, TrendingUp, ArrowRight } from 'lucide-react';
import { BEHAVIORS, REASONS, TIME_SLOTS, CONTEXTS, PRESENT_PEOPLE } from '@/lib/constants';
import type { AbcStudent } from '@/db/schema';

type ReportRow = {
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
  behaviors: string[];
  involvedWith: string | null;
  reasons: string[] | null;
  effectivenessRating: string | null;
  createdAt: string;
};

const TIME_PRESETS: { value: string; label: string }[] = [
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: 'curso', label: 'Este curso' },
  { value: 'all', label: 'Todo' },
];

const TEAL = '#0d9488';
const PALETTE = ['#0d9488', '#0891b2', '#06b6d4', '#22d3ee', '#67e8f9', '#a5f3fc'];
const WEEKDAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function getDateRange(preset: string): { from: Date; to: Date } | null {
  const now = new Date();
  if (preset === 'all') return null;
  if (preset === 'curso') {
    const year = now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear();
    return { from: new Date(year, 8, 1), to: endOfDay(now) };
  }
  const days = parseInt(preset);
  return { from: startOfDay(subDays(now, days - 1)), to: endOfDay(now) };
}

function label<T extends { value: string; label: string }>(arr: readonly T[], val: string): string {
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

  useEffect(() => {
    fetch('/api/students').then((r) => r.json()).then(setStudents);
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
        : <InformeView reports={reports} loading={loading} timePreset={timePreset} />
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

// ─────────────────────────────────────────────────────────────────────────
function InformeView({
  reports, loading, timePreset,
}: {
  reports: ReportRow[];
  loading: boolean;
  timePreset: string;
}) {
  const stats = useMemo(() => {
    if (reports.length === 0) return null;

    const total = reports.length;
    const uniqueStudents = new Set(reports.map((r) => r.studentId)).size;
    const uniqueTeachers = new Set(reports.map((r) => r.teacherId).filter(Boolean)).size;

    const effVals = reports.map((r) => r.effectivenessRating).filter((v): v is string => !!v).map(parseFloat);
    const avgEff = effVals.length > 0 ? effVals.reduce((s, v) => s + v, 0) / effVals.length : null;

    const behaviorCount = new Map<string, number>();
    reports.forEach((r) => (r.behaviors ?? []).forEach((b) => behaviorCount.set(b, (behaviorCount.get(b) ?? 0) + 1)));
    const behaviorRanking = BEHAVIORS
      .map((b) => ({ name: b.label, count: behaviorCount.get(b.value) ?? 0 }))
      .sort((a, b) => b.count - a.count);
    const maxBehavior = Math.max(1, ...behaviorRanking.map((b) => b.count));

    const reasonCount = new Map<string, number>();
    reports.forEach((r) => (r.reasons ?? []).forEach((x) => reasonCount.set(x, (reasonCount.get(x) ?? 0) + 1)));
    const reasonRanking = REASONS
      .map((r) => ({ name: r.label, count: reasonCount.get(r.value) ?? 0 }))
      .sort((a, b) => b.count - a.count);

    const contextData = CONTEXTS.map((c) => ({
      name: c.label,
      value: reports.filter((r) => r.context === c.value).length,
    })).filter((c) => c.value > 0);

    const weekdayData = [1, 2, 3, 4, 5].map((d) => ({
      name: WEEKDAY_NAMES[d],
      count: reports.filter((r) => r.dayOfWeek === d).length,
    }));

    const slotData = TIME_SLOTS.map((s) => ({
      name: s.label.split(' ').slice(0, 2).join(' '),
      count: reports.filter((r) => r.timeSlot === s.value).length,
    }));

    const heatmap: { day: number; slot: string; count: number }[] = [];
    for (let day = 1; day <= 5; day++) {
      for (const s of TIME_SLOTS) {
        heatmap.push({
          day, slot: s.value,
          count: reports.filter((r) => r.dayOfWeek === day && r.timeSlot === s.value).length,
        });
      }
    }
    const heatmapMax = Math.max(1, ...heatmap.map((h) => h.count));

    const range = getDateRange(timePreset);
    let trendData: { label: string; count: number }[] = [];
    if (range && differenceInDays(range.to, range.from) <= 92) {
      const days = eachDayOfInterval({ start: range.from, end: range.to });
      trendData = days.map((d) => {
        const dStr = format(d, 'yyyy-MM-dd');
        return {
          label: format(d, days.length > 31 ? 'd MMM' : 'd', { locale: es }),
          count: reports.filter((r) => r.reportDate === dStr).length,
        };
      });
    } else {
      const byWeek = new Map<string, number>();
      reports.forEach((r) => {
        const d = parseISO(r.reportDate);
        const key = format(d, 'yyyy-ww');
        byWeek.set(key, (byWeek.get(key) ?? 0) + 1);
      });
      trendData = Array.from(byWeek.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, count]) => ({ label: `s${k.split('-')[1]}`, count }));
    }

    const effBuckets = [
      { label: '0-1', count: effVals.filter((v) => v < 1).length },
      { label: '1-2', count: effVals.filter((v) => v >= 1 && v < 2).length },
      { label: '2-3', count: effVals.filter((v) => v >= 2 && v < 3).length },
      { label: '3-4', count: effVals.filter((v) => v >= 3 && v < 4).length },
      { label: '4-5', count: effVals.filter((v) => v >= 4).length },
    ];

    const peopleCount = new Map<string, number>();
    reports.forEach((r) => (r.presentPeople ?? []).forEach((p) => peopleCount.set(p, (peopleCount.get(p) ?? 0) + 1)));
    const peopleData = PRESENT_PEOPLE
      .map((p) => ({ name: p.label, count: peopleCount.get(p.value) ?? 0 }))
      .filter((p) => p.count > 0)
      .sort((a, b) => b.count - a.count);

    return {
      total, uniqueStudents, uniqueTeachers, avgEff,
      behaviorRanking, maxBehavior, reasonRanking, contextData,
      weekdayData, slotData, heatmap, heatmapMax, trendData,
      effBuckets, effValsCount: effVals.length, peopleData,
    };
  }, [reports, timePreset]);

  if (loading) {
    return <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 text-center text-sm text-zinc-400">Cargando datos…</div>;
  }
  if (!stats) {
    return <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 text-center text-sm text-zinc-400">Sin datos para estos filtros.</div>;
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Registros" value={stats.total} hint="en el rango" accent />
        <KpiCard label="Alumnos" value={stats.uniqueStudents} hint="con registros" />
        <KpiCard label="Profesores" value={stats.uniqueTeachers} hint="que registran" />
        <KpiCard
          label="Efectividad media"
          value={stats.avgEff != null ? stats.avgEff.toFixed(1) : '—'}
          hint={`sobre 5.0 · ${stats.effValsCount} valoraciones`}
          valueClass={stats.avgEff == null ? '' : stats.avgEff >= 3.5 ? 'text-emerald-600 dark:text-emerald-400' : stats.avgEff >= 2.5 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}
        />
      </div>

      {/* Tendencia */}
      <Card title="Tendencia" icon={<TrendingUp className="w-3.5 h-3.5" />}>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={stats.trendData} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TEAL} stopOpacity={0.5} />
                <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 12, padding: '6px 10px' }} labelStyle={{ fontWeight: 600 }} />
            <Area type="monotone" dataKey="count" stroke={TEAL} strokeWidth={2} fill="url(#grad)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Heatmap */}
      <Card title="Patrones · Día × franja horaria" icon={<CalendarIcon className="w-3.5 h-3.5" />}>
        <Heatmap data={stats.heatmap} max={stats.heatmapMax} />
      </Card>

      {/* Conductas + Contexto */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Conductas más frecuentes" icon={<AlertTriangle className="w-3.5 h-3.5 text-rose-500" />} className="lg:col-span-2">
          <div className="space-y-2">
            {stats.behaviorRanking.map((b) => (
              <ProgressBar key={b.name} label={b.name} count={b.count} max={stats.maxBehavior} color="rose" />
            ))}
          </div>
        </Card>

        <Card title="Contexto">
          {stats.contextData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={stats.contextData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={2}>
                  {stats.contextData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyHint />}
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {stats.contextData.map((c, i) => (
              <div key={c.name} className="flex items-center gap-1 text-[10px] text-zinc-500">
                <span className="w-2 h-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                {c.name} ({c.value})
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Hipótesis + Efectividad */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="¿Por qué? · Hipótesis registradas">
          <div className="space-y-2">
            {stats.reasonRanking.map((r) => {
              const maxReason = stats.reasonRanking[0]?.count || 1;
              return <ProgressBar key={r.name} label={r.name} count={r.count} max={maxReason} color="teal" />;
            })}
          </div>
        </Card>

        <Card title="Distribución de efectividad">
          {stats.effValsCount > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={stats.effBuckets} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
                  <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 12 }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {stats.effBuckets.map((_, i) => (
                      <Cell key={i} fill={i < 2 ? '#fb7185' : i < 3 ? '#fbbf24' : '#10b981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-[10px] text-zinc-400 text-center mt-1">Rangos de puntuación · {stats.effValsCount} valoraciones</p>
            </>
          ) : <EmptyHint />}
        </Card>
      </div>

      {/* Día semana + Franja horaria */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Por día de la semana">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats.weekdayData} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
              <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 12 }} />
              <Bar dataKey="count" fill={TEAL} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Por franja horaria">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats.slotData} margin={{ top: 8, right: 8, left: -28, bottom: 24 }}>
              <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#a1a1aa' }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={50} interval={0} />
              <YAxis tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 12 }} />
              <Bar dataKey="count" fill="#0891b2" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Personas presentes */}
      <Card title="Personas presentes durante el incidente">
        {stats.peopleData.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {stats.peopleData.map((p) => (
              <ProgressBar
                key={p.name}
                label={p.name}
                count={p.count}
                max={stats.peopleData[0].count}
                color="zinc"
              />
            ))}
          </div>
        ) : <EmptyHint />}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function KpiCard({ label, value, hint, accent, valueClass }: {
  label: string; value: string | number; hint?: string; accent?: boolean; valueClass?: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${
      accent
        ? 'bg-gradient-to-br from-teal-500 to-cyan-600 text-white border-transparent'
        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
    }`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest ${accent ? 'text-teal-100/80' : 'text-zinc-400 dark:text-zinc-500'}`}>
        {label}
      </p>
      <p className={`text-3xl font-bold tabular-nums mt-1.5 ${accent ? 'text-white' : valueClass ?? 'text-zinc-900 dark:text-zinc-100'}`}>
        {value}
      </p>
      {hint && (
        <p className={`text-[10px] mt-1 ${accent ? 'text-teal-100/80' : 'text-zinc-400 dark:text-zinc-500'}`}>
          {hint}
        </p>
      )}
    </div>
  );
}

function Card({ title, icon, children, className = '' }: {
  title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 ${className}`}>
      <div className="flex items-center gap-1.5 mb-3">
        {icon}
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ProgressBar({ label, count, max, color }: {
  label: string; count: number; max: number; color: 'rose' | 'teal' | 'zinc';
}) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  const colors = {
    rose: 'bg-rose-500 dark:bg-rose-600',
    teal: 'bg-teal-500 dark:bg-teal-600',
    zinc: 'bg-zinc-400 dark:bg-zinc-500',
  };
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-700 dark:text-zinc-300 w-32 sm:w-40 truncate shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colors[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums w-8 text-right">
        {count}
      </span>
    </div>
  );
}

function Heatmap({ data, max }: { data: { day: number; slot: string; count: number }[]; max: number }) {
  const days = [1, 2, 3, 4, 5];

  function intensityClass(c: number): string {
    if (c === 0) return 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-300 dark:text-zinc-600';
    const r = c / max;
    if (r < 0.2) return 'bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400';
    if (r < 0.4) return 'bg-teal-200 dark:bg-teal-900/70 text-teal-800 dark:text-teal-300';
    if (r < 0.6) return 'bg-teal-300 dark:bg-teal-800 text-teal-900 dark:text-teal-100';
    if (r < 0.8) return 'bg-teal-400 dark:bg-teal-700 text-white';
    return 'bg-teal-600 dark:bg-teal-500 text-white';
  }

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="text-xs w-full min-w-[480px]">
        <thead>
          <tr>
            <th className="w-12"></th>
            {TIME_SLOTS.map((s) => (
              <th key={s.value} className="font-medium text-[10px] text-zinc-400 dark:text-zinc-500 px-1 pb-1.5 text-center">
                {s.label.split(' ').slice(0, 2).join(' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d}>
              <td className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 pr-2 text-right">
                {WEEKDAY_NAMES[d]}
              </td>
              {TIME_SLOTS.map((s) => {
                const cell = data.find((x) => x.day === d && x.slot === s.value);
                const count = cell?.count ?? 0;
                return (
                  <td key={s.value} className="p-0.5">
                    <div
                      className={`rounded-md h-9 flex items-center justify-center text-[11px] font-semibold tabular-nums ${intensityClass(count)}`}
                      title={`${WEEKDAY_NAMES[d]} · ${s.label}: ${count}`}
                    >
                      {count > 0 ? count : ''}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-zinc-400 dark:text-zinc-500 justify-end">
        <span>Menos</span>
        <span className="w-3 h-3 rounded-sm bg-zinc-100 dark:bg-zinc-800" />
        <span className="w-3 h-3 rounded-sm bg-teal-100 dark:bg-teal-900/60" />
        <span className="w-3 h-3 rounded-sm bg-teal-300 dark:bg-teal-800" />
        <span className="w-3 h-3 rounded-sm bg-teal-500 dark:bg-teal-600" />
        <span className="w-3 h-3 rounded-sm bg-teal-700 dark:bg-teal-500" />
        <span>Más</span>
      </div>
    </div>
  );
}

function EmptyHint() {
  return <p className="text-xs text-zinc-400 dark:text-zinc-500 italic text-center py-6">Sin datos suficientes</p>;
}
