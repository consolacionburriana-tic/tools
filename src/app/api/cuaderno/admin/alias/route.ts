import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { esCampo } from '@/lib/cuaderno/campos';
import { borrarAlias, guardarAlias } from '@/lib/cuaderno-server';

export const dynamic = 'force-dynamic';

/** Aprende (o corrige) a qué campo corresponde una etiqueta de una plantilla. */
export async function POST(request: Request) {
  const guard = await requireModule('cuaderno');
  if (isGuardResponse(guard)) return guard;
  try {
    const { alias } = z
      .object({
        alias: z
          .array(z.object({ etiqueta: z.string().trim().min(1).max(120), campo: z.string().trim().max(60) }))
          .min(1)
          .max(100),
      })
      .parse(await request.json());

    for (const entrada of alias) {
      if (entrada.campo === '') {
        await borrarAlias(entrada.etiqueta);
        continue;
      }
      if (!esCampo(entrada.campo)) {
        return NextResponse.json({ error: `«${entrada.campo}» no es un campo del catálogo` }, { status: 400 });
      }
      await guardarAlias(entrada.etiqueta, entrada.campo, guard.email);
    }
    return NextResponse.json({ ok: true, guardados: alias.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
