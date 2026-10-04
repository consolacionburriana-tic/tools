// Publicar la evaluación en la tutoría de cada clase de Classroom, como TAREA o como ANUNCIO.
// Acciones: `preview` (a qué clase de Classroom va cada clase del formulario y qué se ha
// publicado ya), `publicar`, `fijar` / `olvidar` (la tutoría de una clase dicha a mano, por
// si la deducción por el nombre no la encontró) y `retirar` (borrar lo publicado de Classroom).
//
// Se publica COMO una cuenta del colegio (por defecto tic@, `EVALUACIONES_CLASSROOM_BUZON`)
// suplantada con la delegación de dominio. Esa cuenta tiene que ser profe de cada tutoría, y
// quien las da de alta es TIC desde «Classrooms y calendarios». La lista de clases de las que
// es profe es, a la vez, el catálogo de destinos posibles: no se escribe en ninguna otra.
//
// El enlace es el GENERAL del formulario (el mismo para toda la clase): no hay enlace personal
// por alumno como en el correo, así que no se puede saber quién falta y el formulario pide la
// clase al empezar.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { appBaseUrl } from '@/lib/constants';
import { enParalelo, explicarError, googleConfigurado, clasesDondeEsProfe, publicarEnClase } from '@/lib/calendarios-google';
import { actualizarForm, getFormCompleto, getHuecosPendientes } from '@/lib/evaluaciones-server';
import {
  buzonClassroom,
  destinosFijados,
  fijarDestino,
  olvidarDestino,
  postsDeForm,
  registrarPost,
  retirarPosts,
} from '@/lib/evaluaciones-classroom-server';
import {
  courseIdDeEnlace,
  emparejarClases,
  fechaLimiteUtc,
  rellenarTextoClassroom,
  TEMA_CLASSROOM,
  tituloSinAudiencia,
} from '@/lib/evaluaciones-classroom';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const claseSchema = { curso: z.string().min(1).max(40), letra: z.string().max(10).nullable().default(null) };

const schema = z.discriminatedUnion('accion', [
  z.object({ formId: z.string().uuid(), accion: z.literal('preview') }),
  z.object({
    formId: z.string().uuid(),
    accion: z.literal('publicar'),
    tipo: z.enum(['tarea', 'anuncio']).default('tarea'),
    titulo: z.string().trim().max(300).default(''),
    texto: z.string().max(10000).default(''),
    /** Solo tareas: fecha límite. */
    limite: z.string().datetime({ offset: true }).nullable().default(null),
    programadoPara: z.string().datetime({ offset: true }).nullable().default(null),
    /** Si sigue en borrador y se programa, abrirla sola a esa hora (igual que en el correo). */
    abrirSola: z.boolean().default(true),
  }),
  z.object({ formId: z.string().uuid(), accion: z.literal('fijar'), ...claseSchema, enlace: z.string().trim().min(1).max(500) }),
  z.object({ formId: z.string().uuid(), accion: z.literal('olvidar'), ...claseSchema }),
  z.object({ formId: z.string().uuid(), accion: z.literal('retirar'), ids: z.array(z.string().uuid()).max(100).nullable().default(null) }),
]);

export async function POST(request: Request) {
  const guard = await requireModule('evaluaciones');
  if (isGuardResponse(guard)) return guard;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos incorrectos' }, { status: 400 });
  }
  const input = parsed.data;
  if (!googleConfigurado()) {
    return NextResponse.json({ error: 'No hay cuenta de servicio de Google configurada' }, { status: 500 });
  }

  const form = await getFormCompleto(input.formId);
  if (!form) return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 });
  if (form.audiencia !== 'alumnos') {
    return NextResponse.json({ error: 'Classroom solo vale para evaluaciones del alumnado' }, { status: 400 });
  }
  const buzon = buzonClassroom();

  // Retirar no necesita saber las clases: borra lo que está en el historial.
  if (input.accion === 'retirar') {
    try {
      const resultados = await retirarPosts([form.id], guard.email, input.ids);
      return NextResponse.json({ ok: resultados.some((r) => r.ok), resultados, posts: await vistaPosts(form.id) });
    } catch (error) {
      console.error('Evaluaciones → Classroom: error retirando:', error instanceof Error ? error.message : error);
      return NextResponse.json({ error: explicarError(error) }, { status: 502 });
    }
  }

  const clases = form.clases ?? [];
  if (clases.length === 0) {
    return NextResponse.json({ error: 'No hay clases marcadas en los ajustes del formulario' }, { status: 400 });
  }

  let deClassroom;
  try {
    deClassroom = await clasesDondeEsProfe(buzon);
  } catch (e) {
    console.error('Evaluaciones → Classroom: no se pudieron leer las clases:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: `No se pudieron leer las clases de ${buzon}: ${explicarError(e)}` }, { status: 502 });
  }

  // ── Fijar / olvidar la tutoría de una clase, a mano ──
  if (input.accion === 'fijar' || input.accion === 'olvidar') {
    const letra = input.letra || null;
    if (!clases.some((c) => c.curso === input.curso && (c.letra ?? null) === letra)) {
      return NextResponse.json({ error: 'Esa clase no está entre las del formulario' }, { status: 400 });
    }
    if (input.accion === 'olvidar') {
      await olvidarDestino(form.academicYear, input.curso, letra);
      return NextResponse.json(await vistaPreview(form, deClassroom, buzon));
    }
    const courseId = courseIdDeEnlace(input.enlace);
    if (!courseId) {
      return NextResponse.json({ error: 'Eso no parece el enlace de una clase de Classroom' }, { status: 400 });
    }
    const clase = deClassroom.find((c) => c.id === courseId);
    if (!clase) {
      return NextResponse.json(
        { error: `${buzon} no es profe de esa clase (o no está activa): añádelo en «Classrooms y calendarios» y vuelve a pegarla` },
        { status: 409 },
      );
    }
    await fijarDestino({
      academicYear: form.academicYear,
      curso: input.curso,
      letra,
      courseId,
      courseNombre: clase.nombre,
      email: guard.email,
    });
    return NextResponse.json(await vistaPreview(form, deClassroom, buzon));
  }

  if (input.accion === 'preview') {
    return NextResponse.json(await vistaPreview(form, deClassroom, buzon));
  }

  // ── Publicar ──
  if (!input.titulo || !input.texto.trim()) {
    return NextResponse.json({ error: 'Falta el título o el texto' }, { status: 400 });
  }
  const programadoPara = input.programadoPara ? new Date(input.programadoPara) : null;
  if (programadoPara && programadoPara.getTime() < Date.now() + 60_000) {
    return NextResponse.json({ error: 'Esa hora ya ha pasado (o es ya mismo): publícalo ahora' }, { status: 400 });
  }
  if (form.estado === 'cerrado') {
    return NextResponse.json({ error: 'La evaluación está cerrada: ábrela o no se podrá responder' }, { status: 409 });
  }
  let abrirEn: Date | null = null;
  if (form.estado === 'borrador') {
    if (!programadoPara) return NextResponse.json({ error: 'Abre la evaluación antes de publicarla' }, { status: 409 });
    if ((await getHuecosPendientes(form.id)).length > 0) {
      return NextResponse.json({ error: 'Termina antes las frases que quedan a medias' }, { status: 409 });
    }
    if (!input.abrirSola) {
      return NextResponse.json({ error: 'Sigue en borrador: marca que se abra sola o ábrela ya' }, { status: 409 });
    }
    abrirEn = programadoPara;
  }
  let limite = null;
  if (input.tipo === 'tarea' && input.limite) {
    const d = new Date(input.limite);
    if (d.getTime() <= (programadoPara?.getTime() ?? Date.now())) {
      return NextResponse.json({ error: 'La fecha límite tiene que ser posterior a la publicación' }, { status: 400 });
    }
    limite = fechaLimiteUtc(d);
  }

  const emparejamientos = emparejarClases(clases, deClassroom, form.academicYear, await destinosFijados(form.academicYear));
  const activos = new Set((await postsDeForm(form.id)).filter((p) => !p.retiradoAt).map((p) => p.courseId));
  // Una clase donde ya hay una publicación activa se salta: pulsar dos veces no duplica. Para
  // volver a publicar, se retira antes.
  const yaPublicadas = emparejamientos.filter((m) => m.destino && activos.has(m.destino.id));
  const destinos = emparejamientos.filter((m) => m.destino && !activos.has(m.destino.id));
  if (destinos.length === 0) {
    return NextResponse.json(
      {
        error:
          yaPublicadas.length > 0
            ? 'Ya está publicada en todas las clases que se encuentran: retírala antes si quieres volver a publicarla'
            : `${buzon} no es profe de ninguna de las clases elegidas`,
      },
      { status: 409 },
    );
  }

  const enlace = `${appBaseUrl()}/evaluaciones/${form.token}`;
  const resultados = await enParalelo(destinos, 3, async (m) => {
    // «Tutoría Paz · Alumnado» → «Tutoría Paz»: el sector no es para el alumnado.
    const vars = { titulo: tituloSinAudiencia(form.titulo), curso: m.etiqueta, academicYear: form.academicYear, enlace };
    const titulo = rellenarTextoClassroom(input.titulo, vars);
    const r = await publicarEnClase(buzon, m.destino!.id, {
      tipo: input.tipo,
      titulo,
      texto: rellenarTextoClassroom(input.texto, vars),
      enlace,
      limite,
      programadoPara,
      tema: TEMA_CLASSROOM,
    });
    if (r.ok) {
      try {
        await registrarPost({
          formId: form.id,
          etiqueta: m.etiqueta,
          courseId: m.destino!.id,
          courseNombre: m.destino!.nombre,
          tipo: input.tipo,
          postId: r.id,
          enlace: r.enlace,
          titulo,
          programadoPara,
          createdByEmail: guard.email,
        });
      } catch (e) {
        // Ya está en Classroom: si no se pudo apuntar, que al menos se sepa.
        console.error('Evaluaciones → Classroom: publicada pero sin apuntar en el historial:', e instanceof Error ? e.message : e);
      }
    }
    return {
      etiqueta: m.etiqueta,
      clase: m.destino!.nombre,
      ok: r.ok,
      error: r.ok ? null : r.error,
      aviso: r.ok ? (r.aviso ?? null) : null,
      enlace: r.ok ? r.enlace : null,
    };
  });

  // Si al menos una salió y la evaluación estaba en borrador, queda programada la apertura.
  if (abrirEn && resultados.some((r) => r.ok)) await actualizarForm(form.id, { abrirEn });

  return NextResponse.json({
    ok: resultados.some((r) => r.ok),
    publicadas: resultados.filter((r) => r.ok).length,
    resultados,
    sinClase: emparejamientos.filter((m) => !m.destino).map((m) => ({ etiqueta: m.etiqueta, motivo: m.motivo })),
    yaPublicadas: yaPublicadas.map((m) => m.etiqueta),
    posts: await vistaPosts(form.id),
    programadoPara,
  });
}

function vistaPosts(formId: string) {
  return postsDeForm(formId);
}

/** Lo que enseña la zona de Classroom: a dónde iría cada clase, de dónde sale, y lo ya publicado. */
async function vistaPreview(
  form: NonNullable<Awaited<ReturnType<typeof getFormCompleto>>>,
  deClassroom: Awaited<ReturnType<typeof clasesDondeEsProfe>>,
  buzon: string,
) {
  const emparejamientos = emparejarClases(form.clases ?? [], deClassroom, form.academicYear, await destinosFijados(form.academicYear));
  const posts = await postsDeForm(form.id);
  const activos = new Set(posts.filter((p) => !p.retiradoAt).map((p) => p.courseId));
  return {
    buzon,
    emparejamientos: emparejamientos.map((m) => ({
      etiqueta: m.etiqueta,
      curso: m.clase.curso,
      letra: m.clase.letra,
      destino: m.destino ? { id: m.destino.id, nombre: m.destino.nombre } : null,
      origen: m.origen,
      motivo: m.motivo,
      candidatas: m.candidatas.map((c) => c.nombre ?? c.id),
      yaPublicada: !!m.destino && activos.has(m.destino.id),
    })),
    posts,
  };
}
