import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { reglasSchema } from '@/lib/cuentas';
import { guardarGrupo } from '@/lib/cuentas-server';

export const dynamic = 'force-dynamic';

const cuerpo = z.object({ email: z.string().trim().toLowerCase().email(), gestionado: z.boolean(), reglas: reglasSchema });

// Las reglas de un grupo y si se gestiona desde aquí. No toca Google: eso es «Aplicar».
export async function PUT(request: Request) {
  const user = await requireModule('cuentas');
  if (isGuardResponse(user)) return user;
  let datos: z.infer<typeof cuerpo>;
  try {
    datos = cuerpo.parse(await request.json());
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : null;
    return NextResponse.json({ error: msg ?? 'Datos incorrectos' }, { status: 400 });
  }
  try {
    await guardarGrupo(datos.email, { gestionado: datos.gestionado, reglas: datos.reglas }, user.email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se ha podido guardar' }, { status: 409 });
  }
}
