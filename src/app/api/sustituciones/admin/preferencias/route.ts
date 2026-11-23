// Lo que cada persona de Jefatura se configura para sí: el correo cuando un sustituto confirma.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { guardarAvisoConfirmacion } from '@/lib/sustituciones-confirmacion-server';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  const p = z.object({ avisoConfirmacion: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 });
  await guardarAvisoConfirmacion(user.emulando?.email ?? user.email, p.data.avisoConfirmacion);
  return NextResponse.json({ ok: true });
}
