import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { PacksEditor } from '@/components/licencias/packs-editor';

export const metadata = { title: 'Packs / itinerarios · Licencias' };

export default function PacksPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="font-semibold text-zinc-900 dark:text-zinc-100">Packs / itinerarios</h1>
            <p className="text-xs text-zinc-500">Agrupan las licencias para guiar a las familias</p>
          </div>
          <Link
            href="/gestion"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <ChevronLeft className="h-4 w-4" /> Panel
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <PacksEditor />
      </main>
    </div>
  );
}
