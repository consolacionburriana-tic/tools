import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { alcanceClases, listarRetrasos } from '@/lib/puntualidad-server';
import { csvRetrasos } from '@/lib/puntualidad-exports';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const guard = await requireModule('puntualidad');
  if (isGuardResponse(guard)) return guard;
  try {
    const { searchParams } = new URL(request.url);
    const filas = await listarRetrasos(
      {
        desde: searchParams.get('desde') ?? undefined,
        hasta: searchParams.get('hasta') ?? undefined,
        clases: await alcanceClases(guard),
      },
      5000,
    );
    const hoy = new Date().toISOString().slice(0, 10);
    return new NextResponse(csvRetrasos(filas), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="puntualidad-${hoy}.csv"`,
      },
    });
  } catch (error) {
    console.error('Puntualidad · error exportando:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
