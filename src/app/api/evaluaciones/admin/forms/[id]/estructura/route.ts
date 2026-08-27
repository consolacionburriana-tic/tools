// Un único endpoint para toda la edición de la estructura del formulario (bloques y
// preguntas). El editor es de trazo rápido — añadir, duplicar, subir/bajar, borrar —
// y con una sola ruta el cliente puede mandar la acción y recibir el formulario
// entero ya actualizado, sin quedarse a medias entre dos peticiones.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { CATALOGO, desdeCatalogo, presetActividad, slugClave, type Audiencia } from '@/lib/evaluaciones';
import {
  actualizarBloque,
  actualizarPregunta,
  anadirBloque,
  borrarBloque,
  borrarPregunta,
  crearActividad,
  duplicarPregunta,
  getFormCompleto,
  insertarPreguntas,
  reordenarBloques,
  reordenarPreguntas,
} from '@/lib/evaluaciones-server';

const filaSchema = z.object({ clave: z.string(), texto: z.string() });
const opcionSchema = z.object({ clave: z.string(), texto: z.string(), correcta: z.boolean().optional() });

const preguntaCampos = {
  texto: z.string().min(1).optional(),
  ayuda: z.string().nullable().optional(),
  tipo: z.enum(['escala', 'texto', 'opcion', 'varias', 'quiz']).optional(),
  escala: z.enum(['nada_mucho', '1_5', 'si_no', 'estrellas_4', 'estrellas_5']).optional(),
  estilo: z.string().nullable().optional(),
  filas: z.array(filaSchema).optional(),
  opciones: z.array(opcionSchema).optional(),
  permiteOtra: z.boolean().optional(),
  obligatoria: z.boolean().optional(),
  revisar: z.boolean().optional(),
  feedbackAcierto: z.string().nullable().optional(),
  feedbackFallo: z.string().nullable().optional(),
};

const schema = z.discriminatedUnion('accion', [
  z.object({
    accion: z.literal('bloque.add'),
    activityId: z.string().uuid().nullable().default(null),
    nombre: z.string().min(2).nullable().default(null),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
    lugar: z.string().nullable().default(null),
    categoria: z.enum(['pastoral', 'innovacion', 'general', 'otra']).default('pastoral'),
    conPreset: z.boolean().default(true),
  }),
  z.object({ accion: z.literal('bloque.update'), blockId: z.string().uuid(), titulo: z.string().optional(), intro: z.string().nullable().optional() }),
  z.object({ accion: z.literal('bloque.remove'), blockId: z.string().uuid() }),
  z.object({ accion: z.literal('bloque.reorder'), ids: z.array(z.string().uuid()) }),
  z.object({ accion: z.literal('pregunta.preset'), blockId: z.string().uuid() }),
  z.object({
    accion: z.literal('pregunta.add'),
    blockId: z.string().uuid(),
    catalogoId: z.string().nullable().default(null),
    tipo: z.enum(['escala', 'texto', 'opcion', 'varias', 'quiz']).default('escala'),
  }),
  z.object({ accion: z.literal('pregunta.update'), questionId: z.string().uuid(), ...preguntaCampos }),
  z.object({ accion: z.literal('pregunta.remove'), questionId: z.string().uuid() }),
  z.object({ accion: z.literal('pregunta.duplicate'), questionId: z.string().uuid() }),
  z.object({ accion: z.literal('pregunta.reorder'), blockId: z.string().uuid(), ids: z.array(z.string().uuid()) }),
]);

/** Pregunta en blanco según el tipo elegido, ya usable sin tocar nada más. */
function preguntaVacia(tipo: string) {
  const base = { clave: '', texto: 'Escribe aquí la pregunta', ayuda: null, obligatoria: true, revisar: true };
  if (tipo === 'escala') {
    return { ...base, tipo: 'escala' as const, escala: 'nada_mucho', filas: [{ clave: 'fila_1', texto: 'Primera frase a valorar' }] };
  }
  if (tipo === 'texto') return { ...base, tipo: 'texto' as const, obligatoria: false };
  if (tipo === 'quiz') {
    return {
      ...base,
      tipo: 'quiz' as const,
      opciones: [
        { clave: 'a', texto: 'Respuesta correcta', correcta: true },
        { clave: 'b', texto: 'Otra respuesta' },
      ],
      obligatoria: false,
      feedbackAcierto: '¡Bien! 🎉 Estabas atento/a.',
      feedbackFallo: 'Casi 😅 Vuelve a repasarlo.',
    };
  }
  return {
    ...base,
    tipo: tipo as 'opcion' | 'varias',
    opciones: [
      { clave: 'a', texto: 'Primera opción' },
      { clave: 'b', texto: 'Segunda opción' },
    ],
  };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('evaluaciones');
  if (isGuardResponse(guard)) return guard;
  try {
    const { id } = await params;
    const form = await getFormCompleto(id);
    if (!form) return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 });
    const audiencia = form.audiencia as Audiencia;
    const input = schema.parse(await request.json());

    switch (input.accion) {
      case 'bloque.add': {
        let activityId = input.activityId;
        let titulo = '';
        if (!activityId) {
          if (!input.nombre) return NextResponse.json({ error: 'Ponle nombre a la actividad' }, { status: 400 });
          const act = await crearActividad({
            nombre: input.nombre,
            academicYear: form.academicYear,
            fecha: input.fecha,
            lugar: input.lugar,
            categoria: input.categoria,
            createdByEmail: guard.email,
          });
          activityId = act.id;
          titulo = act.nombre;
        }
        await anadirBloque(form.id, { activityId, titulo: titulo || input.nombre || 'Actividad', audiencia, conPreset: input.conPreset });
        break;
      }
      case 'bloque.update':
        await actualizarBloque(input.blockId, { titulo: input.titulo, intro: input.intro });
        break;
      case 'bloque.remove':
        await borrarBloque(input.blockId);
        break;
      case 'bloque.reorder':
        await reordenarBloques(form.id, input.ids);
        break;
      case 'pregunta.preset': {
        const bloque = form.bloques.find((b) => b.id === input.blockId);
        if (!bloque) return NextResponse.json({ error: 'Bloque no encontrado' }, { status: 404 });
        await insertarPreguntas(bloque.id, presetActividad(bloque.titulo, audiencia));
        break;
      }
      case 'pregunta.add': {
        const bloque = form.bloques.find((b) => b.id === input.blockId);
        if (!bloque) return NextResponse.json({ error: 'Bloque no encontrado' }, { status: 404 });
        const usadas = new Set(bloque.preguntas.map((q) => q.clave));
        if (input.catalogoId) {
          const item = CATALOGO.find((c) => c.id === input.catalogoId);
          if (!item) return NextResponse.json({ error: 'Pregunta de catálogo desconocida' }, { status: 400 });
          await insertarPreguntas(bloque.id, [desdeCatalogo(item, usadas)]);
          break;
        }
        const vacia = preguntaVacia(input.tipo);
        await insertarPreguntas(bloque.id, [{ ...vacia, clave: slugClave(`${input.tipo}_${bloque.preguntas.length + 1}`) }]);
        break;
      }
      case 'pregunta.update':
        // `actualizarPregunta` filtra por lista blanca de columnas: el `accion` se ignora.
        await actualizarPregunta(input.questionId, input);
        break;
      case 'pregunta.remove':
        await borrarPregunta(input.questionId);
        break;
      case 'pregunta.duplicate':
        await duplicarPregunta(input.questionId);
        break;
      case 'pregunta.reorder':
        await reordenarPreguntas(input.blockId, input.ids);
        break;
    }

    return NextResponse.json({ ok: true, form: await getFormCompleto(form.id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
