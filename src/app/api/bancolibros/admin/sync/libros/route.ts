import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { puedeGestionarParticipantesBanco } from '@/lib/permissions';
import { getLibrosCursoSyncPlan, syncLibrosCursoFromSheet } from '@/lib/bancolibros-server';

export const dynamic = 'force-dynamic';

async function guard() {
  const user = await requireModule('bancolibros');
  if (isGuardResponse(user)) return user;
  if (!puedeGestionarParticipantesBanco(user.role)) {
    return NextResponse.json({ error: 'Solo dirección/TIC pueden sincronizar el catálogo de libros' }, { status: 403 });
  }
  return user;
}

// Vista previa (no escribe nada): qué cambiaría en bl_libros_curso si se sincroniza ahora
export async function GET() {
  const guarded = await guard();
  if (isGuardResponse(guarded)) return guarded;
  try {
    const plan = await getLibrosCursoSyncPlan();
    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    console.error('Error generando la vista previa de libros del banco:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Importa/actualiza el catálogo del banco por curso desde el Excel "BBDD Libros"
export async function POST() {
  const guarded = await guard();
  if (isGuardResponse(guarded)) return guarded;
  try {
    const result = await syncLibrosCursoFromSheet();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('Error sincronizando libros del banco desde el Excel:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
