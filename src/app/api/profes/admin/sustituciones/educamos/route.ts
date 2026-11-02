import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { releerSustitucionesDeEducamos } from '@/lib/sustituciones-server';

export const dynamic = 'force-dynamic';

/**
 * Vuelve a leer, de lo que ya está guardado de Educamos, quién sustituye a quién (sin subir
 * el fichero otra vez). Con `?dryRun=1` solo cuenta lo que haría.
 */
export async function POST(request: Request) {
  const guard = await requireModule('profes');
  if (isGuardResponse(guard)) return guard;
  try {
    const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';
    const resumen = await releerSustitucionesDeEducamos(dryRun);
    return NextResponse.json({ ok: true, dryRun, resumen });
  } catch (error) {
    console.error('Sustituciones desde Educamos:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se han podido releer las sustituciones de Educamos' }, { status: 500 });
  }
}
