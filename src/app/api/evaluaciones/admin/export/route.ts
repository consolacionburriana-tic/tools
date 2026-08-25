// Descarga CSV de las respuestas de una evaluación (una fila por respuesta y campo).
import { NextResponse } from 'next/server';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { evalAnswers, evalResponses } from '@/db/schema';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { getFormCompleto } from '@/lib/evaluaciones-server';
import { construirCsv, nombreFicheroCsv, type FilaExport } from '@/lib/evaluaciones-exports';

export async function GET(request: Request) {
  const guard = await requireModule('evaluaciones');
  if (isGuardResponse(guard)) return guard;

  const formId = new URL(request.url).searchParams.get('form');
  if (!formId) return NextResponse.json({ error: 'Falta el formulario' }, { status: 400 });

  const form = await getFormCompleto(formId);
  if (!form) return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 });

  const respuestas = await db
    .select()
    .from(evalResponses)
    .where(eq(evalResponses.formId, formId))
    .orderBy(asc(evalResponses.createdAt));
  const questionIds = form.bloques.flatMap((b) => b.preguntas.map((q) => q.id));
  const answers =
    questionIds.length && respuestas.length
      ? await db
          .select()
          .from(evalAnswers)
          .where(
            and(
              inArray(evalAnswers.questionId, questionIds),
              inArray(evalAnswers.responseId, respuestas.map((r) => r.id)),
            ),
          )
      : [];

  const preguntaPorId = new Map(
    form.bloques.flatMap((b) => b.preguntas.map((q) => [q.id, { bloque: b.titulo, pregunta: q }] as const)),
  );
  const respuestaPorId = new Map(respuestas.map((r) => [r.id, r]));

  const filas: FilaExport[] = [];
  for (const a of answers) {
    const meta = preguntaPorId.get(a.questionId);
    const r = respuestaPorId.get(a.responseId);
    if (!meta || !r) continue;
    const q = meta.pregunta;
    filas.push({
      respuestaId: r.id,
      fecha: r.createdAt.toISOString().slice(0, 16).replace('T', ' '),
      curso: r.curso,
      letra: r.letra,
      etapa: r.etapa,
      bloque: meta.bloque,
      preguntaClave: q.clave,
      pregunta: q.texto,
      fila: a.filaClave ? (q.filas.find((f) => f.clave === a.filaClave)?.texto ?? a.filaClave) : null,
      escala: q.escala,
      valorNum: a.valorNum,
      opcion: a.opcionClave ? (q.opciones.find((o) => o.clave === a.opcionClave)?.texto ?? a.opcionClave) : null,
      texto: a.valorTexto,
    });
  }

  return new NextResponse(construirCsv(filas), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombreFicheroCsv(form.titulo)}"`,
    },
  });
}
