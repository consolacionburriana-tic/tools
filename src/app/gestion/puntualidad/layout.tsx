import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarClock, ChevronLeft, ClipboardList, LayoutDashboard, ListChecks, Plus } from 'lucide-react';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess, vePuntualidadCompleta } from '@/lib/permissions';
import { NavPending } from '@/components/ui/nav-pending';

const nav = [
  { href: '/gestion/puntualidad', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/gestion/puntualidad/registros', label: 'Retrasos', icon: ClipboardList },
  { href: '/gestion/puntualidad/consecuencias', label: 'Consecuencias', icon: ListChecks },
  { href: '/gestion/puntualidad/asignaturas', label: 'Asignaturas', icon: CalendarClock },
];

export default async function PuntualidadLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'puntualidad')) redirect('/gestion/sin-acceso');

  // Un tutor ve el panel, pero solo con el alumnado de sus tutorías (el filtro real está
  // en las queries; aquí solo se avisa de que lo que ve es lo suyo).
  const completo = vePuntualidadCompleta(user.role);
  const visibles = completo ? nav : nav.filter((n) => !n.href.endsWith('/asignaturas'));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <Link href="/gestion" className="text-sm font-semibold text-zinc-900 hover:text-orange-600 dark:text-zinc-100 dark:hover:text-orange-400">
              Puntualidad
            </Link>
            <nav className="flex items-center gap-1">
              {visibles.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 active:bg-orange-50 active:text-orange-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:active:bg-orange-500/10 dark:active:text-orange-300"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">{item.label}</span>
                  <NavPending />
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/puntualidad"
              className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Registrar</span>
            </Link>
            <Link
              href="/gestion"
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Escritorio</span>
            </Link>
          </div>
        </div>
        {!completo && (
          <div className="border-t border-orange-100 bg-orange-50 px-4 py-1.5 text-center text-xs text-orange-700 dark:border-orange-900/40 dark:bg-orange-900/20 dark:text-orange-300">
            Ves solo el alumnado de las clases que tutorizas.
          </div>
        )}
      </header>
      <main className="container mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
