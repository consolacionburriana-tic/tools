import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyFamilyStudent } from '@/lib/familias-server';
import { leerPrivado } from '@/lib/blob';
import { getJustificanteManualPathname, getJustificantePathname } from '@/lib/salidas-server';

export const dynamic = 'force-dynamic';

// Sirve a la propia familia el justificante que ya subió, para poder revisarlo sin
// tener que volver a mandarlo a ciegas. Misma revalidación que al subir: nunca nos
// fiamos del alumno que dice el cliente, se comprueba contra la BBDD central.
export async function POST(request: Request) {
  try {
    const input = z
      .object({
        tripId: z.string().min(1),
        identificador: z.string().optional(),
        eduStudentId: z.string().optional(),
        manualNombre: z.string().optional(),
        manualClase: z.string().optional(),
      })
      .parse(await request.json());

    let pathname: string | null;
    if (input.eduStudentId) {
      if (!input.identificador) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
      const hijo = await verifyFamilyStudent(input.identificador, input.eduStudentId);
      if (!hijo) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      pathname = await getJustificantePathname(input.tripId, input.eduStudentId);
    } else if (input.manualNombre && input.manualClase) {
      pathname = await getJustificanteManualPathname(input.tripId, input.manualNombre, input.manualClase);
    } else {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    if (!pathname) return NextResponse.json({ error: 'Sin justificante' }, { status: 404 });
    const res = await leerPrivado(pathname);
    const headers = new Headers();
    res.headers.forEach((v, k) => headers.set(k, v));
    return new Response(res.stream as unknown as ReadableStream, { headers });
  } catch (error) {
    console.error('Error sirviendo justificante a la familia:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
