import { NextResponse } from 'next/server';
import { claseLabel, getClasesConSalidasAbiertas } from '@/lib/salidas-server';

export const dynamic = 'force-dynamic';

// Clases con alguna salida abierta — para el flujo manual ("no me encuentra").
export async function GET() {
  try {
    const clases = await getClasesConSalidasAbiertas();
    return NextResponse.json({ clases: clases.map((c) => ({ ...c, label: claseLabel(c) })) });
  } catch (error) {
    console.error('Error cargando clases:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
