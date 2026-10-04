// Publicar la evaluación en la tutoría de cada clase de Classroom, como TAREA o como ANUNCIO.
// Acciones: `preview` (a qué clase de Classroom va cada clase del formulario) y `publicar`.
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
import { COLEGIO } from '@/lib/colegio';
import { enParalelo, explicarError, googleConfigurado, clasesDondeEsProfe, publicarEnClase } from '@/lib/calendarios-google';
import { actualizarForm, getFormCompleto, getHuecosPendientes } from '@/lib/evaluaciones-server';
import {
  emparejarClases,
  fechaLimiteUtc,
  rellenarTextoClassroom,
  TEMA_CLASSROOM,
  tituloSinAudiencia,
} from '@/lib/evaluaciones-classroom';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z.object({
  formId: z.string().uuid(),
  accion: z.enum(['preview', 'publicar']),
  tipo: z.enum(['tarea', 'anuncio']).default('tarea'),
  titulo: z.string().trim().max(300).default(''),
  texto: z.string().max(10000).default(''),
  /** Solo tareas: fecha límite. */
  limite: z.string().datetime({ offset: true }).nullable().default(null),
  programadoPara: z.string().datetime({ offset: true }).nullable().default(null),
  /** Si sigue en borrador y se programa, abrirla sola a esa hora (igual que en el correo). */
  abrirSola: z.boolean().default(true),
});

/** La cuenta que publica: tiene que ser un USUARIO real (los grupos no se pueden suplantar). */
function buzonClassroom(): string {
  return (process.env.EVALUACIONES_CLASSROOM_BUZON || COLEGIO.correoTic).trim().toLowerCase();
}

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
  const clases = form.clases ?? [];
  if (clases.length === 0) {
    return NextResponse.json({ error: 'No hay clases marcadas en los ajustes del formulario' }, { status: 400 });
  }

  const buzon = buzonClassroom();
  let emparejamientos;
  try {
    emparejamientos = emparejarClases(clases, await clasesDondeEsProfe(buzon), form.academicYear);
  } catch (e) {
    console.error('Evaluaciones → Classroom: no se pudieron leer las clases:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: `No se pudieron leer las clases de ${buzon}: ${explicarError(e)}` }, { status: 502 });
  }

  if (input.accion === 'preview') {
    return NextResponse.json({
      buzon,
      emparejamientos: emparejamientos.map((m) => ({
        etiqueta: m.etiqueta,
        destino: m.destino ? { id: m.destino.id, nombre: m.destino.nombre } : null,
        motivo: m.motivo,
        candidatas: m.candidatas.map((c) => c.nombre ?? c.id),
      })),
    });
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

  const destinos = emparejamientos.filter((m) => m.destino);
  if (destinos.length === 0) {
    return NextResponse.json({ error: `${buzon} no es profe de ninguna de las clases elegidas` }, { status: 409 });
  }

  const enlace = `${appBaseUrl()}/evaluaciones/${form.token}`;
  const resultados = await enParalelo(destinos, 3, async (m) => {
    // «Tutoría Paz · Alumnado» → «Tutoría Paz»: el sector no es para el alumnado.
    const vars = { titulo: tituloSinAudiencia(form.titulo), curso: m.etiqueta, academicYear: form.academicYear, enlace };
    const r = await publicarEnClase(buzon, m.destino!.id, {
      tipo: input.tipo,
      titulo: rellenarTextoClassroom(input.titulo, vars),
      texto: rellenarTextoClassroom(input.texto, vars),
      enlace,
      limite,
      programadoPara,
      tema: TEMA_CLASSROOM,
    });
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
    sinClase: emparejamientos
      .filter((m) => !m.destino)
      .map((m) => ({ etiqueta: m.etiqueta, motivo: m.motivo })),
    programadoPara,
  });
}
