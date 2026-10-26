export const dynamic = 'force-dynamic';

import { db } from '@/db';
import { students, eduStudents, eduTeachers, teachers, behaviorReports } from '@/db/schema';
import { and, count, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { PERIODOS, claseDeAlumno, periodoValido, rangoDePeriodo, siglasDeAlumno } from '@/lib/abc';
import { getAbcStudentsPanel } from '@/lib/abc-server';
import { nombreProfe } from '@/lib/profes';
import { format, subDays } from 'date-fns';
import { Users, GraduationCap, FileText, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Cifra, Cifras } from '@/components/ui/cifra';
import { Rotulo } from '@/components/ui/rotulo';
import { Vacio } from '@/components/ui/vacio';
import { UltimosRegistros } from '@/components/registro-abc/ultimos-registros';
import { PanelFiltros } from '@/components/registro-abc/panel-filtros';
import type { FichaRegistroData } from '@/components/registro-abc/ficha-registro';

export const metadata = {
  title: 'Registro ABC · Tools Consolación',
};

// Los filtros llegan por la URL (`?periodo=30&alumnos=id1,id2`); sin nada, el curso en vigor y todo el alumnado.
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; alumnos?: string }>;
}) {
  const { periodo: periodoUrl, alumnos: alumnosUrl } = await searchParams;
  const periodo = periodoValido(periodoUrl);
  const alumnado = await getAbcStudentsPanel();
  // Solo cuentan los alumnos que existen: un id inventado en la URL no filtra nada.
  const alumnoIds = (alumnosUrl ?? '').split(',').filter((id) => alumnado.some((a) => a.id === id));

  const rango = rangoDePeriodo(periodo);
  const filtroAlumno = alumnoIds.length > 0 ? inArray(behaviorReports.studentId, alumnoIds) : undefined;
  const filtroPeriodo = rango
    ? and(gte(behaviorReports.reportDate, format(rango.from, 'yyyy-MM-dd')), lte(behaviorReports.reportDate, format(rango.to, 'yyyy-MM-dd')))
    : undefined;
  const filtros = and(filtroPeriodo, filtroAlumno);
  const weekAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd');

  const [[{ totalStudents }], [{ totalTeachers }], [{ totalReports }], [{ weeklyReports }], recentReports] =
    await Promise.all([
      db.select({ totalStudents: count() }).from(students).where(eq(students.active, true)),
      db.select({ totalTeachers: count() }).from(eduTeachers).where(eq(eduTeachers.etapa, 'ESO')),
      db.select({ totalReports: count() }).from(behaviorReports).where(filtros),
      db.select({ weeklyReports: count() }).from(behaviorReports).where(and(gte(behaviorReports.reportDate, weekAgo), filtroAlumno)),
      db
        .select({
          report: behaviorReports,
          studentSiglas: students.siglas,
          eduNombre: eduStudents.nombre,
          eduApellido1: eduStudents.apellido1,
          eduCurso: eduStudents.curso,
          eduLetra: eduStudents.letra,
          claseLegada: students.className,
          teacherNombre: eduTeachers.nombre,
          teacherApellido1: eduTeachers.apellido1,
          teacherApellido2: eduTeachers.apellido2,
          teacherNombreMostrado: eduTeachers.nombreMostrado,
          legadoNombre: teachers.firstName,
          legadoApellido: teachers.lastName,
        })
        .from(behaviorReports)
        .leftJoin(students, eq(behaviorReports.studentId, students.id))
        .leftJoin(eduStudents, eq(students.eduStudentId, eduStudents.id))
        .leftJoin(eduTeachers, eq(behaviorReports.eduTeacherId, eduTeachers.id))
        .leftJoin(teachers, eq(behaviorReports.teacherId, teachers.id))
        .where(filtros)
        .orderBy(desc(behaviorReports.reportDate), desc(behaviorReports.createdAt))
        .limit(10),
    ]);

  const fichas: FichaRegistroData[] = recentReports.map((r) => {
    const { report } = r;
    return {
      id: report.id,
      siglas: r.studentSiglas ?? siglasDeAlumno(r.eduNombre, r.eduApellido1),
      clase: r.eduCurso ? claseDeAlumno(r.eduCurso, r.eduLetra) : (r.claseLegada ?? ''),
      reportDate: report.reportDate,
      registradoPor: r.teacherNombre
        ? nombreProfe({
            nombre: r.teacherNombre,
            apellido1: r.teacherApellido1,
            apellido2: r.teacherApellido2,
            nombreMostrado: r.teacherNombreMostrado,
          })
        : r.legadoNombre
          ? `${r.legadoNombre} ${r.legadoApellido ?? ''}`.trim()
          : (report.otherTeacherName ?? 'Desconocido'),
      context: report.context,
      contextNote: report.contextNote,
      timeSlot: report.timeSlot,
      presentPeople: (report.presentPeople as string[]) ?? [],
      presentNames: report.presentNames,
      behaviors: (report.behaviors as string[]) ?? [],
      involvedWith: report.involvedWith,
      situationDescription: report.situationDescription,
      antecedents: report.antecedents,
      consequences: report.consequences,
      redirectActions: report.redirectActions,
      reasons: (report.reasons as string[]) ?? [],
      reasonOther: report.reasonOther,
      effectivenessRating: report.effectivenessRating,
      comments: report.comments,
      createdAt: report.createdAt.toISOString(),
    };
  });

  const cards = [
    {
      label: 'Alumnos activos',
      value: totalStudents,
      icon: GraduationCap,
      href: '/gestion/abc/alumnos',
    },
    {
      label: 'Profes de secundaria',
      value: totalTeachers,
      icon: Users,
      href: '/gestion/profes',
    },
    {
      label: `Registros · ${PERIODOS.find((p) => p.value === periodo)?.label.toLowerCase()}`,
      value: totalReports,
      icon: FileText,
      href: '/gestion/abc/registros',
    },
    {
      label: 'Últimos 7 días',
      value: weeklyReports,
      icon: TrendingUp,
      href: '/gestion/abc/registros',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Panel del Registro ABC</h1>

      <PanelFiltros
        periodo={periodo}
        alumnoIds={alumnoIds}
        alumnos={alumnado.map((a) => ({ id: a.id, siglas: a.siglas, clase: a.clase }))}
      />

      <Cifras>
        {cards.map((card) => (
          <Cifra
            key={card.label}
            etiqueta={card.label}
            valor={card.value}
            icono={<card.icon aria-hidden />}
            href={card.href}
          />
        ))}
      </Cifras>

      {/* Últimos registros */}
      <section className="space-y-3">
        <Rotulo
          accion={
            <Link href="/gestion/abc/registros" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              Ver todos
            </Link>
          }
        >
          Últimos registros
        </Rotulo>
        {fichas.length === 0 ? (
          <Vacio titulo={periodo === 'all' && alumnoIds.length === 0 ? 'Sin registros todavía.' : 'Sin registros con estos filtros.'} />
        ) : (
          <UltimosRegistros fichas={fichas} />
        )}
      </section>
    </div>
  );
}
