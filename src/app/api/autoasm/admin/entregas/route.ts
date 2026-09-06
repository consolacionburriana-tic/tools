import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { getEntregas, marcarSubida, registrarEntrega } from '@/lib/autoasm-entregas';

export const dynamic = 'force-dynamic';

const recuentos = z.object({
  alumnos: z.number().int().nonnegative(),
  profes: z.number().int().nonnegative(),
  cursos: z.number().int().nonnegative(),
  clases: z.number().int().nonnegative(),
  matriculas: z.number().int().nonnegative(),
});

const nueva = z.object({
  modo: z.enum(['descargado', 'ftp', 'manual']),
  desdeCurso: z.string().nullable().optional(),
  recuentos,
  errores: z.number().int().nonnegative().optional(),
  avisos: z.number().int().nonnegative().optional(),
  fichero: z.string().nullable().optional(),
  detalle: z.string().nullable().optional(),
});

const marcar = z.object({ id: z.string().uuid(), modo: z.enum(['ftp', 'manual']), detalle: z.string().nullable().optional() });

async function usuario() {
  const user = await getSessionUser();
  return user && canAccess(user, 'autoasm') ? user : null;
}

/** El histórico: qué día se generó el fichero y si llegó a subirse. */
export async function GET() {
  if (!(await usuario())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    return NextResponse.json({ entregas: await getEntregas() });
  } catch (error) {
    console.error('AUTOASM: error leyendo el histórico:', error);
    return NextResponse.json({ error: 'Error leyendo el histórico' }, { status: 500 });
  }
}

/** Se apunta una entrega nueva (normalmente, al descargar el ZIP). */
export async function POST(request: Request) {
  const user = await usuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const datos = nueva.parse(await request.json());
    const entrega = await registrarEntrega({ ...datos, quien: user.email });
    return NextResponse.json({ entrega });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Datos incorrectos' }, { status: 400 });
    console.error('AUTOASM: error registrando la entrega:', error);
    return NextResponse.json({ error: 'Error registrando la entrega' }, { status: 500 });
  }
}

/** "Ya lo he subido yo a mano": convierte una descarga en una entrega de verdad. */
export async function PATCH(request: Request) {
  const user = await usuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const { id, modo, detalle } = marcar.parse(await request.json());
    await marcarSubida(id, modo, detalle ?? `Marcado a mano por ${user.email}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Datos incorrectos' }, { status: 400 });
    console.error('AUTOASM: error marcando la entrega:', error);
    return NextResponse.json({ error: 'Error marcando la entrega' }, { status: 500 });
  }
}
