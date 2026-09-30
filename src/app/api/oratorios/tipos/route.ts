import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { tipoSchema } from '@/lib/oratorios';
import { guardarTipo } from '@/lib/oratorios-server';

const cuerpo = z.object({ id: z.string().uuid().nullable(), tipo: tipoSchema });

// Crear o editar un tipo de momento (Oratorio, Godly Play, un taller…).
export async function POST(request: Request) {
  const guard = await requireModule('oratorios');
  if (isGuardResponse(guard)) return guard;
  const parsed = cuerpo.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  }
  try {
    const tipo = await guardarTipo(parsed.data.id, parsed.data.tipo);
    return NextResponse.json({ tipo });
  } catch (error) {
    const m = error instanceof Error ? error.message : String(error);
    console.error('Oratorios · tipo:', m);
    const duplicado = /duplicate|unique/i.test(m);
    return NextResponse.json({ error: duplicado ? 'Ya hay un tipo con ese código' : 'No se ha podido guardar' }, { status: duplicado ? 409 : 500 });
  }
}
