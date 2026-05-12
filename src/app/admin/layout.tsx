// TODO: añadir auth con Clerk antes de exponer públicamente
import Link from 'next/link';
import { LayoutDashboard, Users, GraduationCap, FileText, ClipboardList } from 'lucide-react';

const globalNav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/profesores', label: 'Profesores', icon: Users, note: 'Recurso global' },
];

const toolsNav = [
  {
    tool: 'Registro ABC',
    icon: ClipboardList,
    items: [
      { href: '/admin/alumnos', label: 'Alumnos', icon: GraduationCap },
      { href: '/admin/registros', label: 'Registros', icon: FileText },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-center">
        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
          ⚠️ Sin autenticación — añadir Clerk (Fase 2) antes de producción
        </p>
      </div>

      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="container max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
            Tools Consolación
          </Link>
          <span className="text-zinc-300 dark:text-zinc-600">/</span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Administración</span>
        </div>
      </header>

      <div className="container max-w-6xl mx-auto px-4 py-6 flex gap-6">
        {/* Navegación lateral */}
        <nav className="hidden md:flex flex-col gap-0.5 w-52 shrink-0">
          {/* Sección global */}
          {globalNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.note && (
                <span className="text-[10px] text-zinc-400 dark:text-zinc-600">{item.note}</span>
              )}
            </Link>
          ))}

          {/* Sección por tool */}
          <div className="mt-4 mb-1 px-3">
            <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">
              Tools
            </p>
          </div>
          {toolsNav.map((toolSection) => (
            <div key={toolSection.tool} className="space-y-0.5">
              <div className="flex items-center gap-2 px-3 py-1.5">
                <toolSection.icon className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {toolSection.tool}
                </span>
              </div>
              {toolSection.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2.5 pl-8 pr-3 py-2 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
