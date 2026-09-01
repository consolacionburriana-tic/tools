import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { puedeGestionarParticipantesBanco } from '@/lib/permissions';
import { actualizarLibroManual, crearLibroManual, getLibrosManualesCurso } from '@/lib/bancolibros-server';

export const dynamic = 'force-dynamic';

async function guard() {
  const user = await requireModule('bancolibros');
  if (isGuardResponse(user)) return user;
  if (!puedeGestionarParticipantesBanco(user.role)) {
    return NextResponse.json({ error: 'Solo dirección/TIC pueden configurar el catálogo de libros' }, { status: 403 });
  }
  return user;
}

export async function GET(request: Request) {
  const guarded = await guard();
  if (isGuardResponse(guarded)) return guarded;
  const curso = new URL(request.url).searchParams.get('curso');
  if (!curso) return NextResponse.json({ error: 'Falta curso' }, { status: 400 });
  const libros = await getLibrosManualesCurso(curso);
  return NextResponse.json({ libros });
}

export async function POST(request: Request) {
  const guarded = await guard();
  if (isGuardResponse(guarded)) return guarded;
  try {
    const input = z
      .object({ curso: z.string().min(1), asignatura: z.string().trim().min(1).nullable(), nombre: z.string().trim().min(1) })
      .parse(await request.json());
    await crearLibroManual(input);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const guarded = await guard();
  if (isGuardResponse(guarded)) return guarded;
  try {
    const { id, campos } = z
      .object({
        id: z.string().uuid(),
        campos: z.object({
          asignatura: z.string().trim().min(1).nullable().optional(),
          nombre: z.string().trim().min(1).optional(),
          activo: z.boolean().optional(),
        }),
      })
      .parse(await request.json());
    await actualizarLibroManual(id, campos);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
