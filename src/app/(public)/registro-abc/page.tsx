export const dynamic = 'force-dynamic';

import { db } from '@/db';
import { students, teachers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { RegistroForm } from '@/components/registro-abc/registro-form';

export const metadata = {
  title: 'Registro ABC · Consolación',
  description: 'Registro de conductas · Análisis A-B-C',
};

export default async function RegistroAbcPage() {
  const [activeStudents, activeTeachers] = await Promise.all([
    db.select().from(students).where(eq(students.active, true)),
    db.select().from(teachers).where(eq(teachers.active, true)),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Cabecera mínima de tool autónoma — sin navegación al hub */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800">
        <div className="container max-w-2xl mx-auto px-4 h-14 flex items-center">
          <h1 className="font-semibold text-zinc-900 dark:text-zinc-100">Registro ABC</h1>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6">
        <RegistroForm students={activeStudents} teachers={activeTeachers} />
      </main>
    </div>
  );
}
