import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { crearMaterial } from '@/lib/materiales-server';
import { puedeGestionarMateriales } from '@/lib/permissions';
import { esquemaMaterial } from './esquema';

export const dynamic = 'force-dynamic';

/** Crea un material (una columna nueva de «Venta de materiales»). Secretaría, dirección y TIC. */
export async function POST(request: Request) {
  const guard = await requireModule('alumnado');
  if (isGuardResponse(guard)) return guard;
  if (!puedeGestionarMateriales(guard.role)) {
    return NextResponse.json({ error: 'Los materiales los crean secretaría, dirección o TIC' }, { status: 403 });
  }
  try {
    const datos = esquemaMaterial.parse(await request.json());
    const material = await crearMaterial(datos, guard.email);
    return NextResponse.json({ material });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
