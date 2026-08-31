import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';
import { buscarAlumnosParaAlta } from '@/lib/abc-server';

// Buscador de alta del panel: nombre, apellidos o NIA, mínimo 3 caracteres.
export async function GET(request: Request) {
  if (!(await hasModule('abc'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const q = new URL(request.url).searchParams.get('q') ?? '';
    return NextResponse.json(await buscarAlumnosParaAlta(q));
  } catch (error) {
    console.error('Error buscando alumnos:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
