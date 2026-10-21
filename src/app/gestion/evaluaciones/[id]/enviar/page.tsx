export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { appBaseUrl } from '@/lib/constants';
import { getFormCompleto, getSectoresGrupo } from '@/lib/evaluaciones-server';
import { EnviarPanel } from '@/components/evaluaciones/enviar-panel';
import { SectoresTabs } from '@/components/evaluaciones/sectores';
import type { Audiencia } from '@/lib/evaluaciones';
import { EnlaceVolver, TituloPagina } from '@/components/ui/cabecera-modulo';

export const metadata = { title: 'Enviar evaluación · Gestión' };

export default async function EnviarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await getFormCompleto(id);
  if (!form) notFound();
  const sectores = await getSectoresGrupo(form.grupoId);

  return (
    <div className="space-y-4">
      <div>
        <EnlaceVolver href={`/gestion/evaluaciones/${form.id}`}>Volver al editor</EnlaceVolver>
        <TituloPagina antes="Enviar" className="mb-0">
          {form.titulo}
        </TituloPagina>
      </div>
      <SectoresTabs sectores={sectores} actualId={form.id} destino="enviar" />
      <EnviarPanel
        key={form.id}
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
