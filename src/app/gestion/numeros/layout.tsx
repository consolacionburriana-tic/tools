import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';

export default async function NumerosLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'numeros')) redirect('/gestion/sin-acceso');

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 print:min-h-0 print:bg-white">
      <header className="sticky top-0 z-30 border-b print:hidden border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <Link
            href="/gestion/numeros"
            className="text-sm font-semibold text-zinc-900 hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400"
          >
            Números del cole
          </Link>
          <Link
            href="/gestion"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Escritorio</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-5 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
