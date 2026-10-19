import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buscarAlumnos, vincularNouvingut } from '@/lib/nouvinguts-server';
import { conFicha, fallo, idValido, isGuardResponse, leer, requireModule } from '../../respuesta';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** Buscador de alumnos de la BBDD central para vincular a mano: `?q=`. */
export async function GET(request: Request, { params }: Ctx) {
  const guard = await requireModule('nouvinguts');
  if (isGuardResponse(guard)) return guard;
  const { id } = await params;
  if (!idValido(id)) return NextResponse.json({ error: 'Identificador no válido' }, { status: 400 });
  const q = (new URL(request.url).searchParams.get('q') ?? '').slice(0, 80);
  try {
    return NextResponse.json({ alumnos: await buscarAlumnos(q) });
  } catch (error) {
    return fallo(error, 'buscar');
  }
}

/**
 * Vincular a mano con su ficha de Educamos, cuando el emparejado de la sincronización no fue
 * único. Si esa alta ya había entrado sola, se funden y la respuesta trae el id que queda.
 */
export async function POST(request: Request, { params }: Ctx) {
  const guard = await requireModule('nouvinguts');
  if (isGuardResponse(guard)) return guard;
  const { id } = await params;
  if (!idValido(id)) return NextResponse.json({ error: 'Identificador no válido' }, { status: 400 });
  const cuerpo = await leer(request, z.object({ eduStudentId: z.string().uuid() }));
  if (cuerpo instanceof NextResponse) return cuerpo;
  try {
    const { id: queda } = await vincularNouvingut(id, cuerpo.eduStudentId);
    return await conFicha(queda, guard);
  } catch (error) {
    return fallo(error, 'vincular');
  }
}
