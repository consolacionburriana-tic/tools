// Salidas (docs/32, decisión 25): listar las de mis etapas y apuntar una nueva.
import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { etapasActivas } from '@/lib/jefaturas-server';
import { PeticionSalida } from '@/lib/sustituciones';
import { quienDe, respuestaError } from '@/lib/sustituciones-api';
import { crearSalida, listarSalidas } from '@/lib/sustituciones-salidas-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    return NextResponse.json(await listarSalidas((await etapasActivas(user.email)).etapas));
  } catch (e) {
    return respuestaError(e, 'cargar las salidas');
  }
}

export async function POST(request: Request) {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    const e = PeticionSalida.parse(await request.json());
    return NextResponse.json(await crearSalida(e, await quienDe(user)));
  } catch (e) {
    return respuestaError(e, 'guardar la salida');
  }
}
