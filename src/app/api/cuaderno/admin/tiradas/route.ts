import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import {
  academicYearActual,
  crearTirada,
  faltasPorPlantilla,
  getAjustes,
  listarTiradas,
} from '@/lib/cuaderno-server';
import { despertarWorker, planificarTirada } from '@/lib/cuaderno/tirada';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requireModule('cuaderno');
  if (isGuardResponse(guard)) return guard;
  return NextResponse.json({ tiradas: await listarTiradas() });
}

const cuerpo = z.object({
  clases: z.array(z.object({ curso: z.string().min(1), letra: z.string().nullable() })).min(1).max(200),
  plantillaIds: z.array(z.string().uuid()).min(1).max(50),
  formatos: z.array(z.enum(['doc', 'pdf'])).min(1).default(['doc', 'pdf']),
  cuadernoCompletoPdf: z.boolean().default(false),
  compartir: z.boolean().default(true),
  avisarPorCorreo: z.boolean().default(false),
  soloSinHoja: z.boolean().default(false),
  subcarpetaPropia: z.boolean().default(false),
});

/**
 * Lanza una tirada: crea la cola en Neon, despierta al worker y contesta al momento con el
 * id para que el panel siga el progreso. Nada de esto depende de que la pestaña siga
 * abierta: el trabajo lo hace el servidor.
 */
export async function POST(request: Request) {
  const guard = await requireModule('cuaderno');
  if (isGuardResponse(guard)) return guard;
  try {
    const datos = cuerpo.parse(await request.json());
    const academicYear = academicYearActual();
    const ajustes = await getAjustes();
    if (!ajustes.carpetaBaseId) {
      return NextResponse.json({ error: 'Antes hay que fijar la carpeta base de Drive en los ajustes.' }, { status: 400 });
    }

    const faltanPorPlantilla = datos.soloSinHoja ? await faltasPorPlantilla(academicYear) : undefined;

    const plan = await planificarTirada({
      clases: datos.clases,
      plantillaIds: datos.plantillaIds,
      soloSinHoja: datos.soloSinHoja,
      faltanPorPlantilla,
    });
    if (plan.bloqueos.length > 0) {
      return NextResponse.json({ error: plan.bloqueos.join(' · '), bloqueos: plan.bloqueos }, { status: 400 });
    }

    const tirada = await crearTirada({
      academicYear,
      opciones: {
        formatos: datos.formatos,
        cuadernoCompletoPdf: datos.cuadernoCompletoPdf,
        compartir: datos.compartir,
        avisarPorCorreo: datos.avisarPorCorreo,
        soloSinHoja: datos.soloSinHoja,
        subcarpetaPropia: datos.subcarpetaPropia,
      },
      lanzadaPor: guard.email,
      items: plan.items,
    });
    despertarWorker(tirada.id);
    return NextResponse.json({ tirada, total: plan.items.length, avisos: plan.avisos });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
