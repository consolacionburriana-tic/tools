export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, MapPin, Users as UsersIcon, AlertTriangle, Lightbulb, Sparkles } from 'lucide-react';
import { EnlaceVolver, TituloPagina } from '@/components/ui/cabecera-modulo';
import { Estado, type TonoEstado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Tarjeta, TarjetaCabecera, TarjetaCuerpo } from '@/components/ui/tarjeta';
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
  // La efectividad es un estado (baja, media, alta): va en la pastilla de `Estado`.
  const effTono: TonoEstado = eff == null ? 'neutro' : eff < 2.5 ? 'error' : eff < 3.5 ? 'aviso' : 'ok';

  return (
    <div className="space-y-5">
      <div>
        <EnlaceVolver href="/gestion/abc/registros">Registros</EnlaceVolver>
        <TituloPagina
          className="mt-1 mb-0"
          antes={<span className="capitalize">{format(dateObj, 'EEE d MMM yyyy', { locale: es })}</span>}
          descripcion={clase || undefined}
          acciones={<DeleteReportButton id={report.id} />}
        >
          {siglas}
        </TituloPagina>
      </div>

      {/* ── Metadata row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetaCard
          icon={<UsersIcon />}
          label="Registrado por"
          value={teacherName}
          sub={teacher ? STAGE_LABELS[teacher.stage as StageValue] : null}
        />
        <MetaCard
          icon={<MapPin />}
          label="Dónde"
          value={label(CONTEXTS, report.context)}
          sub={report.contextNote ?? null}
        />
        <MetaCard
          icon={<Clock />}
          label="Cuándo"
          value={label(TIME_SLOTS, report.timeSlot)}
          sub={format(dateObj, 'EEEE', { locale: es })}
        />
        <MetaCard
          icon={<Sparkles />}
          label="Efectividad"
          value={eff !== null ? `${eff.toFixed(1)} / 5` : '—'}
          sub={
            <Estado tono={effTono}>
              {eff !== null ? (eff < 2.5 ? 'Baja' : eff < 3.5 ? 'Media' : 'Alta') : 'Sin valorar'}
            </Estado>
          }
        />
      </div>

      {/* ── Conductas ─────────────────────────────────────────────────── */}
      <Tarjeta as="section">
        <TarjetaCabecera icono={<AlertTriangle />} titulo="Conductas observadas" />
        <TarjetaCuerpo className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {behaviors.map((b) => (
              <Etiqueta key={b} className="px-2.5 py-1 text-sm">
                {label(BEHAVIORS, b)}
              </Etiqueta>
            ))}
          </div>
          {report.involvedWith && (
            <p className="pt-1 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="text-zinc-500 dark:text-zinc-400">Producido con: </span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{report.involvedWith}</span>
            </p>
          )}
          {presentPeople.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <span className="text-xs tracking-widest text-zinc-500 uppercase dark:text-zinc-400">Presentes:</span>
              {presentPeople.map((p) => (
                <Etiqueta key={p}>{label(PRESENT_PEOPLE, p)}</Etiqueta>
              ))}
              {report.presentNames && (
                <span className="text-xs text-zinc-500 italic dark:text-zinc-400">({report.presentNames})</span>
              )}
            </div>
          )}
        </TarjetaCuerpo>
      </Tarjeta>

      {report.situationDescription && (
        <Tarjeta as="section">
          <TarjetaCabecera titulo="Situación problemática" />
          <TarjetaCuerpo>
            <p className="text-sm leading-relaxed whitespace-pre-line text-zinc-700 dark:text-zinc-300">
              {report.situationDescription}
            </p>
          </TarjetaCuerpo>
        </Tarjeta>
      )}

      {/* ── Grid A-B-C ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <AbcPanel letter="A" title="Antecedentes" content={report.antecedents} hint="¿Qué pasó antes?" />
        <AbcPanel
          letter="B"
          title="Conducta"
          content={behaviors.map((b) => label(BEHAVIORS, b)).join(' · ')}
          hint={report.involvedWith ? `Con: ${report.involvedWith}` : '¿Qué hizo?'}
        />
        <AbcPanel letter="C" title="Consecuencias aplicadas al alumno/a por su conducta" content={report.consequences} hint="Lo que se le aplicó" />
      </div>

      {/* ── Hipótesis + Reconducción ──────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Tarjeta as="section">
          <TarjetaCabecera icono={<Lightbulb />} titulo="Hipótesis · ¿Por qué?" />
          <TarjetaCuerpo>
            {reasons.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {reasons.map((r) => (
                    <Etiqueta key={r}>{label(REASONS, r)}</Etiqueta>
                  ))}
                </div>
                {report.reasonOther && (
                  <p className="mt-2 text-xs text-zinc-500 italic dark:text-zinc-400">&ldquo;{report.reasonOther}&rdquo;</p>
                )}
              </>
            ) : (
              <p className="text-sm text-zinc-500 italic dark:text-zinc-400">Sin hipótesis registradas</p>
            )}
          </TarjetaCuerpo>
        </Tarjeta>

        <Tarjeta as="section">
          <TarjetaCabecera titulo="Acciones de reconducción" />
          <TarjetaCuerpo>
            {report.redirectActions ? (
              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{report.redirectActions}</p>
            ) : (
              <p className="text-sm text-zinc-500 italic dark:text-zinc-400">No registradas</p>
            )}
          </TarjetaCuerpo>
        </Tarjeta>
      </div>

      {/* ── Comentarios ───────────────────────────────────────────────── */}
      {report.comments && (
        <Tarjeta as="section">
          <TarjetaCabecera titulo="Comentarios" />
          <TarjetaCuerpo>
            <p className="text-sm leading-relaxed text-zinc-700 italic dark:text-zinc-300">&ldquo;{report.comments}&rdquo;</p>
          </TarjetaCuerpo>
        </Tarjeta>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <p className="pt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
        Registrado el {format(report.createdAt, "d MMM yyyy 'a las' HH:mm", { locale: es })} · ID {report.id.slice(0, 8)}
      </p>
    </div>
  );
}

function MetaCard({
  icon, label, value, sub,
}: { icon: React.ReactNode; label: string; value: string; sub?: React.ReactNode }) {
  return (
    <Tarjeta className="p-4">
      <div className="mb-1.5 flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 [&_svg]:size-4">
        {icon}
        <span className="text-xs font-semibold tracking-wider uppercase">{label}</span>
      </div>
      <p className="text-base leading-tight font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
      {sub && <div className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">{sub}</div>}
    </Tarjeta>
  );
}

function AbcPanel({
  letter, title, content, hint,
}: { letter: string; title: string; content: string | null; hint: string }) {
  return (
    <Tarjeta as="section" className="flex min-h-[140px] flex-col p-5">
      <div className="mb-2 flex items-baseline gap-2">
        <span aria-hidden className="text-3xl leading-none font-bold text-zinc-300 dark:text-zinc-600">
          {letter}
        </span>
        <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">{title}</h2>
      </div>
      {content ? (
        <p className="flex-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{content}</p>
      ) : (
        <p className="flex-1 text-sm text-zinc-500 italic dark:text-zinc-400">{hint} (no registrado)</p>
      )}
    </Tarjeta>
  );
}
