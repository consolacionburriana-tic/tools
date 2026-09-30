import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { anadirProfeEnClases, buzonAdmin } from '@/lib/calendarios-server';
import { COLEGIO } from '@/lib/colegio';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const cuerpo = z.object({
  ids: z.array(z.string().min(1).max(100)).min(1).max(30),
  // Solo cuentas del colegio: Classroom no deja meter de profe a alguien de fuera sin invitación.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .refine((e) => e.endsWith(`@${COLEGIO.dominio}`), 'Tiene que ser una cuenta del colegio'),
});

// Matricula a alguien como PROFE en las clases elegidas.
export async function POST(request: Request) {
  const user = await requireModule('calendarios');
  if (isGuardResponse(user)) return user;
  const datos = cuerpo.safeParse(await request.json().catch(() => null));
  if (!datos.success) {
    return NextResponse.json({ error: datos.error.issues[0]?.message ?? 'Datos incorrectos' }, { status: 400 });
  }
  try {
    return NextResponse.json({ resultados: await anadirProfeEnClases(buzonAdmin(user.email), datos.data.ids, datos.data.email) });
  } catch (error) {
    console.error('Calendarios: error añadiendo profe:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Error añadiendo el profe' }, { status: 500 });
  }
}
