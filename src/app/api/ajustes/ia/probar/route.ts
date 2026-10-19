// "Probar conexión" de Ajustes del colegio: una llamada mínima a Claude con el modelo elegido.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { ajustesIASchema } from '@/lib/ajustes';
import { ErrorIA, probarConexionIA } from '@/lib/evaluaciones-ia-server';

export const maxDuration = 60;

const schema = z.object({ modelo: ajustesIASchema.shape.modelo });

export async function POST(request: Request) {
  const guard = await requireModule('ajustes');
  if (isGuardResponse(guard)) return guard;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Modelo no válido' }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await probarConexionIA(parsed.data.modelo)) });
  } catch (error) {
    if (error instanceof ErrorIA) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'No se ha podido probar la conexión' }, { status: 500 });
  }
}
