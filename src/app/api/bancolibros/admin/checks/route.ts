import { NextResponse } from 'next/server';
import { z } from 'zod';
import { asignacionesEnAlcance, fueraDeAlcance, requireBanco } from '@/lib/bancolibros-alcance';
import { setChecks } from '@/lib/bancolibros-server';

export async function POST(request: Request) {
  const acceso = await requireBanco();
  if (acceso instanceof NextResponse) return acceso;
  try {
    const { asignacionIds, campos } = z
      .object({
        asignacionIds: z.array(z.string().uuid()).min(1),
        campos: z.object({ entregado: z.boolean().optional(), docInicio: z.boolean().optional(), docFin: z.boolean().optional() }),
      })
      .parse(await request.json());
    if (!(await asignacionesEnAlcance(acceso.etapas, asignacionIds))) return fueraDeAlcance();
    await setChecks(asignacionIds, campos);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
