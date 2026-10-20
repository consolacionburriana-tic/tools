import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { crearGrupoSchema } from '@/lib/cuentas';
import { crearGrupoNuevo } from '@/lib/cuentas-server';
import { buzonAdmin } from '@/lib/google-sa';

export const dynamic = 'force-dynamic';

// Crea un grupo en Google con sus reglas (queda gestionado desde aquí).
export async function POST(request: Request) {
  const user = await requireModule('cuentas');
  if (isGuardResponse(user)) return user;
  let datos: z.infer<typeof crearGrupoSchema>;
  try {
    datos = crearGrupoSchema.parse(await request.json());
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : null;
    return NextResponse.json({ error: msg ?? 'Datos incorrectos' }, { status: 400 });
  }
  try {
    await crearGrupoNuevo(buzonAdmin(user.email), datos, user.email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se ha podido crear' }, { status: 502 });
  }
}
