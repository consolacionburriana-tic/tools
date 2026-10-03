import { NextResponse } from 'next/server';
import { personasClaustro } from '@/lib/tableros-server';
import { fallo, guardTableros, isGuardResponse } from '../respuesta';

// A quién se puede meter en un equipo: el claustro (profes activos y cuentas de Usuarios).
export async function GET() {
  const user = await guardTableros();
  if (isGuardResponse(user)) return user;
  try {
    return NextResponse.json({ personas: await personasClaustro() });
  } catch (error) {
    return fallo(error, 'personas');
  }
}
