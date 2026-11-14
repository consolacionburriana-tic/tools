import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { releerCoberturasBajaDeEducamos } from '@/lib/coberturas-baja-server';

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
    const resumen = await releerCoberturasBajaDeEducamos(dryRun);
    return NextResponse.json({ ok: true, dryRun, resumen });
  } catch (error) {
    console.error('Coberturas por baja desde Educamos:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se han podido releer las coberturas por baja de Educamos' }, { status: 500 });
  }
}
