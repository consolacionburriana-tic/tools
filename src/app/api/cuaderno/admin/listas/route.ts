import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { academicYearActual, registrarEvento } from '@/lib/cuaderno-server';
import { generarListas, previoListas } from '@/lib/cuaderno/listas';

export const dynamic = 'force-dynamic';
// A diferencia de una tirada, esto no tiene cola: se hace entero aquí. Cada clase es una
// subida a Drive (~1-2 s), así que el techo de 60 s da para todo el centro de sobra; si
// algún día no diera, la que falte se vuelve a pedir y las que ya estaban se reescriben.
export const maxDuration = 60;

const clase = z.object({ curso: z.string().min(1), letra: z.string().nullable() });

const cuerpo = z.object({
  clases: z.array(clase).min(1).max(200),
  unSoloArchivo: z.boolean().default(false),
  compartir: z.boolean().default(true),
  avisarPorCorreo: z.boolean().default(false),
});

/** Vista previa: qué hojas saldrían y con cuántos alumnos, sin tocar Drive. */
export async function POST(request: Request) {
  const guard = await requireModule('cuaderno');
  if (isGuardResponse(guard)) return guard;
  try {
    const datos = cuerpo.parse(await request.json());
    const academicYear = academicYearActual();
    const resultado = await generarListas({
      academicYear,
      clases: datos.clases,
      unSoloArchivo: datos.unSoloArchivo,
      // Un archivo con varias clases dentro no se comparte con nadie automáticamente:
      // lo reparte quien lo pidió (ver `archivoUnico` en `src/lib/cuaderno/listas.ts`).
      compartir: datos.compartir && !datos.unSoloArchivo,
      avisarPorCorreo: datos.avisarPorCorreo && !datos.unSoloArchivo,
    });

    await registrarEvento({
      fase: 'listas',
      nivel: resultado.errores.length > 0 ? 'aviso' : 'info',
      mensaje:
        `Listas en Excel generadas por ${guard.email}: ${resultado.listas.length} archivo(s), ` +
        `${datos.clases.length} clase(s)${resultado.errores.length > 0 ? `, ${resultado.errores.length} con error` : ''}`,
      datos: {
        unSoloArchivo: datos.unSoloArchivo,
        archivos: resultado.listas.map((l) => ({ nombre: l.nombre, url: l.url, alumnos: l.alumnos })),
        errores: resultado.errores,
      },
    });

    return NextResponse.json(resultado);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}

/** Vista previa (`?previo=1` con las clases en el cuerpo no vale: GET no lleva cuerpo). */
export async function PUT(request: Request) {
  const guard = await requireModule('cuaderno');
  if (isGuardResponse(guard)) return guard;
  try {
    const datos = z.object({ clases: z.array(clase).min(1).max(200) }).parse(await request.json());
    return NextResponse.json({ previo: await previoListas(datos.clases) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
