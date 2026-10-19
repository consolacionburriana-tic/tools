import { NextResponse } from 'next/server';
import { importarSchema } from '@/lib/nouvinguts';
import { importarAltasDesde } from '@/lib/nouvinguts-server';
import { fallo, isGuardResponse, leer, requireModule } from '../respuesta';

export const dynamic = 'force-dynamic';

/** Para estrenarlo: traer las altas de la BBDD central desde una fecha. Con `dry`, solo cuenta. */
export async function POST(request: Request) {
  const guard = await requireModule('nouvinguts-proceso');
  if (isGuardResponse(guard)) return guard;
  const cuerpo = await leer(request, importarSchema);
  if (cuerpo instanceof NextResponse) return cuerpo;
  try {
    return NextResponse.json(await importarAltasDesde(cuerpo.desde, !!cuerpo.dry));
  } catch (error) {
    return fallo(error, 'importar');
  }
}
