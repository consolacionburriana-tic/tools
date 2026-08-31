export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Clock, MapPin, Users as UsersIcon, AlertTriangle, Lightbulb, Sparkles } from 'lucide-react';
import { db } from '@/db';
import { behaviorReports, eduStudents, eduTeachers, students, teachers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { claseDeAlumno, siglasDeAlumno } from '@/lib/abc';
import {
  BEHAVIORS, CONTEXTS, TIME_SLOTS, PRESENT_PEOPLE, REASONS,
  STAGE_LABELS, type StageValue,
} from '@/lib/constants';
import { DeleteReportButton } from './delete-button';

function label<T extends { value: string; label: string }>(arr: readonly T[], val: string): string {
  return arr.find((x) => x.value === val)?.label ?? val;
}

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [row] = await db
    .select({
      report: behaviorReports,
      student: students,
      eduStudent: eduStudents,
      teacher: teachers,
      eduTeacher: eduTeachers,
    })
    .from(behaviorReports)
    .leftJoin(students, eq(behaviorReports.studentId, students.id))
    .leftJoin(eduStudents, eq(students.eduStudentId, eduStudents.id))
    .leftJoin(teachers, eq(behaviorReports.teacherId, teachers.id))
    .leftJoin(eduTeachers, eq(behaviorReports.eduTeacherId, eduTeachers.id))
    .where(eq(behaviorReports.id, id))
    .limit(1);

  if (!row) notFound();

  const { report, student, eduStudent, teacher, eduTeacher } = row;
  // En pantalla, solo siglas + clase: el nombre del alumno vive en la BBDD central.
  const siglas = student?.siglas ?? siglasDeAlumno(eduStudent?.nombre, eduStudent?.apellido1);
  const clase = eduStudent ? claseDeAlumno(eduStudent.curso, eduStudent.letra) : (student?.className ?? '');
  const behaviors = (report.behaviors as string[]) ?? [];
  const presentPeople = (report.presentPeople as string[]) ?? [];
  const reasons = (report.reasons as string[]) ?? [];
  const dateObj = parseISO(report.reportDate);
  const teacherName = eduTeacher
    ? [eduTeacher.nombre, eduTeacher.apellido1, eduTeacher.apellido2].filter(Boolean).join(' ')
    : teacher
      ? `${teacher.firstName} ${teacher.lastName}`
      : (report.otherTeacherName ?? 'Desconocido');

  const eff = report.effectivenessRating ? parseFloat(report.effectivenessRating) : null;
  const effColor = eff == null
    ? 'text-zinc-400'
    : eff < 2.5 ? 'text-rose-600 dark:text-rose-400'
    : eff < 3.5 ? 'text-amber-600 dark:text-amber-400'
    : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div className="space-y-5">
      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link
          href="/gestion/abc/registros"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Registros
        </Link>
        <DeleteReportButton id={report.id} />
      </div>

      {/* ── Hero header ───────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 dark:from-teal-600 dark:to-cyan-700 text-white p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-xl font-bold shrink-0">
            {siglas.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-widest text-teal-100/80">Registro ABC</p>
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
              {siglas}
            </h1>
            <p className="text-sm text-teal-50/90 mt-0.5">
              {clase}
            </p>
          </div>

          {/* Fecha */}
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-teal-100/80">Fecha</p>
            <p className="text-base font-semibold capitalize">
              {format(dateObj, "EEE d MMM yyyy", { locale: es })}
            </p>
          </div>
        </div>
      </div>

      {/* ── Metadata row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetaCard
          icon={<UsersIcon className="w-4 h-4" />}
          label="Registrado por"
          value={teacherName}
          sub={teacher ? STAGE_LABELS[teacher.stage as StageValue] : null}
        />
        <MetaCard
          icon={<MapPin className="w-4 h-4" />}
          label="Dónde"
          value={label(CONTEXTS, report.context)}
          sub={report.contextNote ?? null}
        />
        <MetaCard
          icon={<Clock className="w-4 h-4" />}
          label="Cuándo"
          value={label(TIME_SLOTS, report.timeSlot)}
          sub={format(dateObj, 'EEEE', { locale: es })}
        />
        <MetaCard
          icon={<Sparkles className="w-4 h-4" />}
          label="Efectividad"
          value={eff !== null ? `${eff.toFixed(1)} / 5` : '—'}
          sub={eff !== null ? (eff < 2.5 ? 'Baja' : eff < 3.5 ? 'Media' : 'Alta') : 'Sin valorar'}
          valueClass={effColor}
        />
      </div>

      {/* ── Conductas (hero secundario) ───────────────────────────────── */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-rose-100 dark:border-rose-900/30 overflow-hidden">
        <div className="bg-gradient-to-r from-rose-50 to-rose-50/40 dark:from-rose-950/40 dark:to-rose-950/10 border-b border-rose-100 dark:border-rose-900/30 px-5 py-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-rose-700 dark:text-rose-400">
            Conductas observadas
          </h2>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            {behaviors.map((b) => (
              <span
                key={b}
                className="text-sm font-medium px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
              >
                {label(BEHAVIORS, b)}
              </span>
            ))}
          </div>
          {report.involvedWith && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 pt-1">
              <span className="text-zinc-400 dark:text-zinc-500">Producido con: </span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{report.involvedWith}</span>
            </p>
          )}
          {presentPeople.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-zinc-100 dark:border-zinc-800 mt-3 pt-3">
              <span className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Presentes:</span>
              {presentPeople.map((p) => (
                <span
                  key={p}
                  className="text-xs px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                >
                  {label(PRESENT_PEOPLE, p)}
                </span>
              ))}
              {report.presentNames && (
                <span className="text-xs italic text-zinc-500 dark:text-zinc-400">
                  ({report.presentNames})
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Grid A-B-C ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <AbcPanel
          letter="A"
          title="Antecedentes"
          content={report.antecedents}
          hint="¿Qué pasó antes?"
        />
        <AbcPanel
          letter="B"
          title="Conducta"
          content={behaviors.map((b) => label(BEHAVIORS, b)).join(' · ')}
          hint={report.involvedWith ? `Con: ${report.involvedWith}` : '¿Qué hizo?'}
          accent
        />
        <AbcPanel
          letter="C"
          title="Consecuencias"
          content={report.consequences}
          hint="¿Qué pasó después?"
        />
      </div>

      {/* ── Hipótesis + Reconducción ──────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-teal-500" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              Hipótesis · ¿Por qué?
            </h3>
          </div>
          {reasons.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {reasons.map((r) => (
                  <span
                    key={r}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60"
                  >
                    {label(REASONS, r)}
                  </span>
                ))}
              </div>
              {report.reasonOther && (
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 italic">
                  &ldquo;{report.reasonOther}&rdquo;
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">Sin hipótesis registradas</p>
          )}
        </div>

        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">
            Acciones de reconducción
          </h3>
          {report.redirectActions ? (
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {report.redirectActions}
            </p>
          ) : (
            <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">No registradas</p>
          )}
        </div>
      </div>

      {/* ── Comentarios ───────────────────────────────────────────────── */}
      {report.comments && (
        <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">
            Comentarios
          </p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed italic">
            &ldquo;{report.comments}&rdquo;
          </p>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 text-center pt-2">
        Registrado el {format(report.createdAt, "d MMM yyyy 'a las' HH:mm", { locale: es })} · ID {report.id.slice(0, 8)}
      </p>
    </div>
  );
}

function MetaCard({
  icon, label, value, sub, valueClass,
}: { icon: React.ReactNode; label: string; value: string; sub?: string | null; valueClass?: string }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4">
      <div className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500 mb-1.5">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <p className={`text-base font-semibold leading-tight ${valueClass ?? 'text-zinc-900 dark:text-zinc-100'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function AbcPanel({
  letter, title, content, hint, accent = false,
}: { letter: string; title: string; content: string | null; hint: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 min-h-[140px] flex flex-col ${
      accent
        ? 'bg-teal-50/50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900/50'
        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
    }`}>
      <div className="flex items-baseline gap-2 mb-2">
        <span className={`text-3xl font-bold leading-none ${
          accent ? 'text-teal-600 dark:text-teal-400' : 'text-zinc-300 dark:text-zinc-600'
        }`}>
          {letter}
        </span>
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          {title}
        </span>
      </div>
      {content ? (
        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed flex-1">{content}</p>
      ) : (
        <p className="text-sm text-zinc-400 dark:text-zinc-500 italic flex-1">{hint} (no registrado)</p>
      )}
    </div>
  );
}
