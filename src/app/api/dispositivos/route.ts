import { NextResponse } from 'next/server';
import { panelDispositivos } from '@/lib/dispositivos-server';
import { fallo, guard, isGuardResponse } from './respuesta';

export const dynamic = 'force-dynamic';

/** El panel entero (alumnado del alcance, iPads del cole, profes y modelos), para refrescar. */
export async function GET() {
  const g = await guard();
  if (isGuardResponse(g)) return g;
  try {
    return NextResponse.json(await panelDispositivos(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return fallo(error, 'panel');
  }
}
