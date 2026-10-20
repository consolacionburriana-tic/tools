import { NextResponse } from 'next/server';
import { csvCuotas, filasCuotas, libroCuotas } from '@/lib/dispositivos-exports';
import { panelDispositivos } from '@/lib/dispositivos-server';
import { escribirXlsx, MIME_XLSX } from '@/lib/xlsx-escribir';
import { fallo, guard, isGuardResponse } from '../respuesta';

export const dynamic = 'force-dynamic';

/** El listado de cuotas del día: `?formato=xlsx` (por defecto) o `csv`. Un GET para descargar con un enlace. */
export async function GET(request: Request) {
  const g = await guard();
  if (isGuardResponse(g)) return g;
  const formato = new URL(request.url).searchParams.get('formato') === 'csv' ? 'csv' : 'xlsx';
  try {
    const panel = await panelDispositivos();
    const filas = filasCuotas(panel.alumnos, panel.aparatos, panel.cursoActual);
    const nombre = `cuotas-ipad-${panel.cursoActual}-${new Date().toISOString().slice(0, 10)}`;
    // Datos personales en iPads compartidos: que no se quede en ninguna caché.
    if (formato === 'csv') {
      return new NextResponse(csvCuotas(filas), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${nombre}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }
    const xlsx = await escribirXlsx(libroCuotas(filas, panel.cursoActual));
    return new NextResponse(new Uint8Array(xlsx), {
      headers: { 'Content-Type': MIME_XLSX, 'Content-Disposition': `attachment; filename="${nombre}.xlsx"`, 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return fallo(error, 'cuotas');
  }
}
