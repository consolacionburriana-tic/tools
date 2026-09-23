import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { alcanceAlumnado, alcanceProteccion, listaAlumnado } from '@/lib/alumnado-server';
import {
  construirInforme,
  informeCsv,
  nombreFichero,
  type ClaveColumna,
  type FiltroInforme,
} from '@/lib/alumnado-informe';
import { informePdf, informeXlsx } from '@/lib/alumnado-informe-formatos';
import { MIME_XLSX } from '@/lib/xlsx-escribir';
import { veBecasMateriales } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const parametros = z.object({
  formato: z.enum(['pdf', 'xlsx', 'csv']),
  // «2ESO|B,3ESO|A». Vacío = todo lo que alcanza quien pide.
  clases: z.string().max(2000).default(''),
  columnas: z.string().min(1, 'Elige al menos una columna').max(2000),
  // «banco:si». Vacío = sin filtro.
  filtro: z.string().max(200).default(''),
  titulo: z.string().max(120).default(''),
  agrupar: z.enum(['1', '0']).default('1'),
  paginaPorClase: z.enum(['1', '0']).default('1'),
});

/**
 * El informe a medida de Alumnado, en PDF, Excel o CSV. Es un GET para que el navegador lo
 * descargue con un enlace normal.
 *
 * Todo lo que recorta se recorta AQUÍ, con la misma función que pinta la pantalla
 * (`listaAlumnado`): el alcance por etapa, la protección de datos que no te toca (sale en
 * blanco) y las becas (salen como «pagado» a quien no deba verlas). Pedir un informe no da
 * acceso a nada que no se vea ya en la pantalla.
 */
export async function GET(request: Request) {
  const guard = await requireModule('alumnado');
  if (isGuardResponse(guard)) return guard;

  const url = new URL(request.url);
  const leido = parametros.safeParse(Object.fromEntries(url.searchParams));
  if (!leido.success) {
    return NextResponse.json({ error: leido.error.issues[0]?.message ?? 'Parámetros no válidos' }, { status: 400 });
  }
  const p = leido.data;

  const alcance = await alcanceAlumnado(guard);
  const pd = alcanceProteccion(guard, alcance.propias);
  const { alumnos, clases, materiales } = await listaAlumnado(alcance.clases, undefined, pd, veBecasMateriales(guard.role));

  const pedidas = new Set(p.clases.split(',').map((c) => c.trim()).filter(Boolean));
  const clave = (c: { curso: string; letra: string | null }) => `${c.curso}|${c.letra ?? ''}`;
  const elegidas = pedidas.size > 0 ? clases.filter((c) => pedidas.has(clave(c))) : clases;
  if (elegidas.length === 0) return NextResponse.json({ error: 'Ninguna de esas clases te toca' }, { status: 404 });
  const claves = new Set(elegidas.map(clave));

  const ambito =
    elegidas.length === clases.length && clases.length > 1
      ? alcance.clases === null
        ? 'Todo el centro'
        : `${clases.length} clases`
      : elegidas.length <= 4
        ? elegidas.map((c) => c.clase).join(', ')
        : `${elegidas.length} clases`;

  const [filtroCol, filtroValor] = p.filtro.split(':');
  const filtro: FiltroInforme | null =
    filtroCol && filtroValor ? { columna: filtroCol as ClaveColumna, valor: filtroValor } : null;

  const informe = construirInforme({
    alumnos: alumnos.filter((a) => claves.has(clave(a))),
    columnas: p.columnas.split(',').map((c) => c.trim()) as ClaveColumna[],
    materiales,
    filtro,
    titulo: p.titulo,
    ambito,
    sinAgrupar: p.agrupar === '0',
    tutores: Object.fromEntries(elegidas.map((c) => [c.clase, c.tutores])),
  });
  if (informe.columnas.length === 0) {
    return NextResponse.json({ error: 'Elige al menos una columna' }, { status: 400 });
  }

  // `no-store`: son datos personales y los iPads del claustro son compartidos.
  const cabeceras = (tipo: string, extension: string) => ({
    'Content-Type': tipo,
    'Content-Disposition': `attachment; filename="${nombreFichero(informe, extension)}"`,
    'Cache-Control': 'no-store',
  });

  if (p.formato === 'csv') {
    return new NextResponse(informeCsv(informe), { headers: cabeceras('text/csv; charset=utf-8', 'csv') });
  }
  if (p.formato === 'xlsx') {
    const buffer = await informeXlsx(informe);
    return new NextResponse(new Uint8Array(buffer), { headers: cabeceras(MIME_XLSX, 'xlsx') });
  }
  const bytes = await informePdf(informe, { paginaPorClase: p.paginaPorClase === '1' });
  return new NextResponse(Buffer.from(bytes), { headers: cabeceras('application/pdf', 'pdf') });
}
