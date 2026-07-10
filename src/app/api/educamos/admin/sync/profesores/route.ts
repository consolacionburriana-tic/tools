import { NextResponse } from 'next/server';
import { parseProfesoresFile } from '@/lib/educamos';
import { aplicarSyncProfesores, isEducamosAdmin } from '@/lib/educamos-server';

export const dynamic = 'force-dynamic';

// Import de profesorado: con dryRun=1 devuelve el resumen sin escribir (vista previa).
export async function POST(request: Request) {
  if (!(await isEducamosAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Falta el fichero' }, { status: 400 });
    const dryRun = form.get('dryRun') === '1';
    const parsed = parseProfesoresFile(Buffer.from(await file.arrayBuffer()), file.name);
    const resumen = await aplicarSyncProfesores({
      rows: parsed.rows,
      filename: file.name,
      formato: parsed.formato,
      parseWarnings: parsed.warnings,
      dryRun,
    });
    return NextResponse.json({ ok: true, dryRun, totalFilas: parsed.rows.length, resumen });
  } catch (error) {
    console.error('Error en el import de profesorado:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
