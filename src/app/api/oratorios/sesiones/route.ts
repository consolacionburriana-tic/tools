import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { crearSesionesSchema } from '@/lib/oratorios';
import { crearSesiones, ErrorDeEntrada } from '@/lib/oratorios-server';

// Borradores nuevos (uno a uno desde el hueco, o en bloque desde «Autocompletar»).
export async function POST(request: Request) {
  const guard = await requireModule('oratorios');
  if (isGuardResponse(guard)) return guard;
  const parsed = crearSesionesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  }
  try {
    const sesiones = await crearSesiones(parsed.data.sesiones, { email: guard.email, nombre: guard.nombre });
    return NextResponse.json({ sesiones });
  } catch (error) {
    if (error instanceof ErrorDeEntrada) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Oratorios · crear:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se ha podido guardar' }, { status: 500 });
  }
}
