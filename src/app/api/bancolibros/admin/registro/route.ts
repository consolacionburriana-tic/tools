import { NextResponse } from 'next/server';
import { z } from 'zod';
import { asignacionesEnAlcance, fueraDeAlcance, requireBanco } from '@/lib/bancolibros-alcance';
import { upsertRegistros } from '@/lib/bancolibros-server';

const ESTADOS = ['nuevo', 'mb', 'b', 'r', 'm', 'mojado'] as const;

// Valoración de un libro: acepta una o varias asignaciones (bulk "todos MB").
export async function POST(request: Request) {
  const acceso = await requireBanco();
  if (acceso instanceof NextResponse) return acceso;
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
    if (!(await asignacionesEnAlcance(acceso.etapas, asignacionIds))) return fueraDeAlcance();
    await upsertRegistros({ asignacionIds, bookCod, campos, revisorEmail: acceso.user.email });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
