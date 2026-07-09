import { NextResponse } from 'next/server';
import { parseEducamosFile } from '@/lib/educamos';
import { buildSyncPlan, isEducamosAdmin } from '@/lib/educamos-server';

export const dynamic = 'force-dynamic';

// Vista previa del sync (no escribe nada): sube el fichero, se parsea en memoria
// (nunca se persiste) y se devuelve el plan con los 4 cubos.
export async function POST(request: Request) {
  if (!(await isEducamosAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Falta el fichero' }, { status: 400 });
    const respetarCursoDe = form.get('respetarCursoDe') === 'excel' ? 'excel' : 'bbdd';

    const parsed = parseEducamosFile(Buffer.from(await file.arrayBuffer()), file.name);
    const plan = await buildSyncPlan(parsed.rows, { respetarCursoDe }, parsed.warnings);
    return NextResponse.json({
      ok: true,
      formato: parsed.formato,
      totalFilas: parsed.rows.length,
      cabecerasExtra: parsed.cabecerasExtra,
      cabecerasDescartadas: parsed.cabecerasDescartadas,
      plan,
    });
  } catch (error) {
    console.error('Error en la vista previa del sync de Educamos:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
