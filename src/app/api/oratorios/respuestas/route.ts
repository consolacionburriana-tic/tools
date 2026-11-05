import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { sincronizarRespuestas } from '@/lib/oratorios-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Lee de Google Calendar qué han contestado los profes a los eventos y guarda lo que ha
// cambiado. Devuelve solo las sesiones que han cambiado.
export async function POST() {
  const guard = await requireModule('oratorios');
  if (isGuardResponse(guard)) return guard;
  try {
    const r = await sincronizarRespuestas();
    return NextResponse.json(r);
  } catch (error) {
    console.error('Oratorios · respuestas:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se han podido leer las respuestas' }, { status: 500 });
  }
}
