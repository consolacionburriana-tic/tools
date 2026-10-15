// Guardar los ajustes de IA del colegio (modelo, interruptor y contexto).
import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { ajustesIASchema } from '@/lib/ajustes';
import { guardarAjustesIA } from '@/lib/ajustes-server';

export async function PUT(request: Request) {
  const guard = await requireModule('ajustes');
  if (isGuardResponse(guard)) return guard;
  const parsed = ajustesIASchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 });
  await guardarAjustesIA(parsed.data, guard.email);
  return NextResponse.json({ ok: true });
}
