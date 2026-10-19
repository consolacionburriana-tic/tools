import { after, NextResponse } from 'next/server';
import { notaSchema } from '@/lib/nouvinguts';
import { anadirNota, mandarNota } from '@/lib/nouvinguts-server';
import { conFicha, fallo, firma, idValido, isGuardResponse, leer, requireModule } from '../../respuesta';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('nouvinguts');
  if (isGuardResponse(guard)) return guard;
  const { id } = await params;
  if (!idValido(id)) return NextResponse.json({ error: 'Identificador no válido' }, { status: 400 });
  const nota = await leer(request, notaSchema);
  if (nota instanceof NextResponse) return nota;
  try {
    await anadirNota(id, nota.paso, nota.texto, firma(guard), nota.correo);
    // «Mandar también por correo»: sale del buzón de quien la escribe, después de responder.
    const correo = nota.correo;
    if (correo) after(() => mandarNota(id, nota.paso, nota.texto, correo, firma(guard)));
    return await conFicha(id, guard);
  } catch (error) {
    return fallo(error, 'nota');
  }
}
