export const dynamic = 'force-dynamic';

import { db } from '@/db';
import { students, eduStudents, eduTeachers, teachers, behaviorReports } from '@/db/schema';
import { eq, count, desc, gte } from 'drizzle-orm';
import { claseDeAlumno, siglasDeAlumno } from '@/lib/abc';
import { nombreProfe } from '@/lib/profes';
import { format, subDays } from 'date-fns';
import { Users, GraduationCap, FileText, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Cifra, Cifras } from '@/components/ui/cifra';
import { Rotulo } from '@/components/ui/rotulo';
import { Vacio } from '@/components/ui/vacio';
import { UltimosRegistros } from '@/components/registro-abc/ultimos-registros';
import type { FichaRegistroData } from '@/components/registro-abc/ficha-registro';

export const metadata = {
  title: 'Registro ABC · Tools Consolación',
};

export default async function AdminPage() {
  const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');

  const [[{ totalStudents }], [{ totalTeachers }], [{ totalReports }], [{ weeklyReports }], recentReports] =
    await Promise.all([
      db.select({ totalStudents: count() }).from(students).where(eq(students.active, true)),
      db.select({ totalTeachers: count() }).from(eduTeachers).where(eq(eduTeachers.etapa, 'ESO')),
      db.select({ totalReports: count() }).from(behaviorReports),
      db.select({ weeklyReports: count() }).from(behaviorReports).where(gte(behaviorReports.reportDate, weekAgo)),
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
        .orderBy(desc(behaviorReports.createdAt))
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
      label: 'Total registros',
      value: totalReports,
      icon: FileText,
      href: '/gestion/abc/registros',
    },
    {
      label: 'Registros esta semana',
      value: weeklyReports,
      icon: TrendingUp,
      href: '/gestion/abc/registros',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Panel del Registro ABC</h1>

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
          <Vacio titulo="Sin registros todavía." />
        ) : (
          <UltimosRegistros fichas={fichas} />
        )}
      </section>
    </div>
  );
}
