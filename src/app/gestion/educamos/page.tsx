export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ChevronLeft, ChevronRight, Database, GraduationCap, Users } from 'lucide-react';
import { count, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { eduStudents, eduSyncRuns, eduTeachers } from '@/db/schema';
import { ProfesImport } from '@/components/educamos/profes-import';

export const metadata = { title: 'BBDD central · Educamos' };

export default async function EducamosPage() {
  const [[alumnos], [profes], [ultimoSync]] = await Promise.all([
    db.select({ n: count() }).from(eduStudents).where(eq(eduStudents.active, true)),
    db.select({ n: count() }).from(eduTeachers).where(eq(eduTeachers.active, true)),
    db.select().from(eduSyncRuns).orderBy(desc(eduSyncRuns.createdAt)).limit(1),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="font-semibold text-zinc-900 dark:text-zinc-100">BBDD central (Educamos)</h1>
            <p className="text-xs text-zinc-500">Alumnado, tutores y profesorado que consumen todos los módulos</p>
          </div>
          <Link
            href="/gestion"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
          >
            <ChevronLeft className="h-4 w-4" /> Escritorio
          </Link>
        </div>
      </header>

      <main className="anim-stagger mx-auto max-w-2xl space-y-4 px-4 py-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs text-zinc-500">Alumnado activo</p>
            <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{alumnos.n}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs text-zinc-500">Profesorado activo</p>
            <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{profes.n}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs text-zinc-500">Último sync</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {ultimoSync ? new Date(ultimoSync.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—'}
            </p>
            {ultimoSync && <p className="text-xs text-zinc-500">{ultimoSync.filename}</p>}
          </div>
        </div>

        <Link
          href="/gestion/educamos/sincronizar"
          className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 hover:border-blue-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-700"
        >
          <span className="flex items-center gap-3">
            <GraduationCap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <span>
              <span className="block font-medium text-zinc-900 dark:text-zinc-100">Sincronizar alumnado</span>
              <span className="block text-xs text-zinc-500">Export de alumnos: vista previa con diff y conflictos antes de aplicar</span>
            </span>
          </span>
          <ChevronRight className="h-5 w-5 text-zinc-400" />
        </Link>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-3 flex items-center gap-3">
            <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <span>
              <span className="block font-medium text-zinc-900 dark:text-zinc-100">Importar profesorado</span>
              <span className="block text-xs text-zinc-500">Export de profesores: el ALIAS es el código; el correo del cole casa con el login</span>
            </span>
          </p>
          <ProfesImport />
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          <Database className="h-4 w-4" />
          Los ficheros se procesan en memoria y nunca se guardan. Los datos bancarios no se importan.
        </div>
      </main>
    </div>
  );
}
