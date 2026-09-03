import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { REPETICIONES } from '@/lib/cuaderno/campos';
import { extraerIdDrive, infoArchivo, MIME_GDOC } from '@/lib/cuaderno/drive';
import { crearPlantilla, getPlantillas } from '@/lib/cuaderno-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requireModule('cuaderno');
  if (isGuardResponse(guard)) return guard;
  return NextResponse.json({ plantillas: await getPlantillas() });
}

/**
 * Alta de plantilla a partir de su URL de Google Docs. Se comprueba que la cuenta de
 * servicio la puede leer (si no, el mensaje dice exactamente qué compartir y con quién) y
 * se coge el nombre del propio documento si no se da otro.
 */
export async function POST(request: Request) {
  const guard = await requireModule('cuaderno');
  if (isGuardResponse(guard)) return guard;
  try {
    const datos = z
      .object({
        url: z.string().trim().min(10).max(500),
        nombre: z.string().trim().max(120).optional(),
        repeticion: z.enum(REPETICIONES).default('alumno'),
        etapa: z.enum(['EI', 'EP', 'ESO']).nullable().default(null),
        generaPdf: z.boolean().default(true),
        saltoDePagina: z.boolean().default(true),
      })
      .parse(await request.json());

    const googleDocId = extraerIdDrive(datos.url);
    if (!googleDocId) return NextResponse.json({ error: 'No reconozco ese enlace de Google Docs' }, { status: 400 });

    let nombre = datos.nombre;
    try {
      const info = await infoArchivo(googleDocId);
      if (info.mimeType !== MIME_GDOC) {
        return NextResponse.json(
          { error: 'Ese enlace no es un documento de Google Docs. Si es un .docx, ábrelo y usa «Guardar como Documento de Google».' },
          { status: 400 },
        );
      }
      if (!nombre) nombre = info.nombre;
    } catch {
      return NextResponse.json(
        { error: 'No puedo abrir esa plantilla: compártela (como lector) con la cuenta de servicio del módulo.' },
        { status: 400 },
      );
    }

    const plantilla = await crearPlantilla({
      nombre: nombre || 'Plantilla sin nombre',
      googleDocId,
      repeticion: datos.repeticion,
      etapa: datos.etapa,
      generaPdf: datos.generaPdf,
      saltoDePagina: datos.saltoDePagina,
    });
    return NextResponse.json({ plantilla });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
