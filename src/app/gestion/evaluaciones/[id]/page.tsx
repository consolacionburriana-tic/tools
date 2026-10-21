export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { count, eq } from 'drizzle-orm';
import { db } from '@/db';
import { evalResponses } from '@/db/schema';
import { academicYearActual, appBaseUrl } from '@/lib/constants';
import { getActividades, getClasesDisponibles, getFormCompleto, getSectoresGrupo } from '@/lib/evaluaciones-server';
import { FormEditor } from '@/components/evaluaciones/form-editor';
import { EnlaceVolver } from '@/components/ui/cabecera-modulo';

export const metadata = { title: 'Editar evaluación · Gestión' };

export default async function EditarEvaluacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await getFormCompleto(id);
  if (!form) notFound();

  const [clases, actividades, respuestas, sectores] = await Promise.all([
    getClasesDisponibles(),
    getActividades({ academicYear: form.academicYear }),
    db.select({ n: count() }).from(evalResponses).where(eq(evalResponses.formId, id)),
    getSectoresGrupo(form.grupoId),
  ]);

  return (
    <>
      <EnlaceVolver href="/gestion/evaluaciones">Todas las evaluaciones</EnlaceVolver>
      {/* El título se edita en la tarjeta de abajo; aquí va para el lector de pantalla. */}
      <h1 className="sr-only">{form.titulo}</h1>
      <div className="mt-2">
        <FormEditor
          key={form.id}
          inicial={form}
          clases={clases}
          actividades={actividades.map((a) => ({ id: a.id, nombre: a.nombre }))}
          respuestas={respuestas[0]?.n ?? 0}
          baseUrl={appBaseUrl()}
          academicYearActual={academicYearActual()}
          sectores={sectores}
        />
      </div>
    </>
  );
}
