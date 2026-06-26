import Link from 'next/link';
import { ChevronLeft, Wrench } from 'lucide-react';

export const metadata = {
  title: 'Administración · Licencias',
};

export default function AdminLicenciasPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 text-center dark:bg-zinc-950">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/15">
        <Wrench className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Panel de licencias</h1>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">
        El panel de gestión (login, dashboard, packs y exportaciones) llega en la Fase 2.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        <ChevronLeft className="h-4 w-4" /> Volver
      </Link>
    </div>
  );
}
