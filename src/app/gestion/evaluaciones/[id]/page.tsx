export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { count, eq } from 'drizzle-orm';
import { db } from '@/db';
import { evalResponses } from '@/db/schema';
import { academicYearActual, appBaseUrl } from '@/lib/constants';
import { getActividades, getClasesDisponibles, getFormCompleto } from '@/lib/evaluaciones-server';
import { FormEditor } from '@/components/evaluaciones/form-editor';

export const metadata = { title: 'Editar evaluación · Gestión' };

export default async function EditarEvaluacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await getFormCompleto(id);
  if (!form) notFound();

  const [clases, actividades, respuestas] = await Promise.all([
    getClasesDisponibles(),
    getActividades({ academicYear: form.academicYear }),
    db.select({ n: count() }).from(evalResponses).where(eq(evalResponses.formId, id)),
  ]);

  return (
    <FormEditor
      inicial={form}
      clases={clases}
      actividades={actividades.map((a) => ({ id: a.id, nombre: a.nombre }))}
      respuestas={respuestas[0]?.n ?? 0}
      baseUrl={appBaseUrl()}
      academicYearActual={academicYearActual()}
    />
  );
}
