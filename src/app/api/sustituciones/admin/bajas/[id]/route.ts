import { NextResponse } from 'next/server';
import { z } from 'zod';
import { autorDe, isGuardResponse, requireModule } from '@/lib/auth-guards';
import { PeticionBaja } from '@/lib/bajas';
import { borrarBaja, darAlta, ErrorBaja, guardarBaja } from '@/lib/bajas-server';
import { respuestaError } from '@/lib/sustituciones-api';

export const dynamic = 'force-dynamic';

const Id = z.string().uuid();

/** Cambia la baja entera (fechas, motivo, sustitutos). */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    const id = Id.parse((await params).id);
    const e = PeticionBaja.parse(await request.json());
    return NextResponse.json(await guardarBaja(id, e, autorDe(user)));
  } catch (e) {
    return respuestaError(e, 'guardar la baja');
  }
}

/** «Ha vuelto»: el alta real (el primer día de vuelta). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    const id = Id.parse((await params).id);
    const { alta } = z.object({ alta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida') }).parse(await request.json());
    await darAlta(id, alta, autorDe(user));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respuestaError(e, 'dar el alta');
  }
}

/** Borra una baja apuntada por error (sus coberturas se quedan, sin baja). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    const id = Id.parse((await params).id);
    if (!(await borrarBaja(id))) throw new ErrorBaja('Esa baja no existe.', 404);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respuestaError(e, 'borrar la baja');
  }
}
