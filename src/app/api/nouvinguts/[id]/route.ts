import { NextResponse } from 'next/server';
import { editarSchema } from '@/lib/nouvinguts';
import { cerrarNouvingut, editarNouvingut, quitarNouvingut } from '@/lib/nouvinguts-server';
import { conFicha, fallo, firma, idValido, isGuardResponse, leer, requireModule } from '../respuesta';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const guard = await requireModule('nouvinguts');
  if (isGuardResponse(guard)) return guard;
  const { id } = await params;
  if (!idValido(id)) return NextResponse.json({ error: 'Identificador no válido' }, { status: 400 });
  try {
    return await conFicha(id, guard);
  } catch (error) {
    return fallo(error, 'ficha');
  }
}

/** Cerrar o reabrir su ciclo, o corregir la fecha (y el nombre, mientras espera a Educamos). */
export async function PATCH(request: Request, { params }: Ctx) {
  const guard = await requireModule('nouvinguts');
  if (isGuardResponse(guard)) return guard;
  const { id } = await params;
  if (!idValido(id)) return NextResponse.json({ error: 'Identificador no válido' }, { status: 400 });
  const cuerpo = await leer(request, editarSchema);
  if (cuerpo instanceof NextResponse) return cuerpo;
  try {
    if (cuerpo.accion === 'datos') await editarNouvingut(id, cuerpo);
    else await cerrarNouvingut(id, cuerpo.accion === 'cerrar', firma(guard));
    return await conFicha(id, guard);
  } catch (error) {
    return fallo(error, 'editar');
  }
}

/** Quitar un apuntado por error (solo si todavía no está vinculado a Educamos). */
export async function DELETE(_request: Request, { params }: Ctx) {
  const guard = await requireModule('nouvinguts');
  if (isGuardResponse(guard)) return guard;
  const { id } = await params;
  if (!idValido(id)) return NextResponse.json({ error: 'Identificador no válido' }, { status: 400 });
  try {
    await quitarNouvingut(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fallo(error, 'quitar');
  }
}
