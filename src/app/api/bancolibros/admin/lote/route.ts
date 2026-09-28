import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cursoEnAlcance, fueraDeAlcance, requireBanco } from '@/lib/bancolibros-alcance';
import { asignarLote } from '@/lib/bancolibros-server';

export async function POST(request: Request) {
  const acceso = await requireBanco();
  if (acceso instanceof NextResponse) return acceso;
  try {
    const input = z
      .object({
        curso: z.string().min(1),
        letra: z.string().nullable(),
        eduStudentId: z.string().uuid(),
        numero: z.union([z.number().int().min(1).max(999), z.literal('auto'), z.null()]),
      })
      .parse(await request.json());
    if (!cursoEnAlcance(acceso.etapas, input.curso)) return fueraDeAlcance();
    const res = await asignarLote(input);
    return NextResponse.json({ ok: true, ...res });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
