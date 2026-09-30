import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { accionLoteSchema } from '@/lib/oratorios';
import { accionLote } from '@/lib/oratorios-server';

// Confirmar (y crear el evento), descartar borradores, reintentar el calendario, y los
// avisos: enviar ya, programar N días antes, «ya se lo he dicho» o no avisar.
export const maxDuration = 60;

export async function POST(request: Request) {
  const guard = await requireModule('oratorios');
  if (isGuardResponse(guard)) return guard;
  const parsed = accionLoteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  }
  try {
    const r = await accionLote(parsed.data.accion, parsed.data.ids, { email: guard.email, nombre: guard.nombre }, parsed.data.dias);
    return NextResponse.json(r);
  } catch (error) {
    console.error('Oratorios · lote:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se ha podido completar' }, { status: 500 });
  }
}
