export const dynamic = 'force-dynamic';

import { db } from '@/db';
import { students, eduStudents, eduTeachers, behaviorReports } from '@/db/schema';
import { eq, count, desc, gte } from 'drizzle-orm';
import { siglasDeAlumno } from '@/lib/abc';
import { nombreProfeBreve } from '@/lib/profes';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Users, GraduationCap, FileText, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Cifra, Cifras } from '@/components/ui/cifra';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Rotulo } from '@/components/ui/rotulo';
import { claseTarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';

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
          id: behaviorReports.id,
          reportDate: behaviorReports.reportDate,
          behaviors: behaviorReports.behaviors,
          studentSiglas: students.siglas,
          eduNombre: eduStudents.nombre,
          eduApellido1: eduStudents.apellido1,
          teacherFirstName: eduTeachers.nombre,
          teacherLastName: eduTeachers.apellido1,
          teacherNombreMostrado: eduTeachers.nombreMostrado,
        })
        .from(behaviorReports)
        .leftJoin(students, eq(behaviorReports.studentId, students.id))
        .leftJoin(eduStudents, eq(students.eduStudentId, eduStudents.id))
        .leftJoin(eduTeachers, eq(behaviorReports.eduTeacherId, eduTeachers.id))
        .orderBy(desc(behaviorReports.createdAt))
        .limit(10),
    ]);

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
        {recentReports.length === 0 ? (
          <Vacio titulo="Sin registros todavía." />
        ) : (
          <div className={`${claseTarjeta} divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800`}>
            {recentReports.map((r) => {
              const behaviors = Array.isArray(r.behaviors) ? (r.behaviors as string[]) : [];
              return (
                <div key={r.id} className="px-5 py-3.5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">
                        {r.studentSiglas ?? siglasDeAlumno(r.eduNombre, r.eduApellido1)}
                      </span>
                      {behaviors.slice(0, 2).map((b) => (
                        <Etiqueta key={b}>{b.replace(/_/g, ' ')}</Etiqueta>
                      ))}
                      {behaviors.length > 2 && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">+{behaviors.length - 2}</span>
                      )}
                    </div>
                    {r.teacherFirstName && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {nombreProfeBreve({
                          nombre: r.teacherFirstName,
                          apellido1: r.teacherLastName,
                          apellido2: null,
                          nombreMostrado: r.teacherNombreMostrado,
                        })}
                      </p>
                    )}
                  </div>
                  <time className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0 tabular-nums">
                    {format(new Date(r.reportDate), 'd MMM', { locale: es })}
                  </time>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
