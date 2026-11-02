import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth-guards';
import { claveExportacion } from '@/lib/mihorario';
import { borrarEventosDeOrigen } from '@/lib/mihorario-google';
import { getProfePorEmail, getUltimaExportacion } from '@/lib/mihorario-server';
import { db } from '@/db';
import { mihExportaciones } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

/** Quita del calendario lo último que se exportó de un periodo. Un clic, no una tarde. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const profe = await getProfePorEmail(user.email);
  if (!profe) return NextResponse.json({ error: 'No enlazado' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const periodoId = String(body.periodoId ?? '');
  if (!periodoId) return NextResponse.json({ error: 'Falta el periodo' }, { status: 400 });

  // Su horario (por defecto) o el de a quien sustituye: cada uno se quita por separado.
  const deProfeId = body.deProfeId ? String(body.deProfeId) : null;
  const ultima = await getUltimaExportacion(profe.id, periodoId, deProfeId);
  if (!ultima) return NextResponse.json({ error: 'No hay nada exportado de este periodo' }, { status: 404 });
  if (!profe.email) return NextResponse.json({ error: 'Sin correo guardado, no se puede acceder a tu calendario' }, { status: 400 });

  const borrados = await borrarEventosDeOrigen(profe.email, ultima.calendarioGoogleId, claveExportacion(periodoId, deProfeId));
  await db
    .delete(mihExportaciones)
    .where(
      and(
        eq(mihExportaciones.eduTeacherId, profe.id),
        eq(mihExportaciones.periodoId, periodoId),
        deProfeId ? eq(mihExportaciones.deProfeId, deProfeId) : isNull(mihExportaciones.deProfeId),
      ),
    );

  return NextResponse.json({ borrados });
}
