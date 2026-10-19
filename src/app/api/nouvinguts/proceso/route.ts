import { NextResponse } from 'next/server';
import { procesoSchema } from '@/lib/nouvinguts';
import { getProceso, guardarProceso } from '@/lib/nouvinguts-server';
import { fallo, isGuardResponse, leer, requireModule } from '../respuesta';

export const dynamic = 'force-dynamic';

/** El orden de los pasos, quién lleva cada uno, desde qué curso y los días de atasco. */
export async function PUT(request: Request) {
  const guard = await requireModule('nouvinguts-proceso');
  if (isGuardResponse(guard)) return guard;
  const cuerpo = await leer(request, procesoSchema);
  if (cuerpo instanceof NextResponse) return cuerpo;
  try {
    await guardarProceso(cuerpo.pasos, { diasAtasco: cuerpo.diasAtasco }, guard.email);
    return NextResponse.json(await getProceso());
  } catch (error) {
    return fallo(error, 'proceso');
  }
}
