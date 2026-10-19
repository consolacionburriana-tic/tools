import { after, NextResponse } from 'next/server';
import { altaSchema } from '@/lib/nouvinguts';
import { apuntarNouvingut, avisarAltas, listaNouvinguts } from '@/lib/nouvinguts-server';
import { fallo, firma, isGuardResponse, leer, requireModule } from './respuesta';

export const dynamic = 'force-dynamic';

/** La lista: `?estado=cerrado` para los que ya cerraron su ciclo. */
export async function GET(request: Request) {
  const guard = await requireModule('nouvinguts');
  if (isGuardResponse(guard)) return guard;
  const estado = new URL(request.url).searchParams.get('estado') === 'cerrado' ? 'cerrado' : 'abierto';
  try {
    return NextResponse.json(await listaNouvinguts(estado, guard.role));
  } catch (error) {
    return fallo(error, 'lista');
  }
}

/** «Tengo uno nuevo»: apuntar a mano antes de que esté en Educamos. */
export async function POST(request: Request) {
  const guard = await requireModule('nouvinguts');
  if (isGuardResponse(guard)) return guard;
  const alta = await leer(request, altaSchema);
  if (alta instanceof NextResponse) return alta;
  try {
    const creado = await apuntarNouvingut(alta, firma(guard));
    // «Llega uno nuevo» (a TIC por defecto): sin hacer esperar a quien apunta.
    after(() => avisarAltas([creado.id], firma(guard)));
    return NextResponse.json(creado);
  } catch (error) {
    return fallo(error, 'apuntar');
  }
}
