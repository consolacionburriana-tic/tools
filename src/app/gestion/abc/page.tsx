export const dynamic = 'force-dynamic';

import { db } from '@/db';
import { students, eduStudents, eduTeachers, behaviorReports } from '@/db/schema';
import { eq, count, desc, gte } from 'drizzle-orm';
import { siglasDeAlumno } from '@/lib/abc';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Users, GraduationCap, FileText, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Dashboard · Admin · Tools Consolación',
};

export default async function AdminPage() {
  const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');

  const [
    [{ totalStudents }],
    [{ totalTeachers }],
    [{ totalReports }],
    [{ weeklyReports }],
    recentReports,
  ] = await Promise.all([
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
        eduApellido2: eduStudents.apellido2,
        teacherFirstName: eduTeachers.nombre,
        teacherLastName: eduTeachers.apellido1,
      })
      .from(behaviorReports)
      .leftJoin(students, eq(behaviorReports.studentId, students.id))
      .leftJoin(eduStudents, eq(students.eduStudentId, eduStudents.id))
      .leftJoin(eduTeachers, eq(behaviorReports.eduTeacherId, eduTeachers.id))
      .orderBy(desc(behaviorReports.createdAt))
      .limit(10),
  ]);

  const cards = [
    { label: 'Alumnos activos', value: totalStudents, icon: GraduationCap, href: '/gestion/abc/alumnos' },
    { label: 'Profes de secundaria', value: totalTeachers, icon: Users, href: '/gestion/profes' },
    { label: 'Total registros', value: totalReports, icon: FileText, href: '/gestion/abc/registros' },
    { label: 'Registros esta semana', value: weeklyReports, icon: TrendingUp, href: '/gestion/abc/registros' },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Dashboard</h1>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-teal-300 dark:hover:border-teal-700 transition-colors space-y-3"
          >
            <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
              <card.icon className="w-4 h-4" />
              <span className="text-xs font-medium">{card.label}</span>
            </div>
            <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{card.value}</p>
          </Link>
        ))}
      </div>

      {/* Últimos registros */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Últimos registros</h2>
          <Link href="/gestion/abc/registros" className="text-sm text-teal-600 dark:text-teal-400 hover:underline">
            Ver todos →
          </Link>
        </div>
        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
          {recentReports.length === 0 && (
            <p className="p-6 text-sm text-zinc-400 dark:text-zinc-500 text-center">Sin registros todavía.</p>
          )}
          {recentReports.map((r) => {
            const behaviors = Array.isArray(r.behaviors) ? (r.behaviors as string[]) : [];
            return (
              <div key={r.id} className="px-5 py-3.5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">
                      {r.studentSiglas ?? siglasDeAlumno(r.eduNombre, r.eduApellido1, r.eduApellido2)}
                    </span>
                    {behaviors.slice(0, 2).map((b) => (
                      <span
                        key={b}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800"
                      >
                        {b.replace(/_/g, ' ')}
                      </span>
                    ))}
                    {behaviors.length > 2 && (
                      <span className="text-[10px] text-zinc-400">+{behaviors.length - 2}</span>
                    )}
                  </div>
                  {r.teacherFirstName && (
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                      {r.teacherFirstName} {r.teacherLastName}
                    </p>
                  )}
                </div>
                <time className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0">
                  {format(new Date(r.reportDate), "d MMM", { locale: es })}
                </time>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
