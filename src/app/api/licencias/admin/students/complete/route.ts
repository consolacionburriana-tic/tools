import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasModule } from '@/lib/auth-guards';
import { setStudentsManualCompleted } from '@/lib/licencias-server';

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(1000),
  completed: z.boolean(),
  reason: z.string().max(200).optional(),
});

/** Marca (o desmarca) a mano varios alumnos de "Quién falta" de una vez. */
export async function POST(request: Request) {
  if (!(await hasModule('licencias'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 });
  const { ids, completed, reason } = parsed.data;
  await setStudentsManualCompleted(ids, completed, reason);
  return NextResponse.json({ ok: true, count: ids.length });
}
