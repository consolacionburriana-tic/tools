import { NextResponse } from 'next/server';
import { verifyFamilyStudent } from '@/lib/familias-server';
import { marcarNoVa } from '@/lib/salidas-server';

// La familia marca que el alumno no irá a la salida (deja de contar como pendiente).
export async function POST(request: Request) {
  try {
    const { identificador, eduStudentId, tripId } = (await request.json()) as {
      identificador?: string;
      eduStudentId?: string;
      tripId?: string;
    };
    if (!identificador?.trim() || !eduStudentId || !tripId) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }
    const hijo = await verifyFamilyStudent(identificador, eduStudentId);
    if (!hijo) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    await marcarNoVa(tripId, eduStudentId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error marcando no-va:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
