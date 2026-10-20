import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { crearUoSchema } from '@/lib/cuentas';
import { crearUnidadOrganizativa } from '@/lib/cuentas-server';
import { buzonAdmin } from '@/lib/google-sa';

export const dynamic = 'force-dynamic';

// Crea una unidad organizativa en Google (p. ej. la de una clase nueva o la de archivo).
export async function POST(request: Request) {
  const user = await requireModule('cuentas');
  if (isGuardResponse(user)) return user;
  let datos: z.infer<typeof crearUoSchema>;
  try {
    datos = crearUoSchema.parse(await request.json());
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : null;
    return NextResponse.json({ error: msg ?? 'Datos incorrectos' }, { status: 400 });
  }
  try {
    return NextResponse.json(await crearUnidadOrganizativa(buzonAdmin(user.email), datos.nombre, datos.padre, user.email));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se ha podido crear' }, { status: 502 });
  }
}
