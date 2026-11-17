import { NextResponse } from 'next/server';
import { isGuardResponse, requireSession } from '@/lib/auth-guards';
import { puedeVerMisSustituciones } from '@/lib/sustituciones';
import { respuestaError } from '@/lib/sustituciones-api';
import { misSustituciones } from '@/lib/sustituciones-server';

export const dynamic = 'force-dynamic';

/** Lo mío, casado por el correo de la sesión. Mientras sea prueba de concepto, solo con el módulo (decisión 16). */
export async function GET() {
  const user = await requireSession();
  if (isGuardResponse(user)) return user;
  if (!puedeVerMisSustituciones(user)) return NextResponse.json({ error: 'Sin permiso para este módulo' }, { status: 403 });
  try {
    return NextResponse.json(await misSustituciones(user.email));
  } catch (e) {
    return respuestaError(e, 'leer tus sustituciones');
  }
}
