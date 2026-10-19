import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { cuadNumeracion } from '@/db/schema';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { alcanceAlumnado } from '@/lib/alumnado-server';
import { libroDeListaRapida, nombreListaRapida, numerosSinCongelar, TIPOS_LISTA } from '@/lib/alumnado-listas';
import { academicYearActual } from '@/lib/constants';
import { claveClase } from '@/lib/cuaderno/lista-clase';
import { getClasesCuaderno } from '@/lib/cuaderno-server';
import { escribirXlsx, MIME_XLSX } from '@/lib/xlsx-escribir';

export const dynamic = 'force-dynamic';

const parametros = z.object({
  tipo: z.enum(TIPOS_LISTA),
  // «2ESO|B,3ESO|A». Vacío = todo lo que alcanza quien pide.
  clases: z.string().max(2000).default(''),
});

/**
 * Las listas rápidas de Alumnado (`alumnado-listas.ts`): la lista de clase del cuaderno, los
 * correos del alumnado o los de las familias, en Excel. Un GET para que el navegador lo
 * descargue con un enlace normal.
 *
 * El alcance es el de la pantalla (`alcanceAlumnado`: la etapa de quien pide), y se vuelve a
 * mirar aquí: una clase que no te toca no se descarga aunque se pida a mano en la URL.
 */
export async function GET(request: Request) {
  const guard = await requireModule('alumnado');
  if (isGuardResponse(guard)) return guard;

  const leido = parametros.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!leido.success) {
    return NextResponse.json({ error: leido.error.issues[0]?.message ?? 'Parámetros no válidos' }, { status: 400 });
  }
  const p = leido.data;

  const pedidas = p.clases
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const [curso, letra] = c.split('|');
      return { curso, letra: letra || null };
    });

  const alcance = await alcanceAlumnado(guard, { conPropias: false });
  const alcanzables = alcance.clases === null ? null : new Set(alcance.clases.map(claveClase));
  const quiere = pedidas.length > 0 ? pedidas : (alcance.clases ?? undefined);
  const elegidas = (quiere ?? []).filter((c) => alcanzables === null || alcanzables.has(claveClase(c)));
  if (quiere && elegidas.length === 0) {
    return NextResponse.json({ error: 'Ninguna de esas clases te toca' }, { status: 404 });
  }

  const academicYear = academicYearActual();
  const [clases, congelados] = await Promise.all([
    getClasesCuaderno(quiere ? { clases: elegidas } : undefined),
    db
      .select({ eduStudentId: cuadNumeracion.eduStudentId, numero: cuadNumeracion.numero })
      .from(cuadNumeracion)
      .where(eq(cuadNumeracion.academicYear, academicYear)),
  ]);
  if (clases.length === 0) return NextResponse.json({ error: 'Ahí no hay alumnado activo' }, { status: 404 });

  const numeroDe = new Map(congelados.map((f) => [f.eduStudentId, f.numero]));
  const numerosPorClase = new Map(clases.map((c) => [claveClase(c), numerosSinCongelar(c.alumnos, numeroDe)]));
  const xlsx = await escribirXlsx(libroDeListaRapida(p.tipo, clases, numerosPorClase));

  return new NextResponse(new Uint8Array(xlsx), {
    headers: {
      'Content-Type': MIME_XLSX,
      'Content-Disposition': `attachment; filename="${nombreListaRapida(p.tipo, clases, academicYear)}"`,
      // Datos personales en iPads compartidos: que no se quede en ninguna caché.
      'Cache-Control': 'no-store',
    },
  });
}
