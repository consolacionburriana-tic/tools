import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { enviar } from '@/lib/email';
import { hoyEnEspana } from '@/lib/oratorios';
import { PeticionPlantillas, TIPOS_PLANTILLA } from '@/lib/sustituciones';
import { quienDe, respuestaError } from '@/lib/sustituciones-api';
import { ejemploAviso } from '@/lib/sustituciones-email';

export const dynamic = 'force-dynamic';

/** «Enviarme una prueba»: la plantilla tal como está en pantalla (sin guardar), a quien pulsa, con datos de ejemplo. */
export async function POST(request: Request) {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    const { tipo, plantillas } = z.object({ tipo: z.enum(TIPOS_PLANTILLA), plantillas: PeticionPlantillas }).parse(await request.json());
    const quien = await quienDe(user);
    const { subject, html } = ejemploAviso(tipo, plantillas[tipo], quien.nombre, hoyEnEspana());
    await enviar('sustituciones', { to: quien.email, subject: `[Prueba] ${subject}`, html });
    return NextResponse.json({ ok: true, a: quien.email });
  } catch (e) {
    return respuestaError(e, 'mandar la prueba');
  }
}
