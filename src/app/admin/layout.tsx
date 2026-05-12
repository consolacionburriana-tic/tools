// TODO: añadir auth con Clerk antes de exponer públicamente
import Link from 'next/link';
import { LayoutDashboard, Users, GraduationCap, FileText } from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/profesores', label: 'Profesores', icon: Users },
  { href: '/admin/alumnos', label: 'Alumnos', icon: GraduationCap },
  { href: '/admin/registros', label: 'Registros', icon: FileText },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Banner de advertencia */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 text-center">
        <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
          ⚠️ Zona sin autenticar — añadir Clerk antes de producción
        </p>
      </div>

      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="container max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
          <Link href="/" className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
            Tools Consolación
          </Link>
          <span className="text-zinc-300 dark:text-zinc-600">/</span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Administración</span>
        </div>
      </header>

      <div className="container max-w-6xl mx-auto px-4 py-6 flex gap-6">
        <nav className="hidden md:flex flex-col gap-1 w-48 shrink-0">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
