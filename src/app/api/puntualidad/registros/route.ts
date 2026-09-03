import { NextResponse } from 'next/server';
import { isGuardResponse, requireSession } from '@/lib/auth-guards';
import { registroPayloadSchema } from '@/lib/puntualidad';
import { crearRegistros, marcarAvisoEnviado } from '@/lib/puntualidad-server';
import { enviarAvisoTercerRetraso } from '@/lib/puntualidad-email';

export const dynamic = 'force-dynamic';


/** Lista de correos de jefatura/dirección que recibe copia del aviso del tercer retraso. */
function copiaJefatura(): string[] {
  return (process.env.PUNTUALIDAD_AVISOS_COPIA ?? '')
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@'));
}

export async function POST(request: Request) {
  const guard = await requireSession();
  if (isGuardResponse(guard)) return guard;
  try {
    const datos = registroPayloadSchema.parse(await request.json());
    const { resultados, avisos } = await crearRegistros(
      datos.alumnos.map((a) => ({
        eduStudentId: a.eduStudentId,
        fecha: datos.fecha,
        hora: datos.hora,
        subjectId: a.subjectId ?? datos.subjectId ?? null,
        justificado: a.justificado,
        justificacionTipo: a.justificacionTipo ?? null,
        justificacionNota: a.justificacionNota ?? null,
        subeAClase: a.subeAClase,
        observaciones: a.observaciones ?? null,
      })),
      { email: guard.email },
    );

    // El correo va después de guardar y nunca tumba la respuesta: el registro es lo
    // importante, el aviso se puede reintentar desde el panel.
    for (const aviso of avisos) {
      try {
        const enviados = await enviarAvisoTercerRetraso(aviso, copiaJefatura());
        if (enviados.length > 0) await marcarAvisoEnviado(aviso.consequenceId, enviados);
      } catch (error) {
        console.error('Puntualidad · fallo enviando el aviso del 3er retraso:', error instanceof Error ? error.message : error);
      }
    }

    return NextResponse.json({ ok: true, resultados });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
