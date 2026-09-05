export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, LayoutDashboard } from 'lucide-react';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { ensureSubjects } from '@/lib/puntualidad-server';
import { getTeacherByEmail } from '@/lib/educamos-server';
import { PuntualidadForm } from '@/components/puntualidad/puntualidad-form';

export const metadata = {
  title: 'Puntualidad · Consolación',
  description: 'Registro de retrasos de entrada',
};

// Detrás del login del claustro: registrar un retraso lo puede hacer cualquier profe
// (igual que el formulario del ABC). El panel de datos sí es del módulo `puntualidad`.
export default async function PuntualidadPage() {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login?volver=/puntualidad');

  const [asignaturas, profe] = await Promise.all([ensureSubjects(), getTeacherByEmail(user.email)]);
  const registradoPor = profe
    ? [profe.nombre, profe.apellido1].filter(Boolean).join(' ')
    : (user.nombre ?? user.email);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="container mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <div className="flex items-baseline gap-2">
            <Link href="/gestion" className="font-semibold text-zinc-900 hover:text-orange-600 dark:text-zinc-100 dark:hover:text-orange-400">
              Puntualidad
            </Link>
            <span className="text-xs text-zinc-400">límite 08:05</span>
          </div>
          <div className="flex items-center gap-1">
            {canAccess(user, 'puntualidad') && (
              <Link
                href="/gestion/puntualidad"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <LayoutDashboard className="h-4 w-4" /> Panel
              </Link>
            )}
            <Link
              href="/gestion"
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Escritorio</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-5">
        <PuntualidadForm
          asignaturas={asignaturas
            .filter((a) => a.active)
            .map((a) => ({ id: a.id, nombre: a.nombre, abreviatura: a.abreviatura }))}
          registradoPor={registradoPor}
        />
      </main>
    </div>
  );
}
