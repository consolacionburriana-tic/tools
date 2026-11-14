import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { PeticionCambio } from '@/lib/sustituciones';
import { quienDe, respuestaError } from '@/lib/sustituciones-api';
import { cambiarAusencia, fichaAusencia } from '@/lib/sustituciones-server';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    const { id } = await params;
    return NextResponse.json(await fichaAusencia(id));
  } catch (e) {
    return respuestaError(e, 'leer la ausencia');
  }
}

/** Cambiar el sustituto de una hora, añadir o quitar horas, fechas, indicaciones, motivo o anular. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    const { id } = await params;
    const cambio = PeticionCambio.parse(await request.json());
    return NextResponse.json(await cambiarAusencia(id, cambio, await quienDe(user)));
  } catch (e) {
    return respuestaError(e, 'cambiar la ausencia');
  }
}
