import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { sugerirGruposSustitucion } from '@/lib/cuentas-server';
import { buzonAdmin, explicarError } from '@/lib/google-sa';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const cuerpo = z.object({ sustitucionId: z.string().uuid() });

// Los grupos donde está el titular, para elegir en cuáles entra quien lo sustituye. Solo lee.
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
    return NextResponse.json(await sugerirGruposSustitucion(buzonAdmin(user.email), datos.sustitucionId));
  } catch (error) {
    const mensaje = error instanceof Error && /sustitución/.test(error.message) ? error.message : explicarError(error);
    return NextResponse.json({ error: mensaje }, { status: 409 });
  }
}
