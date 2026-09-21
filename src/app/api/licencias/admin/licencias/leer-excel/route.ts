import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';
import { analizarExcel } from '@/lib/licencias-codigos-excel';

export const maxDuration = 60;

const LIMITE = 10 * 1024 * 1024; // 10 MB, como el resto de subidas del repo

/**
 * Lee el Excel de la editorial y devuelve los códigos. NO toca la base de datos: la pantalla
 * enseña la vista previa y solo entonces se asignan, igual que con el pegado. El fichero no se
 * guarda en ningún sitio.
 */
export async function POST(request: Request) {
  if (!(await hasModule('licencias'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const form = await request.formData();
    const fichero = form.get('fichero');
    if (!(fichero instanceof File)) return NextResponse.json({ error: 'Falta el fichero' }, { status: 400 });
    if (fichero.size > LIMITE) return NextResponse.json({ error: 'El fichero pasa de 10 MB' }, { status: 413 });
    const hoja = typeof form.get('hoja') === 'string' ? (form.get('hoja') as string) : undefined;
    const columnaCruda = form.get('columna');
    const columna = typeof columnaCruda === 'string' && columnaCruda !== '' ? Number(columnaCruda) : undefined;

    const r = analizarExcel(await fichero.arrayBuffer(), {
      hoja,
      columna: Number.isInteger(columna) ? columna : undefined,
    });
    return NextResponse.json({
      hoja: r.hoja,
      hojas: r.hojas,
      columnaSugerida: r.columnaSugerida,
      codigos: r.codigos,
      // Solo las primeras filas, para que se vea qué columna se ha elegido.
      muestra: r.filas.slice(0, 12),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se ha podido leer el fichero';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
