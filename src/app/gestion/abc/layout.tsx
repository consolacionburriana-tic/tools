import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft, FileText, GraduationCap, LayoutDashboard } from 'lucide-react';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { NavPending } from '@/components/ui/nav-pending';

const nav = [
  { href: '/gestion/abc', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/gestion/abc/registros', label: 'Registros', icon: FileText },
  { href: '/gestion/abc/alumnos', label: 'Alumnado', icon: GraduationCap },
];

export default async function AbcLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'abc')) redirect('/gestion/sin-acceso');

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <Link href="/gestion" className="text-sm font-semibold text-zinc-900 hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400">
              Registro ABC
            </Link>
            <nav className="flex items-center gap-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 active:bg-blue-50 active:text-blue-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:active:bg-blue-500/10 dark:active:text-blue-300"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">{item.label}</span>
                  <NavPending />
                </Link>
              ))}
            </nav>
          </div>
          <Link
            href="/gestion"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
          >
            <ChevronLeft className="h-4 w-4" /> Escritorio
          </Link>
        </div>
      </header>
      <main className="container mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
