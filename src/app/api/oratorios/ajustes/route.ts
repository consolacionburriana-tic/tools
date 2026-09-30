import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { ajustesSchema } from '@/lib/oratorios';
import { guardarAjustes } from '@/lib/oratorios-server';

// Trimestres del curso y el «acceso común» del claustro.
export async function PATCH(request: Request) {
  const guard = await requireModule('oratorios');
  if (isGuardResponse(guard)) return guard;
  const parsed = ajustesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  }
  const t = parsed.data.trimestres;
  if (t && t.some((x, i) => x.inicio > x.fin || (i > 0 && x.inicio <= t[i - 1].fin))) {
    return NextResponse.json({ error: 'Los trimestres tienen que ir en orden y sin solaparse' }, { status: 400 });
  }
  try {
    const ajustes = await guardarAjustes(parsed.data, guard.email);
    return NextResponse.json({ ajustes });
  } catch (error) {
    console.error('Oratorios · ajustes:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se ha podido guardar' }, { status: 500 });
  }
}
