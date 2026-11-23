// «Confirmar» desde «Mis sustituciones»: solo una hora suya y ya avisada (lo comprueba el servidor).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireSession } from '@/lib/auth-guards';
import { puedeVerMisSustituciones } from '@/lib/sustituciones';
import { confirmarMia } from '@/lib/sustituciones-confirmacion-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await requireSession();
  if (isGuardResponse(user)) return user;
  if (!puedeVerMisSustituciones(user)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const p = z.object({ sesionId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 });
  const estado = await confirmarMia(p.data.sesionId, user.email);
  return NextResponse.json({ estado }, { status: estado === 'no_encontrada' ? 404 : 200 });
}
