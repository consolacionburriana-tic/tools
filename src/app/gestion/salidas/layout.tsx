import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Bus, ChevronLeft, Plus } from 'lucide-react';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';

export default async function SalidasLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'salidas')) redirect('/gestion/sin-acceso');

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4">
          <Link href="/gestion" className="flex items-center gap-2 text-sm font-semibold text-zinc-900 hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400">
            <Bus className="h-5 w-5 text-blue-600 dark:text-blue-400" /> Salidas y pagos
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/gestion/salidas/nueva"
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> Nueva salida
            </Link>
            <Link
              href="/gestion"
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
            >
              <ChevronLeft className="h-4 w-4" /> Escritorio
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
