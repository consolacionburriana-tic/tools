import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, ChevronLeft, Upload } from 'lucide-react';

import { getSessionUser } from '@/lib/auth-guards';
import { canAccess, puedeEditarHorarios } from '@/lib/permissions';
import { NavPending } from '@/components/ui/nav-pending';

export default async function HorariosLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'horarios')) redirect('/gestion/sin-acceso');
  const puedeEditar = puedeEditarHorarios(user.role);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/gestion/horarios" className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <CalendarDays className="h-4 w-4 text-indigo-500" />
            Horarios
            <NavPending />
          </Link>
          <div className="flex items-center gap-2">
            {puedeEditar && (
              <Link
                href="/gestion/horarios/importar"
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
              >
                <Upload className="h-4 w-4" /> <span className="hidden sm:inline">Importar</span>
              </Link>
            )}
            <Link
              href="/gestion"
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Escritorio</span>
            </Link>
          </div>
        </div>
      </header>
      <main className="container mx-auto max-w-6xl px-4 py-5">{children}</main>
    </div>
  );
}
