import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { actualizarTareaSchema } from '@/lib/tareas';
import { actualizarTarea, borrarTarea } from '@/lib/tareas-server';

// Cambiar estado, editar y borrar es solo de quien lleva el tablero (`tareas`).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('tareas');
  if (isGuardResponse(guard)) return guard;
  const { id } = await params;
  const parsed = actualizarTareaSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  }
  try {
    const tarea = await actualizarTarea(id, parsed.data);
    if (!tarea) return NextResponse.json({ error: 'No existe' }, { status: 404 });
    return NextResponse.json({ tarea });
  } catch (error) {
    console.error('Error actualizando tarea:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se ha podido guardar' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('tareas');
  if (isGuardResponse(guard)) return guard;
  const { id } = await params;
  try {
    await borrarTarea(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error borrando tarea:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se ha podido borrar' }, { status: 500 });
  }
}
