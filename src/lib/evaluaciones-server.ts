// Capa de servidor de Evaluaciones: actividades, formularios, estructura (bloques y
// preguntas), respuestas y agregados del dashboard. Lee alumnado/profesorado de la
// BBDD central (edu_*), nunca mantiene listado propio.
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  evalActivities,
  evalAnswers,
  evalBlocks,
  evalEmailTemplates,
  evalForms,
  evalInvites,
  evalQuestions,
  evalResponses,
  eduStudents,
  eduTeachers,
  type EvalActivity,
  type EvalBlock,
  type EvalForm,
  type EvalQuestion,
  type NewEvalQuestion,
} from '@/db/schema';
import { academicYearActual } from '@/lib/constants';
import { compararClasesMayoresPrimero, etapaDeCurso } from '@/lib/cursos';
import {
  AVISO_ANONIMATO,
  INTRO_FORM,
  MENSAJE_FINAL,
  claveUnica,
  escalaDe,
  mediaBruta,
  mediaPorcentaje,
  nuevoTokenFormulario,
  huecosPendientes,
  nuevoTokenInvitacion,
  presetActividad,
  slugClave,
  type Audiencia,
  type Categoria,
  type PreguntaBorrador,
  type TipoObjeto,
} from '@/lib/evaluaciones';

export interface Clase {
  curso: string;
  letra: string | null;
}

// ─── Actividades ──────────────────────────────────────────────────────────────

export interface ActividadConUso extends EvalActivity {
  formularios: { id: string; titulo: string; audiencia: string; estado: string; respuestas: number }[];
}

export async function getActividades(filtros: { academicYear?: string; categoria?: string } = {}): Promise<ActividadConUso[]> {
  const conds = [eq(evalActivities.archivada, false)];
  if (filtros.academicYear) conds.push(eq(evalActivities.academicYear, filtros.academicYear));
  if (filtros.categoria) conds.push(eq(evalActivities.categoria, filtros.categoria));

  const actividades = await db
    .select()
    .from(evalActivities)
    .where(and(...conds))
    .orderBy(desc(evalActivities.fecha), desc(evalActivities.createdAt));
  if (actividades.length === 0) return [];

  const usos = await db
    .select({
      activityId: evalBlocks.activityId,
      formId: evalForms.id,
      titulo: evalForms.titulo,
      audiencia: evalForms.audiencia,
      estado: evalForms.estado,
    })
    .from(evalBlocks)
    .innerJoin(evalForms, eq(evalForms.id, evalBlocks.formId))
    .where(inArray(evalBlocks.activityId, actividades.map((a) => a.id)));

  const conteos = await contarRespuestas([...new Set(usos.map((u) => u.formId))]);

  return actividades.map((a) => ({
    ...a,
    formularios: usos
      .filter((u) => u.activityId === a.id)
      .map((u) => ({
        id: u.formId,
        titulo: u.titulo,
        audiencia: u.audiencia,
        estado: u.estado,
        respuestas: conteos.get(u.formId) ?? 0,
      })),
  }));
}

export async function getActividad(id: string): Promise<EvalActivity | null> {
  const [row] = await db.select().from(evalActivities).where(eq(evalActivities.id, id)).limit(1);
  return row ?? null;
}

export interface NuevaActividadInput {
  nombre: string;
  academicYear?: string;
  fecha?: string | null;
  lugar?: string | null;
  categoria?: Categoria;
  tipo?: TipoObjeto;
  objetivo?: string | null;
  resumen?: string | null;
  notas?: string | null;
  serieId?: string;
  createdByEmail?: string | null;
}

export async function crearActividad(input: NuevaActividadInput): Promise<EvalActivity> {
  const [row] = await db
    .insert(evalActivities)
    .values({
      nombre: input.nombre.trim(),
      academicYear: input.academicYear ?? academicYearActual(),
      fecha: input.fecha ?? null,
      lugar: input.lugar ?? null,
      categoria: input.categoria ?? 'pastoral',
      tipo: input.tipo ?? 'actividad',
      objetivo: input.objetivo ?? null,
      resumen: input.resumen ?? null,
      notas: input.notas ?? null,
      // Actividad nueva = serie nueva. Las copias de otro curso heredan la serie.
      serieId: input.serieId ?? crypto.randomUUID(),
      createdByEmail: input.createdByEmail ?? null,
    })
    .returning();
  return row;
}

export async function actualizarActividad(id: string, patch: Partial<NuevaActividadInput> & { archivada?: boolean }): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of ['nombre', 'academicYear', 'fecha', 'lugar', 'categoria', 'tipo', 'objetivo', 'resumen', 'notas', 'archivada'] as const) {
    if (patch[k as keyof typeof patch] !== undefined) set[k] = patch[k as keyof typeof patch];
  }
  await db.update(evalActivities).set(set).where(eq(evalActivities.id, id));
}

/** Copia una actividad a otro curso académico manteniendo la serie (para comparar). */
export async function copiarActividad(id: string, academicYear: string, createdByEmail?: string | null): Promise<EvalActivity | null> {
  const orig = await getActividad(id);
  if (!orig) return null;
  return crearActividad({
    nombre: orig.nombre,
    academicYear,
    fecha: null, // la fecha cambia cada curso: se pone al usarla
    lugar: orig.lugar,
    categoria: orig.categoria as Categoria,
    tipo: orig.tipo as TipoObjeto,
    objetivo: orig.objetivo,
    resumen: orig.resumen,
    notas: orig.notas,
    serieId: orig.serieId,
    createdByEmail,
  });
}

// ─── Formularios ──────────────────────────────────────────────────────────────

async function contarRespuestas(formIds: string[]): Promise<Map<string, number>> {
  if (formIds.length === 0) return new Map();
  const rows = await db
    .select({ formId: evalResponses.formId, n: sql<number>`count(*)::int` })
    .from(evalResponses)
    .where(inArray(evalResponses.formId, formIds))
    .groupBy(evalResponses.formId);
  return new Map(rows.map((r) => [r.formId, r.n]));
}

export interface FormResumen extends EvalForm {
  actividades: string[];
  respuestas: number;
  objetivo: number | null; // destinatarios esperados (alumnado de las clases elegidas)
}

export async function getForms(filtros: { academicYear?: string; audiencia?: string } = {}): Promise<FormResumen[]> {
  const conds = [];
  if (filtros.academicYear) conds.push(eq(evalForms.academicYear, filtros.academicYear));
  if (filtros.audiencia) conds.push(eq(evalForms.audiencia, filtros.audiencia));
  const forms = await db
    .select()
    .from(evalForms)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(evalForms.createdAt));
  if (forms.length === 0) return [];

  const ids = forms.map((f) => f.id);
  const [bloques, conteos, alumnado] = await Promise.all([
    db.select().from(evalBlocks).where(inArray(evalBlocks.formId, ids)).orderBy(asc(evalBlocks.orden)),
    contarRespuestas(ids),
    db
      .select({ curso: eduStudents.curso, letra: eduStudents.letra })
      .from(eduStudents)
      .where(eq(eduStudents.active, true)),
  ]);

  return forms.map((f) => ({
    ...f,
    actividades: bloques.filter((b) => b.formId === f.id).map((b) => b.titulo),
    respuestas: conteos.get(f.id) ?? 0,
    objetivo:
      f.audiencia === 'alumnos' && (f.clases ?? []).length > 0
        ? alumnado.filter((a) => (f.clases ?? []).some((c) => c.curso === a.curso && (c.letra ?? null) === (a.letra ?? null))).length
        : null,
  }));
}

export interface BloqueCompleto extends EvalBlock {
  actividad: EvalActivity | null;
  preguntas: EvalQuestion[];
}

export interface FormCompleto extends EvalForm {
  bloques: BloqueCompleto[];
}

export async function getFormCompleto(id: string): Promise<FormCompleto | null> {
  const [form] = await db.select().from(evalForms).where(eq(evalForms.id, id)).limit(1);
  if (!form) return null;
  return hidratarForm(form);
}

export async function getFormPorToken(token: string): Promise<FormCompleto | null> {
  const [form] = await db.select().from(evalForms).where(eq(evalForms.token, token)).limit(1);
  if (!form) return null;
  return hidratarForm(form);
}

async function hidratarForm(form: EvalForm): Promise<FormCompleto> {
  const bloques = await db.select().from(evalBlocks).where(eq(evalBlocks.formId, form.id)).orderBy(asc(evalBlocks.orden));
  const blockIds = bloques.map((b) => b.id);
  const activityIds = bloques.map((b) => b.activityId).filter((x): x is string => !!x);
  const [preguntas, actividades] = await Promise.all([
    blockIds.length
      ? db.select().from(evalQuestions).where(inArray(evalQuestions.blockId, blockIds)).orderBy(asc(evalQuestions.orden))
      : Promise.resolve([] as EvalQuestion[]),
    activityIds.length
      ? db.select().from(evalActivities).where(inArray(evalActivities.id, activityIds))
      : Promise.resolve([] as EvalActivity[]),
  ]);
  return {
    ...form,
    bloques: bloques.map((b) => ({
      ...b,
      actividad: actividades.find((a) => a.id === b.activityId) ?? null,
      preguntas: preguntas.filter((q) => q.blockId === b.id),
    })),
  };
}

export interface NuevoFormInput {
  titulo: string;
  audiencia: Audiencia;
  academicYear?: string;
  descripcion?: string | null;
  clases?: Clase[];
  /** Actividades ya existentes que entran en el formulario. */
  activityIds?: string[];
  /** Actividades nuevas creadas al vuelo (lo normal: "escribe el nombre y listo"). */
  actividadesNuevas?: { nombre: string; fecha?: string | null; lugar?: string | null; categoria?: Categoria; objetivo?: string | null; resumen?: string | null }[];
  /** Añadir el preset de preguntas de la audiencia a cada bloque (por defecto sí). */
  conPreset?: boolean;
  createdByEmail?: string | null;
}

/**
 * Crea el formulario entero de una tacada: datos + bloques (uno por actividad) +
 * preguntas del preset. Es el camino de "mínimos clics": el editor se abre ya con
 * todo escrito y solo hay que retocar las frases marcadas.
 */
export async function crearForm(input: NuevoFormInput): Promise<FormCompleto> {
  const academicYear = input.academicYear ?? academicYearActual();
  const audiencia = input.audiencia;

  const [form] = await db
    .insert(evalForms)
    .values({
      academicYear,
      titulo: input.titulo.trim(),
      descripcion: input.descripcion ?? INTRO_FORM[audiencia],
      audiencia,
      token: nuevoTokenFormulario(),
      anonimo: true,
      // El alumnado responde con enlace personalizado cuando se envía por correo:
      // se guarda de qué alumno viene (decisión cerrada, ver la ficha del módulo).
      identificaAlumno: audiencia === 'alumnos',
      pedirClase: audiencia === 'alumnos',
      pedirEtapa: audiencia === 'profesores',
      avisoAnonimato: AVISO_ANONIMATO[audiencia],
      mensajeFinal: MENSAJE_FINAL[audiencia],
      clases: input.clases ?? [],
      createdByEmail: input.createdByEmail ?? null,
    })
    .returning();

  const nuevas = await Promise.all(
    (input.actividadesNuevas ?? []).map((a) =>
      crearActividad({ ...a, academicYear, createdByEmail: input.createdByEmail }),
    ),
  );
  const existentes = input.activityIds?.length
    ? await db.select().from(evalActivities).where(inArray(evalActivities.id, input.activityIds))
    : [];
  const actividades = [...existentes, ...nuevas];

  let orden = 0;
  for (const act of actividades) {
    await anadirBloque(form.id, {
      activityId: act.id,
      titulo: act.nombre,
      audiencia,
      conPreset: input.conPreset !== false,
      orden: orden++,
    });
  }

  return (await getFormCompleto(form.id))!;
}

/**
 * Huecos "…" sin rellenar de un formulario. Es el guardián de que nadie mande la
 * evaluación con las frases genéricas del preset.
 */
export async function getHuecosPendientes(formId: string): Promise<{ questionId: string; texto: string }[]> {
  const form = await getFormCompleto(formId);
  if (!form) return [];
  return huecosPendientes(
    form.bloques.flatMap((b) => b.preguntas.map((q) => ({ id: q.id, texto: q.texto, filas: q.filas }))),
  );
}

export async function actualizarForm(id: string, patch: Partial<EvalForm>): Promise<void> {
  const campos = [
    'titulo', 'descripcion', 'audiencia', 'estado', 'academicYear', 'anonimo', 'identificaAlumno',
    'pedirClase', 'pedirEtapa', 'requiereLogin', 'avisoAnonimato', 'mensajeFinal', 'clases',
  ] as const;
  const set: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of campos) if (patch[k] !== undefined) set[k] = patch[k];
  if (patch.estado === 'abierto') set.abiertoAt = new Date();
  if (patch.estado === 'cerrado') set.cerradoAt = new Date();
  await db.update(evalForms).set(set).where(eq(evalForms.id, id));
}

/**
 * Duplica un formulario con toda su estructura. Sirve para tres cosas del día a día:
 * repetir la evaluación del curso siguiente (`academicYear` distinto → las actividades
 * se copian a ese curso manteniendo la serie), pasar de alumnos a profes (`audiencia`
 * distinta → se cambia el preset), o simplemente clonar para retocar.
 */
export async function duplicarForm(
  id: string,
  opts: { academicYear?: string; audiencia?: Audiencia; titulo?: string; createdByEmail?: string | null } = {},
): Promise<FormCompleto | null> {
  const orig = await getFormCompleto(id);
  if (!orig) return null;
  const academicYear = opts.academicYear ?? orig.academicYear;
  const audiencia = opts.audiencia ?? (orig.audiencia as Audiencia);
  const cambiaAudiencia = audiencia !== orig.audiencia;
  const cambiaAnio = academicYear !== orig.academicYear;

  const [form] = await db
    .insert(evalForms)
    .values({
      academicYear,
      titulo: opts.titulo ?? (cambiaAudiencia ? `${orig.titulo} · ${audiencia}` : `${orig.titulo} (copia)`),
      descripcion: cambiaAudiencia ? INTRO_FORM[audiencia] : orig.descripcion,
      audiencia,
      token: nuevoTokenFormulario(),
      anonimo: orig.anonimo,
      identificaAlumno: audiencia === 'alumnos' ? orig.identificaAlumno : false,
      pedirClase: audiencia === 'alumnos',
      pedirEtapa: audiencia === 'profesores',
      requiereLogin: orig.requiereLogin,
      avisoAnonimato: cambiaAudiencia ? AVISO_ANONIMATO[audiencia] : orig.avisoAnonimato,
      mensajeFinal: cambiaAudiencia ? MENSAJE_FINAL[audiencia] : orig.mensajeFinal,
      clases: audiencia === 'alumnos' ? orig.clases : [],
      createdByEmail: opts.createdByEmail ?? null,
    })
    .returning();

  for (const b of orig.bloques) {
    // Al saltar de curso, la actividad se copia a ese curso (misma serie) para que la
    // comparativa entre años tenga dos puntos y no uno reutilizado.
    let activityId = b.activityId;
    if (cambiaAnio && b.activityId) {
      const copia = await copiarActividad(b.activityId, academicYear, opts.createdByEmail);
      activityId = copia?.id ?? b.activityId;
    }
    const act = activityId ? await getActividad(activityId) : null;

    if (cambiaAudiencia) {
      await anadirBloque(form.id, {
        activityId,
        titulo: b.titulo,
        audiencia,
        conPreset: true,
        orden: b.orden,
        intro: act ? (audiencia === 'profesores' ? act.objetivo : act.resumen) : null,
      });
      continue;
    }
    const [bloque] = await db
      .insert(evalBlocks)
      .values({ formId: form.id, activityId, titulo: b.titulo, intro: b.intro, orden: b.orden })
      .returning();
    if (b.preguntas.length > 0) {
      await db.insert(evalQuestions).values(
        b.preguntas.map((q) => ({
          blockId: bloque.id,
          clave: q.clave,
          texto: q.texto,
          ayuda: q.ayuda,
          tipo: q.tipo,
          escala: q.escala,
          filas: q.filas,
          opciones: q.opciones,
          permiteOtra: q.permiteOtra,
          obligatoria: q.obligatoria,
          revisar: q.revisar,
          feedbackAcierto: q.feedbackAcierto,
          feedbackFallo: q.feedbackFallo,
          orden: q.orden,
        })),
      );
    }
  }
  return getFormCompleto(form.id);
}

/** Borra un formulario. Solo si no tiene respuestas: lo respondido no se tira nunca. */
export async function borrarForm(id: string): Promise<{ ok: boolean; motivo?: string }> {
  const n = (await contarRespuestas([id])).get(id) ?? 0;
  if (n > 0) return { ok: false, motivo: `Tiene ${n} respuestas: ciérralo en vez de borrarlo.` };
  await db.delete(evalForms).where(eq(evalForms.id, id));
  return { ok: true };
}

// ─── Estructura (bloques y preguntas) ─────────────────────────────────────────

export async function anadirBloque(
  formId: string,
  opts: {
    activityId?: string | null;
    titulo: string;
    intro?: string | null;
    audiencia: Audiencia;
    conPreset?: boolean;
    orden?: number;
  },
): Promise<BloqueCompleto> {
  const orden = opts.orden ?? (await siguienteOrdenBloque(formId));
  const act = opts.activityId ? await getActividad(opts.activityId) : null;
  const intro =
    opts.intro !== undefined
      ? opts.intro
      : act
        ? opts.audiencia === 'profesores'
          ? act.objetivo
          : act.resumen
        : null;

  const [bloque] = await db
    .insert(evalBlocks)
    .values({ formId, activityId: opts.activityId ?? null, titulo: opts.titulo.trim(), intro, orden })
    .returning();

  let preguntas: EvalQuestion[] = [];
  if (opts.conPreset !== false) {
    preguntas = await insertarPreguntas(bloque.id, presetActividad(opts.titulo, opts.audiencia));
  }
  return { ...bloque, actividad: act, preguntas };
}

async function siguienteOrdenBloque(formId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<number | null>`max(${evalBlocks.orden})` })
    .from(evalBlocks)
    .where(eq(evalBlocks.formId, formId));
  return (row?.max ?? -1) + 1;
}

async function siguienteOrdenPregunta(blockId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<number | null>`max(${evalQuestions.orden})` })
    .from(evalQuestions)
    .where(eq(evalQuestions.blockId, blockId));
  return (row?.max ?? -1) + 1;
}

export async function insertarPreguntas(blockId: string, borradores: PreguntaBorrador[]): Promise<EvalQuestion[]> {
  if (borradores.length === 0) return [];
  const existentes = await db.select({ clave: evalQuestions.clave }).from(evalQuestions).where(eq(evalQuestions.blockId, blockId));
  const usadas = new Set(existentes.map((e) => e.clave));
  let orden = await siguienteOrdenPregunta(blockId);

  const values: NewEvalQuestion[] = borradores.map((b) => {
    const clave = claveUnica(b.clave || slugClave(b.texto), usadas);
    usadas.add(clave);
    return {
      blockId,
      clave,
      texto: b.texto,
      ayuda: b.ayuda ?? null,
      tipo: b.tipo,
      escala: b.escala ?? 'nada_mucho',
      filas: b.filas ?? [],
      opciones: b.opciones ?? [],
      permiteOtra: b.permiteOtra ?? false,
      obligatoria: b.obligatoria ?? true,
      revisar: b.revisar ?? false,
      feedbackAcierto: b.feedbackAcierto ?? null,
      feedbackFallo: b.feedbackFallo ?? null,
      orden: orden++,
    };
  });
  return db.insert(evalQuestions).values(values).returning();
}

export async function actualizarBloque(id: string, patch: { titulo?: string; intro?: string | null }): Promise<void> {
  const set: Record<string, unknown> = {};
  if (patch.titulo !== undefined) set.titulo = patch.titulo;
  if (patch.intro !== undefined) set.intro = patch.intro;
  if (Object.keys(set).length) await db.update(evalBlocks).set(set).where(eq(evalBlocks.id, id));
}

export async function borrarBloque(id: string): Promise<void> {
  await db.delete(evalBlocks).where(eq(evalBlocks.id, id));
}

export async function actualizarPregunta(id: string, patch: Partial<EvalQuestion>): Promise<void> {
  const campos = ['texto', 'ayuda', 'tipo', 'escala', 'filas', 'opciones', 'permiteOtra', 'obligatoria', 'revisar', 'feedbackAcierto', 'feedbackFallo'] as const;
  const set: Record<string, unknown> = {};
  for (const k of campos) if (patch[k] !== undefined) set[k] = patch[k];
  if (Object.keys(set).length) await db.update(evalQuestions).set(set).where(eq(evalQuestions.id, id));
}

export async function borrarPregunta(id: string): Promise<void> {
  await db.delete(evalQuestions).where(eq(evalQuestions.id, id));
}

export async function duplicarPregunta(id: string): Promise<EvalQuestion | null> {
  const [q] = await db.select().from(evalQuestions).where(eq(evalQuestions.id, id)).limit(1);
  if (!q) return null;
  const [nueva] = await insertarPreguntas(q.blockId, [
    {
      clave: q.clave,
      texto: q.texto,
      ayuda: q.ayuda,
      tipo: q.tipo as PreguntaBorrador['tipo'],
      escala: q.escala,
      filas: q.filas,
      opciones: q.opciones,
      permiteOtra: q.permiteOtra,
      obligatoria: q.obligatoria,
      revisar: q.revisar,
      feedbackAcierto: q.feedbackAcierto,
      feedbackFallo: q.feedbackFallo,
    },
  ]);
  // La copia va justo detrás del original, no al final.
  await reordenarTrasDuplicado(q.blockId, q.orden, nueva.id);
  return nueva;
}

async function reordenarTrasDuplicado(blockId: string, ordenOriginal: number, nuevaId: string): Promise<void> {
  const todas = await db.select().from(evalQuestions).where(eq(evalQuestions.blockId, blockId)).orderBy(asc(evalQuestions.orden));
  const sinNueva = todas.filter((q) => q.id !== nuevaId);
  const idx = sinNueva.findIndex((q) => q.orden === ordenOriginal);
  const nueva = todas.find((q) => q.id === nuevaId)!;
  const finales = [...sinNueva.slice(0, idx + 1), nueva, ...sinNueva.slice(idx + 1)];
  await guardarOrdenPreguntas(finales.map((q) => q.id));
}

async function guardarOrdenPreguntas(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i++) {
    await db.update(evalQuestions).set({ orden: i }).where(eq(evalQuestions.id, ids[i]));
  }
}

async function guardarOrdenBloques(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i++) {
    await db.update(evalBlocks).set({ orden: i }).where(eq(evalBlocks.id, ids[i]));
  }
}

/** Guarda el orden completo tal como ha quedado tras arrastrar o subir/bajar. */
export async function reordenarPreguntas(blockId: string, ids: string[]): Promise<void> {
  const actuales = await db.select({ id: evalQuestions.id }).from(evalQuestions).where(eq(evalQuestions.blockId, blockId));
  const validos = new Set(actuales.map((a) => a.id));
  await guardarOrdenPreguntas(ids.filter((id) => validos.has(id)));
}

export async function reordenarBloques(formId: string, ids: string[]): Promise<void> {
  const actuales = await db.select({ id: evalBlocks.id }).from(evalBlocks).where(eq(evalBlocks.formId, formId));
  const validos = new Set(actuales.map((a) => a.id));
  await guardarOrdenBloques(ids.filter((id) => validos.has(id)));
}

// ─── Respuestas ───────────────────────────────────────────────────────────────

export interface GuardarRespuestaInput {
  form: FormCompleto;
  inviteToken?: string | null;
  curso?: string | null;
  letra?: string | null;
  etapa?: string | null;
  email?: string | null;
  respuestas: { questionId: string; filaClave?: string | null; valorNum?: number | null; opcionClave?: string | null; valorTexto?: string | null }[];
}

export async function guardarRespuesta(input: GuardarRespuestaInput): Promise<{ responseId: string }> {
  const { form } = input;

  // Trazabilidad interna: SOLO alumnado (y familias) con enlace personalizado. En
  // profesorado no se toca nunca, ni siquiera se marca la invitación como usada.
  let eduStudentId: string | null = null;
  let curso = input.curso ?? null;
  let letra = input.letra ?? null;
  let invite: { id: string } | null = null;

  if (input.inviteToken && form.audiencia !== 'profesores' && form.identificaAlumno) {
    const [inv] = await db
      .select()
      .from(evalInvites)
      .where(and(eq(evalInvites.token, input.inviteToken), eq(evalInvites.formId, form.id)))
      .limit(1);
    if (inv?.eduStudentId) {
      eduStudentId = inv.eduStudentId;
      invite = { id: inv.id };
      const [al] = await db
        .select({ curso: eduStudents.curso, letra: eduStudents.letra })
        .from(eduStudents)
        .where(eq(eduStudents.id, inv.eduStudentId))
        .limit(1);
      if (al) {
        curso = al.curso;
        letra = al.letra;
      }
    }
  }

  const [respuesta] = await db
    .insert(evalResponses)
    .values({
      formId: form.id,
      eduStudentId,
      curso,
      letra,
      etapa: input.etapa ?? (curso ? etapaDeCurso(curso) : null),
      email: form.anonimo ? null : input.email ?? null,
    })
    .returning();

  if (input.respuestas.length > 0) {
    await db.insert(evalAnswers).values(
      input.respuestas.map((r) => ({
        responseId: respuesta.id,
        questionId: r.questionId,
        filaClave: r.filaClave ?? null,
        valorNum: r.valorNum ?? null,
        opcionClave: r.opcionClave ?? null,
        valorTexto: r.valorTexto ?? null,
      })),
    );
  }

  if (invite) await db.update(evalInvites).set({ respondedAt: new Date() }).where(eq(evalInvites.id, invite.id));
  return { responseId: respuesta.id };
}

// ─── Invitaciones (enlaces personalizados) ────────────────────────────────────

export interface DestinatarioAlumno {
  eduStudentId: string;
  nombre: string;
  curso: string | null;
  letra: string | null;
  email: string | null;
  token: string;
  yaRespondio: boolean;
}

/**
 * Asegura una invitación por alumno de las clases del formulario. Idempotente: los
 * enlaces ya enviados siguen valiendo si se vuelve a llamar antes de otro envío.
 */
export async function ensureInvitacionesAlumnos(formId: string, clases: Clase[]): Promise<DestinatarioAlumno[]> {
  const alumnado = await db
    .select({
      id: eduStudents.id,
      nombre: eduStudents.nombre,
      apellido1: eduStudents.apellido1,
      curso: eduStudents.curso,
      letra: eduStudents.letra,
      email: eduStudents.email,
      emailGoogle: eduStudents.emailGoogle,
    })
    .from(eduStudents)
    .where(eq(eduStudents.active, true));

  const objetivo = clases.length
    ? alumnado.filter((a) => clases.some((c) => c.curso === a.curso && (c.letra ?? null) === (a.letra ?? null)))
    : [];

  const existentes = await db.select().from(evalInvites).where(eq(evalInvites.formId, formId));
  const porAlumno = new Map(existentes.filter((i) => i.eduStudentId).map((i) => [i.eduStudentId!, i]));

  const nuevas = objetivo
    .filter((a) => !porAlumno.has(a.id))
    .map((a) => ({
      formId,
      token: nuevoTokenInvitacion(),
      eduStudentId: a.id,
      email: a.emailGoogle ?? a.email ?? null,
    }));
  for (let i = 0; i < nuevas.length; i += 200) {
    const chunk = nuevas.slice(i, i + 200);
    if (chunk.length) {
      const insertadas = await db.insert(evalInvites).values(chunk).returning();
      for (const inv of insertadas) porAlumno.set(inv.eduStudentId!, inv);
    }
  }

  return objetivo.map((a) => {
    const inv = porAlumno.get(a.id)!;
    return {
      eduStudentId: a.id,
      nombre: [a.nombre, a.apellido1].filter(Boolean).join(' '),
      curso: a.curso,
      letra: a.letra,
      email: a.emailGoogle ?? a.email ?? null,
      token: inv.token,
      yaRespondio: inv.respondedAt !== null,
    };
  });
}

export interface DestinatarioProfe {
  id: string;
  nombre: string;
  email: string | null;
  etapa: string | null;
}

/**
 * Destinatarios de un formulario de profesorado. Aquí NO hay enlace personalizado: el
 * enlace es el del formulario, igual para todos, porque la evaluación es 100 % anónima
 * y no queremos ni poder correlacionar quién ha respondido.
 */
export async function getDestinatariosProfes(etapas: string[] = []): Promise<DestinatarioProfe[]> {
  const profes = await db.select().from(eduTeachers).where(eq(eduTeachers.active, true));
  return profes
    .filter((p) => (etapas.length === 0 ? true : etapas.includes(p.etapa ?? '')))
    .map((p) => ({
      id: p.id,
      nombre: [p.nombre, p.apellido1].filter(Boolean).join(' '),
      email: p.email,
      etapa: p.etapa,
    }));
}

export async function marcarInvitacionesEnviadas(tokens: string[]): Promise<void> {
  for (let i = 0; i < tokens.length; i += 200) {
    const chunk = tokens.slice(i, i + 200);
    if (chunk.length) await db.update(evalInvites).set({ sentAt: new Date() }).where(inArray(evalInvites.token, chunk));
  }
}

// ─── Resultados ───────────────────────────────────────────────────────────────

export interface ResultadoFila {
  clave: string;
  texto: string;
  n: number;
  media: number | null; // en unidades de la escala
  mediaPct: number | null; // 0-100 comparable entre escalas
  distribucion: { valor: number; label: string; n: number }[];
}

export interface ResultadoPregunta {
  id: string;
  clave: string;
  texto: string;
  ayuda: string | null;
  tipo: string;
  escala: string;
  n: number;
  mediaPct: number | null;
  filas: ResultadoFila[];
  opciones: { clave: string; texto: string; n: number; correcta: boolean }[];
  otras: string[];
  textos: { valor: string; clase: string | null }[];
}

export interface ResultadoBloque {
  id: string;
  titulo: string;
  actividadId: string | null;
  serieId: string | null;
  mediaPct: number | null;
  preguntas: ResultadoPregunta[];
}

export interface ResultadoClase {
  curso: string;
  letra: string | null;
  respuestas: number;
  objetivo: number;
  mediaPct: number | null;
}

export interface Resultados {
  form: FormCompleto;
  totalRespuestas: number;
  objetivo: number | null;
  mediaPct: number | null;
  bloques: ResultadoBloque[];
  clases: ResultadoClase[];
  etapas: { etapa: string; respuestas: number; mediaPct: number | null }[];
  avisos: string[];
}

/**
 * Agregados de un formulario. Con `filtro` se recalcula todo mirando solo a una clase:
 * es lo que permite "navegar por clases" sin duplicar la lógica de agregación.
 */
export async function getResultados(formId: string, filtro?: Clase | null): Promise<Resultados | null> {
  const form = await getFormCompleto(formId);
  if (!form) return null;

  const todas = await db.select().from(evalResponses).where(eq(evalResponses.formId, formId));
  const respuestas = filtro
    ? todas.filter((r) => r.curso === filtro.curso && (r.letra ?? null) === (filtro.letra ?? null))
    : todas;
  const idsRespuesta = new Set(respuestas.map((r) => r.id));
  const questionIds = form.bloques.flatMap((b) => b.preguntas.map((q) => q.id));
  const answersTodas = questionIds.length
    ? await db.select().from(evalAnswers).where(inArray(evalAnswers.questionId, questionIds))
    : [];
  const answers = filtro ? answersTodas.filter((a) => idsRespuesta.has(a.responseId)) : answersTodas;

  const respuestaPorId = new Map(respuestas.map((r) => [r.id, r]));
  const claseDe = (responseId: string) => {
    const r = respuestaPorId.get(responseId);
    if (!r?.curso) return null;
    return r.letra && r.letra !== 'PDC' ? `${r.curso} ${r.letra}` : r.curso;
  };

  const porPregunta = new Map<string, typeof answers>();
  for (const a of answers) {
    const lista = porPregunta.get(a.questionId) ?? [];
    lista.push(a);
    porPregunta.set(a.questionId, lista);
  }

  const pctPorRespuesta = new Map<string, number[]>(); // para medias por clase/etapa

  const bloques: ResultadoBloque[] = form.bloques.map((b) => {
    const preguntas: ResultadoPregunta[] = b.preguntas.map((q) => {
      const dadas = porPregunta.get(q.id) ?? [];
      const escala = escalaDe(q.escala);
      const filas: ResultadoFila[] = [];
      let pctsPregunta: number[] = [];

      if (q.tipo === 'escala') {
        const definidas = q.filas.length > 0 ? q.filas : [{ clave: '', texto: q.texto }];
        for (const f of definidas) {
          const vals = dadas
            .filter((a) => (q.filas.length > 0 ? a.filaClave === f.clave : true))
            .map((a) => a.valorNum)
            .filter((v): v is number => v !== null);
          const pcts = vals.map((v) => aPct(v, q.escala)).filter((p): p is number => p !== null);
          pctsPregunta = pctsPregunta.concat(pcts);
          filas.push({
            clave: f.clave,
            texto: f.texto,
            n: vals.length,
            media: mediaBruta(vals),
            mediaPct: mediaPorcentaje(vals, q.escala),
            distribucion: escala.puntos.map((p) => ({ valor: p.valor, label: p.label, n: vals.filter((v) => v === p.valor).length })),
          });
        }
        // Aporte de esta pregunta a la media de cada respuesta (para segmentar por clase)
        for (const a of dadas) {
          if (a.valorNum === null) continue;
          const p = aPct(a.valorNum, q.escala);
          if (p === null) continue;
          const lista = pctPorRespuesta.get(a.responseId) ?? [];
          lista.push(p);
          pctPorRespuesta.set(a.responseId, lista);
        }
      }

      const opciones = q.opciones.map((o) => ({
        clave: o.clave,
        texto: o.texto,
        n: dadas.filter((a) => a.opcionClave === o.clave).length,
        correcta: o.correcta === true,
      }));
      const otras = dadas.filter((a) => a.opcionClave === 'otra' && a.valorTexto).map((a) => a.valorTexto!);
      const textos =
        q.tipo === 'texto'
          ? dadas.filter((a) => a.valorTexto).map((a) => ({ valor: a.valorTexto!, clase: claseDe(a.responseId) }))
          : [];

      const nRespondientes = new Set(dadas.map((a) => a.responseId)).size;
      return {
        id: q.id,
        clave: q.clave,
        texto: q.texto,
        ayuda: q.ayuda,
        tipo: q.tipo,
        escala: q.escala,
        n: nRespondientes,
        mediaPct: pctsPregunta.length ? pctsPregunta.reduce((s, p) => s + p, 0) / pctsPregunta.length : null,
        filas,
        opciones,
        otras,
        textos,
      };
    });

    const pcts = preguntas.map((p) => p.mediaPct).filter((p): p is number => p !== null);
    return {
      id: b.id,
      titulo: b.titulo,
      actividadId: b.activityId,
      serieId: b.actividad?.serieId ?? null,
      mediaPct: pcts.length ? pcts.reduce((s, p) => s + p, 0) / pcts.length : null,
      preguntas,
    };
  });

  // Aporte medio de cada respuesta, calculado sobre TODAS (no solo las del filtro):
  // el navegador de clases tiene que seguir mostrando la media de las demás.
  const escalaPorPregunta = new Map(form.bloques.flatMap((b) => b.preguntas.map((q) => [q.id, q.escala] as const)));
  const pctPorRespuestaGlobal = new Map<string, number[]>();
  for (const a of answersTodas) {
    if (a.valorNum === null) continue;
    const escalaValue = escalaPorPregunta.get(a.questionId);
    if (!escalaValue) continue;
    const p = aPct(a.valorNum, escalaValue);
    if (p === null) continue;
    const lista = pctPorRespuestaGlobal.get(a.responseId) ?? [];
    lista.push(p);
    pctPorRespuestaGlobal.set(a.responseId, lista);
  }

  // Segmentación por clase (alumnado) y etapa (profesorado)
  const alumnado =
    form.audiencia === 'alumnos'
      ? await db.select({ curso: eduStudents.curso, letra: eduStudents.letra }).from(eduStudents).where(eq(eduStudents.active, true))
      : [];

  const clasesObjetivo: Clase[] = (form.clases ?? []).length
    ? form.clases
    : [...new Map(todas.filter((r) => r.curso).map((r) => [`${r.curso}|${r.letra ?? ''}`, { curso: r.curso!, letra: r.letra }])).values()];

  // El desglose por clase se calcula siempre sobre TODAS las respuestas, aunque haya
  // filtro activo: si no, al entrar en una clase desaparecerían las demás del navegador.
  const clases: ResultadoClase[] = clasesObjetivo
    .map((c) => {
      const suyas = todas.filter((r) => r.curso === c.curso && (r.letra ?? null) === (c.letra ?? null));
      const pcts = suyas.flatMap((r) => pctPorRespuestaGlobal.get(r.id) ?? []);
      return {
        curso: c.curso,
        letra: c.letra,
        respuestas: suyas.length,
        objetivo: alumnado.filter((a) => a.curso === c.curso && (a.letra ?? null) === (c.letra ?? null)).length,
        mediaPct: pcts.length ? pcts.reduce((s, p) => s + p, 0) / pcts.length : null,
      };
    })
    .sort(compararClasesMayoresPrimero);

  const etapasSet = [...new Set(respuestas.map((r) => r.etapa).filter((e): e is string => !!e))];
  const etapas = etapasSet.map((etapa) => {
    const suyas = respuestas.filter((r) => r.etapa === etapa);
    const pcts = suyas.flatMap((r) => pctPorRespuesta.get(r.id) ?? []);
    return { etapa, respuestas: suyas.length, mediaPct: pcts.length ? pcts.reduce((s, p) => s + p, 0) / pcts.length : null };
  });

  const todosPcts = [...pctPorRespuesta.values()].flat();
  const mediaPct = todosPcts.length ? todosPcts.reduce((s, p) => s + p, 0) / todosPcts.length : null;

  return {
    form,
    totalRespuestas: respuestas.length,
    objetivo: clases.length ? clases.reduce((s, c) => s + c.objetivo, 0) || null : null,
    mediaPct,
    bloques,
    clases,
    etapas,
    avisos: construirAvisos(clases, bloques),
  };
}

function aPct(valor: number, escalaValue: string): number | null {
  const puntos = escalaDe(escalaValue).puntos;
  const min = puntos[0].valor;
  const max = puntos[puntos.length - 1].valor;
  if (max === min) return null;
  return ((valor - min) / (max - min)) * 100;
}

/** Los "insights" del dashboard: participación floja y qué valora peor cada quien. */
function construirAvisos(clases: ResultadoClase[], bloques: ResultadoBloque[]): string[] {
  const avisos: string[] = [];
  const flojas = clases.filter((c) => c.objetivo > 0 && c.respuestas > 0 && c.respuestas / c.objetivo < 0.4);
  for (const c of flojas) {
    avisos.push(`Participación baja en ${c.letra && c.letra !== 'PDC' ? `${c.curso} ${c.letra}` : c.curso}: ${c.respuestas} de ${c.objetivo}.`);
  }
  const sinRespuesta = clases.filter((c) => c.objetivo > 0 && c.respuestas === 0);
  if (sinRespuesta.length > 0) {
    avisos.push(`Sin ninguna respuesta todavía: ${sinRespuesta.map((c) => (c.letra && c.letra !== 'PDC' ? `${c.curso} ${c.letra}` : c.curso)).join(', ')}.`);
  }
  const conMedia = clases.filter((c) => c.mediaPct !== null && c.respuestas >= 3);
  if (conMedia.length >= 2) {
    const peor = [...conMedia].sort((a, b) => a.mediaPct! - b.mediaPct!)[0];
    avisos.push(`La clase que peor valora es ${peor.letra && peor.letra !== 'PDC' ? `${peor.curso} ${peor.letra}` : peor.curso} (${Math.round(peor.mediaPct!)} / 100).`);
  }
  const filasFlojas = bloques
    .flatMap((b) => b.preguntas.flatMap((p) => p.filas.map((f) => ({ bloque: b.titulo, texto: f.texto, pct: f.mediaPct, n: f.n }))))
    .filter((f) => f.pct !== null && f.n >= 3)
    .sort((a, b) => a.pct! - b.pct!);
  if (filasFlojas.length > 0 && filasFlojas[0].pct! < 65) {
    avisos.push(`Lo peor valorado: "${filasFlojas[0].texto}" (${Math.round(filasFlojas[0].pct!)} / 100).`);
  }
  return avisos;
}

// ─── Comparativas ─────────────────────────────────────────────────────────────

export interface PuntoComparativa {
  formId: string;
  titulo: string;
  academicYear: string;
  audiencia: string;
  fecha: string | null;
  respuestas: number;
  mediaPct: number | null;
}

/**
 * Todas las ediciones de una misma actividad (su `serieId`), año a año y audiencia a
 * audiencia. Es la vista de "visión alumnos vs visión profes" y de "¿mejoramos
 * respecto al curso pasado?".
 */
export async function getComparativaSerie(serieId: string): Promise<PuntoComparativa[]> {
  const actividades = await db.select().from(evalActivities).where(eq(evalActivities.serieId, serieId));
  if (actividades.length === 0) return [];
  const bloques = await db
    .select({ formId: evalBlocks.formId, activityId: evalBlocks.activityId })
    .from(evalBlocks)
    .where(inArray(evalBlocks.activityId, actividades.map((a) => a.id)));
  const formIds = [...new Set(bloques.map((b) => b.formId))];
  if (formIds.length === 0) return [];

  const puntos = await Promise.all(
    formIds.map(async (formId) => {
      const res = await getResultados(formId);
      if (!res) return null;
      const act = actividades.find((a) => bloques.some((b) => b.formId === formId && b.activityId === a.id));
      return {
        formId,
        titulo: res.form.titulo,
        academicYear: res.form.academicYear,
        audiencia: res.form.audiencia,
        fecha: act?.fecha ?? null,
        respuestas: res.totalRespuestas,
        mediaPct: res.mediaPct,
      } satisfies PuntoComparativa;
    }),
  );
  return puntos
    .filter((p): p is PuntoComparativa => p !== null)
    .sort((a, b) => a.academicYear.localeCompare(b.academicYear) || a.audiencia.localeCompare(b.audiencia));
}

/** Ranking de las actividades de un curso académico: qué gustó más y qué menos. */
export async function getRankingActividades(academicYear: string): Promise<
  { activityId: string; nombre: string; categoria: string; audiencia: string; formId: string; respuestas: number; mediaPct: number | null }[]
> {
  const forms = await db.select().from(evalForms).where(eq(evalForms.academicYear, academicYear));
  const filas: { activityId: string; nombre: string; categoria: string; audiencia: string; formId: string; respuestas: number; mediaPct: number | null }[] = [];
  for (const f of forms) {
    const res = await getResultados(f.id);
    if (!res || res.totalRespuestas === 0) continue;
    for (const b of res.bloques) {
      const act = res.form.bloques.find((x) => x.id === b.id)?.actividad;
      if (!act) continue;
      filas.push({
        activityId: act.id,
        nombre: act.nombre,
        categoria: act.categoria,
        audiencia: f.audiencia,
        formId: f.id,
        respuestas: res.totalRespuestas,
        mediaPct: b.mediaPct,
      });
    }
  }
  return filas.sort((a, b) => (b.mediaPct ?? -1) - (a.mediaPct ?? -1));
}

// ─── Plantillas de correo ─────────────────────────────────────────────────────

export async function getPlantillasCorreo() {
  return db.select().from(evalEmailTemplates).orderBy(desc(evalEmailTemplates.updatedAt));
}

export async function guardarPlantillaCorreo(input: {
  id?: string;
  nombre: string;
  audiencia: string;
  subject: string;
  body: string;
  createdByEmail?: string | null;
}) {
  if (input.id) {
    const [row] = await db
      .update(evalEmailTemplates)
      .set({ nombre: input.nombre, audiencia: input.audiencia, subject: input.subject, body: input.body, updatedAt: new Date() })
      .where(eq(evalEmailTemplates.id, input.id))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(evalEmailTemplates)
    .values({
      nombre: input.nombre,
      audiencia: input.audiencia,
      subject: input.subject,
      body: input.body,
      createdByEmail: input.createdByEmail ?? null,
    })
    .returning();
  return row;
}

export async function borrarPlantillaCorreo(id: string): Promise<void> {
  await db.delete(evalEmailTemplates).where(eq(evalEmailTemplates.id, id));
}

// ─── Clases disponibles ───────────────────────────────────────────────────────

export async function getClasesDisponibles(): Promise<Clase[]> {
  const rows = await db
    .selectDistinct({ curso: eduStudents.curso, letra: eduStudents.letra })
    .from(eduStudents)
    .where(eq(eduStudents.active, true));
  return rows.filter((r): r is Clase => r.curso !== null).sort(compararClasesMayoresPrimero);
}
