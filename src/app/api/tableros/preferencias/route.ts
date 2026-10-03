import { NextResponse } from 'next/server';
import { preferenciasSchema } from '@/lib/tableros';
import { guardarPreferencias, preferencias } from '@/lib/tableros-server';
import { fallo, guardTableros, isGuardResponse, leer } from '../respuesta';

// Qué correos quiere recibir cada uno (asignaciones y vencimientos).
export async function GET() {
  const user = await guardTableros();
  if (isGuardResponse(user)) return user;
  try {
    return NextResponse.json({ preferencias: await preferencias(user.email) });
  } catch (error) {
    return fallo(error, 'preferencias');
  }
}

export async function PUT(request: Request) {
  const user = await guardTableros();
  if (isGuardResponse(user)) return user;
  const datos = await leer(request, preferenciasSchema);
  if (datos instanceof NextResponse) return datos;
  try {
    return NextResponse.json({ preferencias: await guardarPreferencias(user.email, datos) });
  } catch (error) {
    return fallo(error, 'guardar preferencias');
  }
}
