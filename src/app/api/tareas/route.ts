import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { crearTareaSchema } from '@/lib/tareas';
import { crearTarea, listarTareas } from '@/lib/tareas-server';

// Dos niveles: `tareas` lo ve y lo lleva todo; `tareas-reportar` solo apunta fallitos y ve
// los suyos (para saber si ya se arreglaron).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (canAccess(user, 'tareas')) return NextResponse.json({ tareas: await listarTareas() });
  if (canAccess(user, 'tareas-reportar')) {
    return NextResponse.json({ tareas: await listarTareas({ soloDe: user.email }) });
  }
  return NextResponse.json({ error: 'Sin permiso para este módulo' }, { status: 403 });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const parsed = crearTareaSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  }
  const gestiona = canAccess(user, 'tareas');
  const reporta = gestiona || canAccess(user, 'tareas-reportar');
  if (parsed.data.tipo === 'modulo' ? !gestiona : !reporta) {
    return NextResponse.json({ error: 'Sin permiso para este módulo' }, { status: 403 });
  }
  try {
    const tarea = await crearTarea(parsed.data, { email: user.email, nombre: user.nombre });
    return NextResponse.json({ tarea });
  } catch (error) {
    console.error('Error creando tarea:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se ha podido guardar' }, { status: 500 });
  }
}
