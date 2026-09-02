import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { crearSubject, getSubjects, updateSubject } from '@/lib/puntualidad-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requireModule('puntualidad');
  if (isGuardResponse(guard)) return guard;
  return NextResponse.json({ asignaturas: await getSubjects() });
}

export async function POST(request: Request) {
  const guard = await requireModule('puntualidad');
  if (isGuardResponse(guard)) return guard;
  try {
    const datos = z
      .object({
        nombre: z.string().min(2).max(80),
        abreviatura: z.string().max(12).nullable().optional(),
        eduTeacherId: z.string().uuid().nullable().optional(),
      })
      .parse(await request.json());
    return NextResponse.json({ asignatura: await crearSubject(datos) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const guard = await requireModule('puntualidad');
  if (isGuardResponse(guard)) return guard;
  try {
    const { id, ...cambios } = z
      .object({
        id: z.string().uuid(),
        nombre: z.string().min(2).max(80).optional(),
        abreviatura: z.string().max(12).nullable().optional(),
        eduTeacherId: z.string().uuid().nullable().optional(),
        active: z.boolean().optional(),
        orden: z.number().int().optional(),
      })
      .parse(await request.json());
    await updateSubject(id, cambios);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
