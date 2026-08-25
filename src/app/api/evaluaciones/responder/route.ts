// Envío del formulario público de evaluación. Sin login: la única llave es el token
// del formulario. El `?a=` (invitación) solo se usa en alumnado y NUNCA en profesorado.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { limpiarRespuestas, preguntasIncompletas, type PreguntaParaValidar } from '@/lib/evaluaciones';
import { getFormPorToken, guardarRespuesta } from '@/lib/evaluaciones-server';
import { getSessionUser } from '@/lib/auth-guards';

const schema = z.object({
  token: z.string().min(4),
  invite: z.string().nullable().default(null),
  curso: z.string().nullable().default(null),
  letra: z.string().nullable().default(null),
  etapa: z.string().nullable().default(null),
  email: z.string().email().nullable().default(null),
  respuestas: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        filaClave: z.string().nullable().optional(),
        valorNum: z.number().int().nullable().optional(),
        opcionClave: z.string().nullable().optional(),
        valorTexto: z.string().nullable().optional(),
      }),
    )
    .max(500),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const form = await getFormPorToken(input.token);
    if (!form) return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 });
    if (form.estado !== 'abierto') {
      return NextResponse.json({ error: 'Esta evaluación está cerrada' }, { status: 409 });
    }
    if (form.requiereLogin && !(await getSessionUser())) {
      return NextResponse.json({ error: 'Hay que entrar con la cuenta del colegio' }, { status: 401 });
    }

    const preguntas: PreguntaParaValidar[] = form.bloques.flatMap((b) =>
      b.preguntas.map((q) => ({
        id: q.id,
        tipo: q.tipo as PreguntaParaValidar['tipo'],
        escala: q.escala,
        obligatoria: q.obligatoria,
        filas: q.filas,
        opciones: q.opciones,
        permiteOtra: q.permiteOtra,
      })),
    );

    const limpias = limpiarRespuestas(preguntas, input.respuestas);
    const faltan = preguntasIncompletas(preguntas, limpias);
    if (faltan.length > 0) {
      return NextResponse.json({ error: 'Faltan preguntas por contestar', faltan }, { status: 422 });
    }

    // La clase solo se acepta si es una de las del formulario (o si no hay lista fijada).
    const clasePedida = form.pedirClase && input.curso ? { curso: input.curso, letra: input.letra } : null;
    const claseValida =
      !clasePedida ||
      (form.clases ?? []).length === 0 ||
      (form.clases ?? []).some((c) => c.curso === clasePedida.curso && (c.letra ?? null) === (clasePedida.letra ?? null));
    // Con enlace personalizado la clase NO se pregunta (sale de la ficha del alumno), así
    // que solo se exige cuando la respuesta llega por el enlace común.
    if (form.pedirClase && !clasePedida && !input.invite) {
      return NextResponse.json({ error: 'Dinos de qué clase eres' }, { status: 422 });
    }

    const { responseId } = await guardarRespuesta({
      form,
      inviteToken: input.invite,
      curso: claseValida ? clasePedida?.curso ?? null : null,
      letra: claseValida ? clasePedida?.letra ?? null : null,
      etapa: input.etapa,
      email: input.email,
      respuestas: limpias,
    });

    // Corrección del quiz en servidor: las respuestas correctas no viajan al cliente
    // hasta que se ha enviado el formulario.
    const quiz = form.bloques
      .flatMap((b) => b.preguntas)
      .filter((q) => q.tipo === 'quiz')
      .map((q) => {
        const dada = limpias.find((r) => r.questionId === q.id);
        const correctas = q.opciones.filter((o) => o.correcta);
        const acertada = !!dada?.opcionClave && correctas.some((o) => o.clave === dada.opcionClave);
        return {
          questionId: q.id,
          texto: q.texto,
          acertada,
          contestada: !!dada,
          correctas: correctas.map((o) => o.texto),
          feedback: acertada ? q.feedbackAcierto : q.feedbackFallo,
        };
      })
      .filter((q) => q.contestada);

    return NextResponse.json({ ok: true, responseId, quiz, mensajeFinal: form.mensajeFinal }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
