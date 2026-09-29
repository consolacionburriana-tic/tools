import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { puedeHacerFotosNumeros } from '@/lib/permissions';
import { fotosPara, guardarFoto, recuentosPorClase, vistaNumeros } from '@/lib/numeros-server';
import { recortar } from '@/lib/numeros';

export const dynamic = 'force-dynamic';

// Histórico de Números del cole (docs/24-numeros.md). GET: todas las fotos, recortadas para
// quien mira (sus clases, sus pestañas), y los números de hoy para comparar. POST: guardar una
// foto a mano con su nota.
export async function GET() {
  const user = await requireModule('numeros');
  if (isGuardResponse(user)) return user;
  try {
    const hoy = await recuentosPorClase();
    const vista = await vistaNumeros(user, hoy.campana);
    const fotos = await fotosPara(vista);
    return NextResponse.json({ fotos, hoy: recortar(hoy, vista) });
  } catch (error) {
    console.error('Números · error leyendo el histórico:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se pudo leer el histórico' }, { status: 500 });
  }
}

const Cuerpo = z.object({ nota: z.string().max(200).optional() });

export async function POST(request: Request) {
  const user = await requireModule('numeros');
  if (isGuardResponse(user)) return user;
  if (!puedeHacerFotosNumeros(user.role)) {
    return NextResponse.json({ error: 'Las fotos las guardan secretaría, dirección y TIC' }, { status: 403 });
  }
  const cuerpo = Cuerpo.safeParse(await request.json().catch(() => ({})));
  if (!cuerpo.success) return NextResponse.json({ error: 'Nota demasiado larga' }, { status: 400 });
  try {
    const foto = await guardarFoto('manual', user.email, cuerpo.data.nota ?? null);
    return NextResponse.json({ ok: true, id: foto.id });
  } catch (error) {
    console.error('Números · error guardando la foto:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se pudo guardar la foto' }, { status: 500 });
  }
}
