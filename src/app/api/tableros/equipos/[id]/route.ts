import { after, NextResponse } from 'next/server';
import { accionEquipoSchema } from '@/lib/tableros';
import { accionEquipo, avisarEquipo, borrarEquipo } from '@/lib/tableros-server';
import { fallo, guardTableros, isGuardResponse, leer } from '../../respuesta';

// Todo lo de un equipo (editar, miembros, crear y ordenar tableros) va por `accion`. Los
// permisos —miembro o admin del equipo— los mira `accionEquipo`, no el rol.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await guardTableros();
  if (isGuardResponse(user)) return user;
  const { id } = await params;
  const accion = await leer(request, accionEquipoSchema);
  if (accion instanceof NextResponse) return accion;
  try {
    const r = await accionEquipo(id, accion, user);
    if (r.nuevos?.length) {
      const nuevos = r.nuevos;
      after(() => avisarEquipo(id, nuevos, user));
    }
    return NextResponse.json({ ok: true, tableroId: r.tableroId ?? null, miembros: r.miembros ?? null });
  } catch (error) {
    return fallo(error, `equipo (${accion.accion})`);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await guardTableros();
  if (isGuardResponse(user)) return user;
  const { id } = await params;
  try {
    await borrarEquipo(id, user);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fallo(error, 'borrar equipo');
  }
}
