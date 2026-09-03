// Tarjetas del escritorio de administración. Separadas de la página porque la página ya
// tiene bastante con resolver permisos y stats, y porque así se pueden mirar de un vistazo
// (y capturar) sin necesitar sesión ni base de datos.
import Link from 'next/link';
import { BarChart3, BookMarked, Plus } from 'lucide-react';
import { NavPending } from '@/components/ui/nav-pending';

export function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}

export function ModuleCard({
  href,
  icon,
  title,
  desc,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:border-blue-300 active:border-blue-400 active:bg-blue-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-700 dark:active:border-blue-600 dark:active:bg-blue-500/5"
    >
      <span className="mt-0.5 text-blue-600 dark:text-blue-400">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
          {title}
          {badge && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
              {badge}
            </span>
          )}
        </span>
        <span className="block text-xs text-zinc-500">{desc}</span>
      </span>
      {/* Cuál de las tarjetas está cargando (los paneles son force-dynamic) */}
      <NavPending className="mt-0.5" />
    </Link>
  );
}

/**
 * Tarjeta de una herramienta con DOS entradas: el formulario (lo que usa todo el
 * claustro) y su panel de gestión. Van así, en dos columnas, porque Puntualidad y ABC
 * son las dos cosas que se abren a diario y conviene tenerlas de un toque.
 */
export function ToolDoble({
  icon,
  title,
  desc,
  registrar,
  registrarLabel,
  panel,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  registrar: string;
  registrarLabel: string;
  panel?: string;
  /** Acento del módulo: naranja Puntualidad, teal ABC (los mismos de sus pantallas). */
  color: 'naranja' | 'teal';
}) {
  const acento =
    color === 'naranja'
      ? { texto: 'text-orange-600 dark:text-orange-400', boton: 'bg-orange-500 hover:bg-orange-600' }
      : { texto: 'text-teal-600 dark:text-teal-400', boton: 'bg-teal-600 hover:bg-teal-700' };
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 ${acento.texto}`}>{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-zinc-900 dark:text-zinc-100">{title}</span>
          <span className="block text-xs text-zinc-500">{desc}</span>
        </span>
      </div>
      <div className="mt-auto flex gap-2">
        {/* Un icono en cada botón: el `+` dice "vas a crear algo" y el gráfico, "vas a
            mirar datos". Con dos botones pegados, el icono se lee antes que el texto. */}
        <Link
          href={registrar}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition-colors ${acento.boton}`}
        >
          <Plus className="h-4 w-4 shrink-0" />
          {registrarLabel}
          <NavPending />
        </Link>
        {panel && (
          <Link
            href={panel}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <BarChart3 className="h-4 w-4 shrink-0" />
            Panel
            <NavPending />
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * Licencias en junio y septiembre: arriba del todo y con cuerpo de titular. Sin chip del
 * mes — el sitio que ocupa ya dice que es su temporada; el chip solo era ruido.
 */
export function LicenciasDestacada() {
  return (
    <Link
      href="/gestion/licencias"
      className="flex items-center gap-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-5 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-blue-900/60 dark:bg-blue-500/10 dark:hover:border-blue-700"
    >
      <BookMarked className="h-8 w-8 shrink-0 text-blue-600 dark:text-blue-400" />
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold text-zinc-900 dark:text-zinc-100">Licencias digitales</span>
        <span className="block text-sm text-zinc-600 dark:text-zinc-300">
          Pedidos, quién falta, packs, exportaciones y correos a familias
        </span>
      </span>
      <NavPending className="mt-1" />
    </Link>
  );
}

export function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-1.5 px-1 pt-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
      {children}
    </h2>
  );
}

