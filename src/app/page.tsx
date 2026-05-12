import Link from 'next/link';
import { ClipboardList, Lock, Settings } from 'lucide-react';

const tools = [
  {
    href: '/registro-abc',
    icon: ClipboardList,
    title: 'Registro ABC',
    description: 'Registro de conductas disruptivas · Análisis A-B-C',
    protected: false,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      {/* Banner de auth pendiente */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 text-center">
        <p className="text-sm text-amber-700 dark:text-amber-400">
          <Lock className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
          Acceso con autenticación pendiente de implementar · Fase 2 (Clerk)
        </p>
      </div>

      <main className="flex-1 container max-w-2xl mx-auto px-4 py-12 space-y-10">
        <header className="space-y-1.5">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Tools Consolación
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            Herramientas internas · Colegio Consolación Burriana
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
            Herramientas disponibles
          </h2>
          <div className="grid gap-3">
            {tools.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="group flex items-start gap-4 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-teal-300 dark:hover:border-teal-700 transition-colors duration-150"
              >
                <div className="mt-0.5 p-2.5 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 shrink-0">
                  <tool.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                      {tool.title}
                    </span>
                    <span className={[
                      'text-[10px] font-medium px-2 py-0.5 rounded-full',
                      tool.protected
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                        : 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
                    ].join(' ')}>
                      {tool.protected ? '🔒 Restringido' : 'Acceso libre'}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                    {tool.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <footer className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Panel de administración
          </Link>
        </footer>
      </main>
    </div>
  );
}
