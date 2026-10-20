import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { vincularSchema } from '@/lib/cuentas';
import { vincular } from '@/lib/cuentas-server';

export const dynamic = 'force-dynamic';

// «Esta cuenta es de esta persona»: apunta el correo en la BBDD central. Google no se toca.
export async function POST(request: Request) {
  const user = await requireModule('cuentas');
  if (isGuardResponse(user)) return user;
  let datos: z.infer<typeof vincularSchema>;
  try {
    datos = vincularSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Datos incorrectos' }, { status: 400 });
  }
  const r = await vincular(datos.tipo, datos.personaId, datos.googleId, user.email);
  return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: 409 });
}
