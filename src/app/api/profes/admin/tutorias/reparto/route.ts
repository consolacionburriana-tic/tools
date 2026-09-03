import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { confirmarReparto, getClasesConTutores, getRepartoClase, guardarReparto } from '@/lib/tutorias-server';

export const dynamic = 'force-dynamic';

// Reparto de alumnos entre los tutores de una clase (tutor personal de cada alumno).
// GET: la lista de la clase · PUT: el mapa completo · POST: confirmar/desconfirmar.

const claseSchema = z.object({ curso: z.string().min(1), letra: z.string().min(1).nullable().default(null) });

export async function GET(request: Request) {
  const guard = await requireModule('profes');
  if (isGuardResponse(guard)) return guard;
  try {
    const url = new URL(request.url);
    const { curso, letra } = claseSchema.parse({
      curso: url.searchParams.get('curso') ?? '',
      letra: url.searchParams.get('letra') || null,
    });
    return NextResponse.json({ ok: true, reparto: await getRepartoClase(curso, letra) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}

const guardarSchema = claseSchema.extend({
  // alumnoId → teacherId (o null para dejarlo sin tutor personal). El servidor descarta
  // lo que no cuadre con la clase real, así que el cliente puede mandar el mapa entero.
  reparto: z.record(z.string().uuid(), z.string().uuid().nullable()),
});

export async function PUT(request: Request) {
  const guard = await requireModule('profes');
  if (isGuardResponse(guard)) return guard;
  try {
    const { curso, letra, reparto } = guardarSchema.parse(await request.json());
    const asignados = await guardarReparto(curso, letra, reparto);
    return NextResponse.json({ ok: true, asignados, clases: await getClasesConTutores() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}

const confirmarSchema = claseSchema.extend({ confirmado: z.boolean().default(true) });

export async function POST(request: Request) {
  const guard = await requireModule('profes');
  if (isGuardResponse(guard)) return guard;
  try {
    const { curso, letra, confirmado } = confirmarSchema.parse(await request.json());
    const confirmadoAt = await confirmarReparto(curso, letra, guard.email, confirmado);
    return NextResponse.json({ ok: true, confirmadoAt, clases: await getClasesConTutores() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
