import { after, NextResponse } from 'next/server';
import { accionTarjetaSchema } from '@/lib/tableros';
import { accionTarjeta, avisarAsignacion, borrarTarjeta, seguimientoDe } from '@/lib/tableros-server';
import { fallo, guardTableros, isGuardResponse, leer } from '../../respuesta';

// El seguimiento (comentarios y actividad) de una tarjeta.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await guardTableros();
  if (isGuardResponse(user)) return user;
  const { id } = await params;
  try {
    return NextResponse.json({ seguimiento: await seguimientoDe(user.email, id) });
  } catch (error) {
    return fallo(error, 'seguimiento');
  }
}

// Editar, mover, archivar y comentar. Si se asigna a alguien, se le avisa por correo después
// de contestar (`after`): quien asigna no espera al correo.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await guardTableros();
  if (isGuardResponse(user)) return user;
  const { id } = await params;
  const accion = await leer(request, accionTarjetaSchema);
  if (accion instanceof NextResponse) return accion;
  try {
    const r = await accionTarjeta(id, accion, user);
    if (r.avisar) {
      const avisar = r.avisar;
      after(() => avisarAsignacion(avisar, user));
    }
    return NextResponse.json({ ok: true, tarjeta: r.tarjeta ?? null, seguimiento: r.seguimiento ?? null });
  } catch (error) {
    return fallo(error, `tarjeta (${accion.accion})`);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await guardTableros();
  if (isGuardResponse(user)) return user;
  const { id } = await params;
  try {
    await borrarTarjeta(id, user);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fallo(error, 'borrar tarjeta');
  }
}
