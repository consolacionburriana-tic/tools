import { NextResponse } from 'next/server';
import { autorDe, isGuardResponse, requireModule } from '@/lib/auth-guards';
import { PeticionBaja } from '@/lib/bajas';
import { datosBajas, guardarBaja } from '@/lib/bajas-server';
import { respuestaError } from '@/lib/sustituciones-api';

export const dynamic = 'force-dynamic';

/** Las bajas, las coberturas sin baja anotada y el claustro (docs/32, «Bajas»). */
export async function GET() {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    return NextResponse.json(await datosBajas());
  } catch (e) {
    return respuestaError(e, 'leer las bajas');
  }
}

/** Apunta una baja (con o sin sustituto). */
export async function POST(request: Request) {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    const e = PeticionBaja.parse(await request.json());
    return NextResponse.json(await guardarBaja(null, e, autorDe(user)));
  } catch (e) {
    return respuestaError(e, 'guardar la baja');
  }
}
