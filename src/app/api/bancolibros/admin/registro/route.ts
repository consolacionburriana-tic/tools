import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser, hasModule } from '@/lib/auth-guards';
import { upsertRegistros } from '@/lib/bancolibros-server';

const ESTADOS = ['nuevo', 'mb', 'b', 'r', 'm', 'mojado'] as const;

// Valoración de un libro: acepta una o varias asignaciones (bulk "todos MB").
export async function POST(request: Request) {
  if (!(await hasModule('bancolibros'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const { asignacionIds, bookCod, campos } = z
      .object({
        asignacionIds: z.array(z.string().uuid()).min(1).max(60),
        bookCod: z.string().min(1),
        campos: z.object({
          estado: z.enum(ESTADOS).nullable().optional(),
          borrado: z.boolean().optional(),
          forrado: z.boolean().optional(),
          notas: z.string().nullable().optional(),
        }),
      })
      .parse(await request.json());
    const user = await getSessionUser();
    await upsertRegistros({ asignacionIds, bookCod, campos, revisorEmail: user?.email ?? '' });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
