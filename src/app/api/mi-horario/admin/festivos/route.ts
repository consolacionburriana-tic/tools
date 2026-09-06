import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth-guards';
import { puedeEditarHorarios } from '@/lib/permissions';
import { academicYearActual } from '@/lib/constants';
import { crearFestivo, eliminarFestivo, getFestivos } from '@/lib/mihorario-server';

/**
 * Calendario de festivos del centro: COMPARTIDO. Cualquiera con `mi-horario` los LEE (para
 * que su exportación no cree eventos en días sin clase); solo quien edita horarios los
 * ESCRIBE — son los mismos festivos para todo el claustro, no conviene que cualquiera los
 * toque. El primero que los mete los deja puestos para los demás.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const academicYear = new URL(req.url).searchParams.get('year') ?? academicYearActual();
  return NextResponse.json({ festivos: await getFestivos(academicYear) });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || !puedeEditarHorarios(user.role)) {
    return NextResponse.json({ error: 'No tienes permiso para editar el calendario de festivos' }, { status: 403 });
  }
  const body = await req.json();
  if (!body.nombre || !body.fechaInicio || !body.fechaFin) {
    return NextResponse.json({ error: 'Faltan nombre, fecha de inicio o fecha de fin' }, { status: 400 });
  }
  if (body.fechaFin < body.fechaInicio) {
    return NextResponse.json({ error: 'La fecha de fin no puede ser anterior a la de inicio' }, { status: 400 });
  }
  const festivo = await crearFestivo({
    academicYear: body.academicYear ?? academicYearActual(),
    nombre: body.nombre,
    fechaInicio: body.fechaInicio,
    fechaFin: body.fechaFin,
    tipo: body.tipo,
    notas: body.notas,
  });
  return NextResponse.json({ festivo });
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user || !puedeEditarHorarios(user.role)) {
    return NextResponse.json({ error: 'No tienes permiso para editar el calendario de festivos' }, { status: 403 });
  }
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
  await eliminarFestivo(id);
  return NextResponse.json({ ok: true });
}
