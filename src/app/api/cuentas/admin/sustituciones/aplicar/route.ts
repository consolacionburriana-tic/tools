import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { anadirSustitutoAGrupos } from '@/lib/cuentas-server';
import { buzonAdmin, explicarError } from '@/lib/google-sa';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const cuerpo = z.object({
  sustitucionId: z.string().uuid(),
  grupos: z.array(z.string().trim().toLowerCase().email()).min(1).max(100),
});

// Mete al sustituto en los grupos marcados. El servidor vuelve a comprobar cada uno (que el
// titular esté en él y que no lo mantengan reglas que lo sacarían), no se fía de la pantalla.
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
    const resultados = await anadirSustitutoAGrupos(buzonAdmin(user.email), datos.sustitucionId, datos.grupos, user.email);
    return NextResponse.json({ resultados });
  } catch (error) {
    const mensaje = error instanceof Error && /sustitución|cuenta activa/.test(error.message) ? error.message : explicarError(error);
    return NextResponse.json({ error: mensaje }, { status: 409 });
  }
}
