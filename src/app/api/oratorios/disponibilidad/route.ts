import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { disponibilidadSchema } from '@/lib/oratorios';
import { guardarDisponibilidad } from '@/lib/oratorios-server';

// La rejilla entera de una persona responsable (se guarda como foto: lo que hay en pantalla).
export async function PUT(request: Request) {
  const guard = await requireModule('oratorios');
  if (isGuardResponse(guard)) return guard;
  const parsed = disponibilidadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  }
  try {
    const huecos = await guardarDisponibilidad(parsed.data.responsableEmail, parsed.data.huecos);
    return NextResponse.json({ huecos });
  } catch (error) {
    console.error('Oratorios · disponibilidad:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se ha podido guardar' }, { status: 500 });
  }
}
