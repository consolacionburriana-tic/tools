import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth-guards';
import { calendarConfigurado, listarCalendarios } from '@/lib/mihorario-google';
import { getProfePorEmail } from '@/lib/mihorario-server';

/** Los calendarios de Google de quien tiene sesión, para elegir destino. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const profe = await getProfePorEmail(user.email);
  if (!profe) return NextResponse.json({ error: 'Tu correo no está enlazado a ningún profesor' }, { status: 404 });

  if (!calendarConfigurado()) {
    return NextResponse.json({ configurado: false, calendarios: [] });
  }
  try {
    const calendarios = await listarCalendarios(profe.email ?? user.email);
    return NextResponse.json({ configurado: true, calendarios });
  } catch (e) {
    return NextResponse.json(
      { configurado: true, calendarios: [], error: `No se pudo listar tus calendarios: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
