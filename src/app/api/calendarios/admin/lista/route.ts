import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { listarCalendarios } from '@/lib/calendarios-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await requireModule('calendarios');
  if (isGuardResponse(user)) return user;
  try {
    return NextResponse.json({ calendarios: await listarCalendarios() });
  } catch (error) {
    console.error('Calendarios: error leyendo el inventario:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Error leyendo el inventario' }, { status: 500 });
  }
}
