import { NextResponse } from 'next/server';
import { autorDe, isGuardResponse, requireModule } from '@/lib/auth-guards';
import { PeticionPlantillas } from '@/lib/sustituciones';
import { respuestaError } from '@/lib/sustituciones-api';
import { getPlantillas, guardarPlantillas } from '@/lib/sustituciones-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    return NextResponse.json(await getPlantillas());
  } catch (e) {
    return respuestaError(e, 'leer las plantillas');
  }
}

export async function PUT(request: Request) {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    await guardarPlantillas(PeticionPlantillas.parse(await request.json()), autorDe(user));
    return NextResponse.json(await getPlantillas());
  } catch (e) {
    return respuestaError(e, 'guardar las plantillas');
  }
}

/** «Volver al texto de fábrica» de todas. */
export async function DELETE() {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    await guardarPlantillas(null, autorDe(user));
    return NextResponse.json(await getPlantillas());
  } catch (e) {
    return respuestaError(e, 'volver al texto de fábrica');
  }
}
