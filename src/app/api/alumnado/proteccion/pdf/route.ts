import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { alcanceAlumnado, alcanceProteccion, listaAlumnado } from '@/lib/alumnado-server';
import { casaFiltroProteccion, claseLarga, esFiltroProteccion } from '@/lib/alumnado';
import { pdfProteccion } from '@/lib/alumnado-pdf';

export const dynamic = 'force-dynamic';

const ETAPA_LARGO: Record<string, string> = { EI: 'Infantil', EP: 'Primaria', ESO: 'Secundaria' };

/**
 * El listado en PDF: lo que se está viendo en pantalla, en papel. Los filtros viajan en la
 * URL y **se vuelven a aplicar aquí sobre la lista que salga del alcance de quien pide**,
 * no sobre lo que mande el navegador: el PDF no puede ser una rendija por la que salga
 * alumnado que en pantalla no se ve.
 *
 * `?etapa=EI|EP|ESO` · `?clase=2ESO|B` · `?filtro=sin-fotos|sin-marcar|sin-prodat` ·
 * `?porEtapa=1` (cada etapa en su hoja).
 */
export async function GET(request: Request) {
  const guard = await requireModule('alumnado');
  if (isGuardResponse(guard)) return guard;

  const url = new URL(request.url);
  const etapa = url.searchParams.get('etapa');
  const clase = url.searchParams.get('clase');
  const filtroPedido = url.searchParams.get('filtro');
  const filtro = esFiltroProteccion(filtroPedido) ? filtroPedido : 'todos';
  const porEtapa = url.searchParams.get('porEtapa') === '1';

  const alcance = await alcanceAlumnado(guard);
  const pd = alcanceProteccion(guard, alcance.propias);
  const { alumnos } = await listaAlumnado(alcance.clases, undefined, pd);

  const [cursoPedido, letraPedida] = (clase ?? '').split('|');
  const visibles = alumnos.filter((a) => {
    // Sin protección visible no entra: en el PDF tampoco se cuela lo que no te toca.
    if (!a.proteccion) return false;
    if (etapa && a.etapa !== etapa) return false;
    if (clase && (a.curso !== cursoPedido || (a.letra ?? '') !== (letraPedida ?? ''))) return false;
    return casaFiltroProteccion(a.proteccion, filtro);
  });

  const ambito = clase
    ? claseLarga(cursoPedido, letraPedida || null)
    : etapa
      ? (ETAPA_LARGO[etapa] ?? etapa)
      : 'Todo el centro';

  try {
    const bytes = await pdfProteccion(visibles, { ambito, filtro, porEtapa });
    const nombre = `proteccion-datos-${ambito.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.pdf`;
    return new Response(bytes as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nombre}"`,
        // Un listado con nombres no se guarda en ninguna caché intermedia.
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo generar el PDF' },
      { status: 500 },
    );
  }
}
