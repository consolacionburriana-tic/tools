import { NextResponse } from 'next/server';
import { modeloSchema } from '@/lib/dispositivos';
import { guardarModelo, quitarModelo } from '@/lib/dispositivos-server';
import { fallo, guard, idValido, isGuardResponse, leer } from '../../respuesta';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await guard();
  if (isGuardResponse(g)) return g;
  const { id } = await params;
  if (!idValido(id)) return NextResponse.json({ error: 'Ese modelo no existe' }, { status: 404 });
  const input = await leer(request, modeloSchema);
  if (input instanceof NextResponse) return input;
  try {
    return NextResponse.json({ modelos: await guardarModelo(id, input) });
  } catch (error) {
    return fallo(error, 'editar modelo');
  }
}

/** Si algún iPad lo usa se archiva; si no, se borra. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await guard();
  if (isGuardResponse(g)) return g;
  const { id } = await params;
  if (!idValido(id)) return NextResponse.json({ error: 'Ese modelo no existe' }, { status: 404 });
  try {
    return NextResponse.json(await quitarModelo(id));
  } catch (error) {
    return fallo(error, 'quitar modelo');
  }
}
