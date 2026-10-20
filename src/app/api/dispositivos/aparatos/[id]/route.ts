import { NextResponse } from 'next/server';
import { editarAparatoSchema } from '@/lib/dispositivos';
import { borrarAparato, editarAparato } from '@/lib/dispositivos-server';
import { fallo, firma, guard, idValido, isGuardResponse, leer } from '../../respuesta';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** Datos, estado (en uso, reparación, baja) o a quién se le da (`titular: null` = devolverlo). */
export async function PATCH(request: Request, { params }: Ctx) {
  const g = await guard();
  if (isGuardResponse(g)) return g;
  const { id } = await params;
  if (!idValido(id)) return NextResponse.json({ error: 'Ese iPad no existe' }, { status: 404 });
  const input = await leer(request, editarAparatoSchema);
  if (input instanceof NextResponse) return input;
  try {
    return NextResponse.json({ aparato: await editarAparato(id, input, firma(g)) });
  } catch (error) {
    return fallo(error, 'editar iPad');
  }
}

/** Solo para un alta por error: lo que tiene historia se da de baja, no se borra. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await guard();
  if (isGuardResponse(g)) return g;
  const { id } = await params;
  if (!idValido(id)) return NextResponse.json({ error: 'Ese iPad no existe' }, { status: 404 });
  try {
    await borrarAparato(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fallo(error, 'borrar iPad');
  }
}
