import { NextResponse } from 'next/server';
import { identifyFamily } from '@/lib/familias-server';

// Identificación de la familia (DNI tutor / NIA / token). Respuesta enmascarada.
export async function POST(request: Request) {
  try {
    const { identificador } = (await request.json()) as { identificador?: string };
    if (!identificador?.trim()) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    const identity = await identifyFamily(identificador);
    return NextResponse.json({ hijos: identity?.hijos ?? [] });
  } catch (error) {
    console.error('Error en identify de salidas:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
