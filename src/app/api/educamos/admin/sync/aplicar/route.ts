import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseEducamosFile } from '@/lib/educamos';
import { aplicarSync, isEducamosAdmin } from '@/lib/educamos-server';

export const dynamic = 'force-dynamic';

const decisionesSchema = z.object({
  conflictos: z.record(z.string(), z.enum(['bbdd', 'excel'])).default({}),
  desactivar: z.array(z.string()).default([]),
});

// Aplica el sync: el cliente reenvía el mismo fichero + sus decisiones; el plan se
// recalcula en servidor (no nos fiamos del diff del cliente) y se aplica en una transacción.
export async function POST(request: Request) {
  if (!(await isEducamosAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Falta el fichero' }, { status: 400 });
    const respetarCursoDe = form.get('respetarCursoDe') === 'excel' ? 'excel' : 'bbdd';
    const decisiones = decisionesSchema.parse(JSON.parse(String(form.get('decisiones') ?? '{}')));

    const parsed = parseEducamosFile(Buffer.from(await file.arrayBuffer()), file.name);
    const resultado = await aplicarSync({
      rows: parsed.rows,
      opciones: { respetarCursoDe },
      decisiones,
      filename: file.name,
      formato: parsed.formato,
      parseWarnings: parsed.warnings,
    });
    return NextResponse.json({ ok: true, ...resultado });
  } catch (error) {
    console.error('Error aplicando el sync de Educamos:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
