import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { academicYearActual, faltasPorPlantilla, getAjustes } from '@/lib/cuaderno-server';
import { planificarTirada } from '@/lib/cuaderno/tirada';
import { driveConfigurado } from '@/lib/cuaderno/drive';

export const dynamic = 'force-dynamic';

const cuerpo = z.object({
  clases: z.array(z.object({ curso: z.string().min(1), letra: z.string().nullable() })).max(200),
  plantillaIds: z.array(z.string().uuid()).max(50),
  soloSinHoja: z.boolean().default(false),
});

/**
 * Vista previa: qué documentos saldrían y qué impide lanzarlo. Es la pantalla que evita
 * disparar 125 documentos y descubrir después que faltaba mapear una etiqueta.
 */
export async function POST(request: Request) {
  const guard = await requireModule('cuaderno');
  if (isGuardResponse(guard)) return guard;
  try {
    const datos = cuerpo.parse(await request.json());
    const academicYear = academicYearActual();
    const ajustes = await getAjustes();
    const faltanPorPlantilla = datos.soloSinHoja ? await faltasPorPlantilla(academicYear) : undefined;
    const plan = await planificarTirada({ ...datos, faltanPorPlantilla });

    if (!driveConfigurado()) plan.bloqueos.unshift('Falta la cuenta de servicio de Google en el entorno.');
    if (!ajustes.carpetaBaseId) plan.bloqueos.unshift('Falta la carpeta base de Drive en los ajustes.');
    return NextResponse.json({ ...plan, academicYear });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
