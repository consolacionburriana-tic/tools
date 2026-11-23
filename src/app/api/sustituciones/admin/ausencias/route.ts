import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { PeticionAusencia } from '@/lib/sustituciones';
import { quienDe, respuestaError } from '@/lib/sustituciones-api';
import { confirmarAusencia } from '@/lib/sustituciones-server';

export const dynamic = 'force-dynamic';

/** Confirmar una ausencia: la guarda en una escritura (409 si un sustituto se ha ocupado) y avisa si toca. */
export async function POST(request: Request) {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    const e = PeticionAusencia.parse(await request.json());
    return NextResponse.json(await confirmarAusencia(e, { ...(await quienDe(user)), enviarYa: e.enviarYa }));
  } catch (e) {
    return respuestaError(e, 'guardar la ausencia');
  }
}
