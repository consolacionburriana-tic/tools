import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';
import { getDirectorioDestinatarios } from '@/lib/abc-server';

// Personas a las que se puede avisar de un registro: sugeridos (orientación + tutor/a
// del alumno) y el claustro entero para el buscador.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasModule('abc'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const { id } = await params;
    return NextResponse.json(await getDirectorioDestinatarios(id));
  } catch (error) {
    console.error('Error cargando destinatarios:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
