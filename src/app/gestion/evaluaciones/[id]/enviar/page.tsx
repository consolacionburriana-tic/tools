export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { appBaseUrl } from '@/lib/constants';
import { getFormCompleto } from '@/lib/evaluaciones-server';
import { EnviarPanel } from '@/components/evaluaciones/enviar-panel';
import type { Audiencia } from '@/lib/evaluaciones';

export const metadata = { title: 'Enviar evaluación · Gestión' };

export default async function EnviarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await getFormCompleto(id);
  if (!form) notFound();

  return (
    <div className="space-y-4">
      <Link
        href={`/gestion/evaluaciones/${form.id}`}
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-blue-600"
      >
        <ChevronLeft className="h-4 w-4" /> Volver al editor
      </Link>
      <EnviarPanel
        formId={form.id}
        titulo={form.titulo}
        audiencia={form.audiencia as Audiencia}
        estado={form.estado}
        academicYear={form.academicYear}
        enlace={`${appBaseUrl()}/evaluaciones/${form.token}`}
        personalizado={form.audiencia === 'alumnos' && form.identificaAlumno}
        clasesElegidas={(form.clases ?? []).length}
      />
    </div>
  );
}
