import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { comprobarCarpetaBase, cuentaDeServicio, driveConfigurado, extraerIdDrive, urlCarpeta } from '@/lib/cuaderno/drive';
import { getAjustes, guardarAjustes } from '@/lib/cuaderno-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requireModule('cuaderno');
  if (isGuardResponse(guard)) return guard;
  return NextResponse.json({
    ajustes: await getAjustes(),
    drive: { configurado: driveConfigurado(), cuenta: cuentaDeServicio() },
  });
}

/**
 * Guarda la carpeta base. Se comprueba ANTES de aceptarla: que exista, que esté en una
 * unidad compartida y que la cuenta de servicio pueda escribir. Es el error que de otro
 * modo aparecería a mitad de las 125 carpetas.
 */
export async function POST(request: Request) {
  const guard = await requireModule('cuaderno');
  if (isGuardResponse(guard)) return guard;
  try {
    const datos = z
      .object({
        carpetaBase: z.string().trim().max(500).optional(),
        nombreCentro: z.string().trim().min(2).max(120).optional(),
        permisoTutores: z.enum(['reader', 'writer']).optional(),
      })
      .parse(await request.json());

    const cambios: Parameters<typeof guardarAjustes>[0] = {};
    if (datos.nombreCentro) cambios.nombreCentro = datos.nombreCentro;
    if (datos.permisoTutores) cambios.permisoTutores = datos.permisoTutores;

    let comprobacion: Awaited<ReturnType<typeof comprobarCarpetaBase>> | null = null;
    if (datos.carpetaBase !== undefined) {
      if (datos.carpetaBase === '') {
        cambios.carpetaBaseId = null;
        cambios.carpetaBaseUrl = null;
      } else {
        const id = extraerIdDrive(datos.carpetaBase);
        if (!id) return NextResponse.json({ error: 'No reconozco ese enlace de Drive' }, { status: 400 });
        comprobacion = await comprobarCarpetaBase(id);
        if (!comprobacion.ok) {
          return NextResponse.json({ error: comprobacion.error ?? 'No se puede usar esa carpeta' }, { status: 400 });
        }
        cambios.carpetaBaseId = id;
        cambios.carpetaBaseUrl = urlCarpeta(id);
      }
    }
    return NextResponse.json({ ajustes: await guardarAjustes(cambios), comprobacion });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
