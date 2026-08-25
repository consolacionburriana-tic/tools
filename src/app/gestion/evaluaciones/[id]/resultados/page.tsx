export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Download, GitCompare } from 'lucide-react';
import { getResultados } from '@/lib/evaluaciones-server';
import { ResultadosPanel } from '@/components/evaluaciones/resultados-panel';

export const metadata = { title: 'Resultados · Evaluaciones' };

export default async function ResultadosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ clase?: string }>;
}) {
  const { id } = await params;
  const { clase } = await searchParams;
  const [curso, letra] = (clase ?? '').split('|');
  const resultados = await getResultados(id, curso ? { curso, letra: letra || null } : null);
  if (!resultados) notFound();

  const serie = resultados.bloques.find((b) => b.serieId)?.serieId ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/gestion/evaluaciones/${id}`} className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-blue-600">
          <ChevronLeft className="h-4 w-4" /> {resultados.form.titulo}
        </Link>
        <div className="flex items-center gap-1.5">
          {serie && (
            <Link
              href={`/gestion/evaluaciones/comparar?serie=${serie}`}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <GitCompare className="h-3.5 w-3.5" /> Comparar ediciones
            </Link>
          )}
          <a
            href={`/api/evaluaciones/admin/export?form=${id}`}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
        </div>
      </div>
      <ResultadosPanel resultados={resultados} formId={id} claseActiva={clase ?? null} />
    </div>
  );
}
