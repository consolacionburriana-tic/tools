import { NextResponse } from 'next/server';
import { z } from 'zod';
import { autorDe, isGuardResponse, requireModule } from '@/lib/auth-guards';
import { academicYearActual } from '@/lib/constants';
import { PeticionRetoque } from '@/lib/sustituciones';
import { respuestaError } from '@/lib/sustituciones-api';
import { borrarRetoques, disponibilidad, guardarRetoque } from '@/lib/sustituciones-server';

export const dynamic = 'force-dynamic';

/** La rejilla de un profe (`?profeId=`) y la de la semana. */
export async function GET(request: Request) {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    const profeId = new URL(request.url).searchParams.get('profeId');
    return NextResponse.json(await disponibilidad(academicYearActual(), profeId && z.string().uuid().safeParse(profeId).success ? profeId : null));
  } catch (e) {
    return respuestaError(e, 'leer la disponibilidad');
  }
}

/** Guarda un retoque (o lo quita, con `estado: null` = «Automático»). */
export async function PUT(request: Request) {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    const r = PeticionRetoque.parse(await request.json());
    await guardarRetoque(academicYearActual(), r, autorDe(user));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respuestaError(e, 'guardar la disponibilidad');
  }
}

/** «Volver a lo del horario»: borra los retoques de un profe. */
export async function DELETE(request: Request) {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    const profeId = z.string().uuid().parse(new URL(request.url).searchParams.get('profeId'));
    return NextResponse.json({ borrados: await borrarRetoques(academicYearActual(), profeId) });
  } catch (e) {
    return respuestaError(e, 'volver a lo del horario');
  }
}
