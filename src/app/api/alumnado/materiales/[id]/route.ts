import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { editarMaterial, quitarMaterial } from '@/lib/materiales-server';
import { puedeGestionarMateriales } from '@/lib/permissions';
import { esquemaMaterial } from '../esquema';

export const dynamic = 'force-dynamic';

async function guardia(params: Promise<{ id: string }>) {
  const guard = await requireModule('alumnado');
  if (isGuardResponse(guard)) return { respuesta: guard };
  if (!puedeGestionarMateriales(guard.role)) {
    return {
      respuesta: NextResponse.json({ error: 'Los materiales los gestionan secretaría, dirección o TIC' }, { status: 403 }),
    };
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return { respuesta: NextResponse.json({ error: 'Identificador no válido' }, { status: 400 }) };
  }
  return { id };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardia(params);
  if (g.respuesta) return g.respuesta;
  try {
    const datos = esquemaMaterial.parse(await request.json());
    if (!(await editarMaterial(g.id, datos))) return NextResponse.json({ error: 'Ese material no existe' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}

/** Borra el material si está sin estrenar; si ya tiene pagos marcados, lo archiva. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardia(params);
  if (g.respuesta) return g.respuesta;
  const hecho = await quitarMaterial(g.id);
  if (!hecho) return NextResponse.json({ error: 'Ese material no existe' }, { status: 404 });
  return NextResponse.json({ hecho });
}
