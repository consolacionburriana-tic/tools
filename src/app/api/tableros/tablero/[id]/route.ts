import { after, NextResponse } from 'next/server';
import { accionTableroSchema } from '@/lib/tableros';
import { accionTablero, avisarAsignacion, borrarTablero, datosTablero, tarjetasArchivadas } from '@/lib/tableros-server';
import { fallo, guardTableros, isGuardResponse, leer } from '../../respuesta';

// El tablero entero (o, con ?archivadas=1, solo sus tarjetas archivadas).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await guardTableros();
  if (isGuardResponse(user)) return user;
  const { id } = await params;
  try {
    if (new URL(request.url).searchParams.get('archivadas')) {
      return NextResponse.json({ tarjetas: await tarjetasArchivadas(user.email, id) });
    }
    const datos = await datosTablero(user.email, id);
    if (!datos) return NextResponse.json({ error: 'No existe o no estás en este equipo' }, { status: 404 });
    return NextResponse.json(datos);
  } catch (error) {
    return fallo(error, 'tablero');
  }
}

// Editar el tablero, sus etiquetas y sus listas, y crear tarjetas.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await guardTableros();
  if (isGuardResponse(user)) return user;
  const { id } = await params;
  const accion = await leer(request, accionTableroSchema);
  if (accion instanceof NextResponse) return accion;
  try {
    const r = await accionTablero(id, accion, user);
    if (r.avisar) {
      const avisar = r.avisar;
      after(() => avisarAsignacion(avisar, user));
    }
    return NextResponse.json({ ok: true, tarjeta: r.tarjeta ?? null, columnaId: r.columnaId ?? null });
  } catch (error) {
    return fallo(error, `tablero (${accion.accion})`);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await guardTableros();
  if (isGuardResponse(user)) return user;
  const { id } = await params;
  try {
    await borrarTablero(id, user);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fallo(error, 'borrar tablero');
  }
}
