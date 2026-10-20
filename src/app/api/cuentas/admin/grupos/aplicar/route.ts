import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { aplicarGrupo } from '@/lib/cuentas-server';
import { buzonAdmin, explicarError } from '@/lib/google-sa';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const cuerpo = z.object({
  email: z.string().trim().toLowerCase().email(),
  /** Si las bajas son muchas, la pantalla obliga a escribir QUITAR; el servidor lo comprueba. */
  confirmacion: z.string().max(20).nullable(),
});

// Deja el grupo como dicen sus reglas. El plan se recalcula aquí, no se fía del de la pantalla.
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
    return NextResponse.json(await aplicarGrupo(buzonAdmin(user.email), datos.email, datos.confirmacion, user.email));
  } catch (error) {
    const mensaje = error instanceof Error && /QUITAR|grupo no está/.test(error.message) ? error.message : explicarError(error);
    return NextResponse.json({ error: mensaje }, { status: 409 });
  }
}
