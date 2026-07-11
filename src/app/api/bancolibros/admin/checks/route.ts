import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasModule } from '@/lib/auth-guards';
import { setChecks } from '@/lib/bancolibros-server';

export async function POST(request: Request) {
  if (!(await hasModule('bancolibros'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const { asignacionIds, campos } = z
      .object({
        asignacionIds: z.array(z.string().uuid()).min(1),
        campos: z.object({ entregado: z.boolean().optional(), docInicio: z.boolean().optional(), docFin: z.boolean().optional() }),
      })
      .parse(await request.json());
    await setChecks(asignacionIds, campos);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
