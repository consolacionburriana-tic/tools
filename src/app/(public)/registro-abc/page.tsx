export const dynamic = 'force-dynamic';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/db';
import { students, teachers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { RegistroForm } from '@/components/registro-abc/registro-form';

export const metadata = {
  title: 'Registro ABC · Tools Consolación',
  description: 'Registrar conducta disruptiva',
};

export default async function RegistroAbcPage() {
  const [activeStudents, activeTeachers] = await Promise.all([
    db.select().from(students).where(eq(students.active, true)),
    db.select().from(teachers).where(eq(teachers.active, true)),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800">
        <div className="container max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            href="/"
            className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
            aria-label="Volver al inicio"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-semibold text-zinc-900 dark:text-zinc-100">Registro ABC</h1>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6">
        <RegistroForm students={activeStudents} teachers={activeTeachers} />
      </main>
    </div>
  );
}
