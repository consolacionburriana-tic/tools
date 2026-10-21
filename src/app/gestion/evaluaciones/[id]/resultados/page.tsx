export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Download, GitCompare } from 'lucide-react';
import { getDestacados, getResultados, getSectoresGrupo } from '@/lib/evaluaciones-server';
import { getUltimoInsight } from '@/lib/evaluaciones-ia-server';
import { getAjustesIA, hayClaveIA } from '@/lib/ajustes-server';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { ResultadosPanel } from '@/components/evaluaciones/resultados-panel';
import { SectoresTabs } from '@/components/evaluaciones/sectores';
import { buttonVariants } from '@/components/ui/button';
import { EnlaceVolver, TituloPagina } from '@/components/ui/cabecera-modulo';

export const metadata = { title: 'Resultados · Evaluaciones' };

export default async function ResultadosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ clase?: string; etapa?: string }>;
}) {
  const { id } = await params;
  const { clase, etapa } = await searchParams;
  const [curso, letra] = (clase ?? '').split('|');
  // La clase manda sobre la etapa (la etapa viaja con ella solo para marcar su pestaña).
  const filtro = curso ? { curso, letra: letra || null } : etapa ? { etapa } : null;
  const [resultados, destacados, insight, ajustesIA, user] = await Promise.all([
    getResultados(id, filtro),
    getDestacados(id),
    getUltimoInsight(id, filtro),
    getAjustesIA(),
    getSessionUser(),
  ]);
  if (!resultados) notFound();

  const serie = resultados.bloques.find((b) => b.serieId)?.serieId ?? null;
  const sectores = await getSectoresGrupo(resultados.form.grupoId);

  return (
    <div className="space-y-4">
      <div>
        <EnlaceVolver href={`/gestion/evaluaciones/${id}`}>Volver al editor</EnlaceVolver>
        <TituloPagina
          antes="Resultados"
          className="mb-0"
          acciones={
            <>
              {serie && (
                <Link
                  href={`/gestion/evaluaciones/comparar?serie=${serie}`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  <GitCompare aria-hidden /> Comparar ediciones
                </Link>
              )}
              <a href={`/api/evaluaciones/admin/export?form=${id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                <Download aria-hidden /> CSV
              </a>
            </>
          }
        >
          {resultados.form.titulo}
        </TituloPagina>
      </div>
      <SectoresTabs
        sectores={sectores}
        actualId={id}
        destino="resultados"
        query={etapa ? `etapa=${encodeURIComponent(etapa)}` : undefined}
      />
      <ResultadosPanel
        key={id}
        resultados={resultados}
        formId={id}
        claseActiva={curso ? (clase ?? null) : null}
        etapaActiva={etapa ?? null}
        destacados={destacados}
        ia={{
          activado: ajustesIA.activado,
          hayClave: hayClaveIA(),
          modelo: ajustesIA.modelo,
          puedeAjustar: canAccess(user, 'ajustes'),
        }}
        insight={insight}
      />
    </div>
  );
}
