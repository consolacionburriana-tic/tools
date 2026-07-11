import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasModule } from '@/lib/auth-guards';
import { asignarLote } from '@/lib/bancolibros-server';

export async function POST(request: Request) {
  if (!(await hasModule('bancolibros'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const input = z
      .object({
        curso: z.string().min(1),
        letra: z.string().nullable(),
        eduStudentId: z.string().uuid(),
        numero: z.union([z.number().int().min(1).max(999), z.literal('auto'), z.null()]),
      })
      .parse(await request.json());
    const res = await asignarLote(input);
    return NextResponse.json({ ok: true, ...res });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
