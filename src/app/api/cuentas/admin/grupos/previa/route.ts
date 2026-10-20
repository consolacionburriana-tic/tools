import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { previaGrupo } from '@/lib/cuentas-server';
import { buzonAdmin, explicarError } from '@/lib/google-sa';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const cuerpo = z.object({ email: z.string().trim().toLowerCase().email() });

// Qué cambiaría en el grupo: lee sus miembros de Google y los compara con sus reglas. No escribe.
export async function POST(request: Request) {
  const user = await requireModule('cuentas');
  if (isGuardResponse(user)) return user;
  let datos: z.infer<typeof cuerpo>;
  try {
    datos = cuerpo.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Datos incorrectos' }, { status: 400 });
  }
  try {
    return NextResponse.json(await previaGrupo(buzonAdmin(user.email), datos.email));
  } catch (error) {
    return NextResponse.json({ error: explicarError(error) }, { status: 502 });
  }
}
