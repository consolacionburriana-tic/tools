// Planificación y ejecución de una tirada del cuaderno de tutor.
//
// Una tirada se planifica entera antes de empezar (qué documentos van a salir y qué
// bloqueos hay) y se ejecuta como una cola de ítems en Neon. El worker coge ítems mientras
// le quede tiempo de función y se re-despierta; el navegador de quien la lanzó no participa.
// Ficha: docs/18-cuaderno-tutor.md
import type { CuadItem, CuadPlantilla, CuadTirada } from '@/db/schema';
import { appBaseUrl } from '@/lib/constants';
import { etapaDeCurso, type Etapa } from '@/lib/cursos';
import { analizarEtiqueta, avisosDePlantilla, type Repeticion } from '@/lib/cuaderno/campos';
import {
  asegurarCarpeta,
  compartirCarpeta,
  descargarArchivo,
  exportarDocx,
  mensajeDeError,
  buscarEnCarpeta,
  copiarArchivo,
  subirPdf,
  type RolDrive,
} from '@/lib/cuaderno/drive';
import { generarDocumento, unirPdfs } from '@/lib/cuaderno/generar';
import {
  CARPETA_PLANTILLAS,
  carpetaClase,
  carpetaCursoEscolar,
  carpetaEjecucion,
  cursoEscolarLargo,
  limpiarNombre,
  nombreCuadernoCompleto,
} from '@/lib/cuaderno/nombres';
import {
  actualizarTirada,
  asegurarNumeracion,
  getAjustes,
  getAsignaturas,
  getClasesCuaderno,
  getItemsDeTirada,
  getMapeo,
  getPlantillas,
  getProgreso,
  getTirada,
  marcarItem,
  reclamarItem,
  registrarHojas,
  type AlumnoCuaderno,
  type AsignaturaCuaderno,
  type ClaseCuaderno,
  type ItemNuevo,
  type OpcionesTirada,
  type TutorCuaderno,
} from '@/lib/cuaderno-server';
import { avisarTutorDelCuaderno } from '@/lib/cuaderno-email';

// ─── Planificación ────────────────────────────────────────────────────────────

export interface GrupoTutor {
  tutor: TutorCuaderno | null;
  indiceTutor: number;
  alumnos: AlumnoCuaderno[];
}

/**
 * Reparto de una clase entre sus tutores. Con un tutor (o ninguno) el juego es uno y lleva
 * a toda la clase; con dos o tres, cada uno lleva a **sus** alumnos según el tutor personal
 * de `edu_tutor_personal`. El alumnado sin tutor personal NO se reparte a dedo: se queda
 * fuera y se avisa, porque adivinarlo es justo la clase de error que luego nadie encuentra.
 */
export function gruposDeClase(clase: ClaseCuaderno): { grupos: GrupoTutor[]; sinTutorPersonal: AlumnoCuaderno[] } {
  if (clase.tutores.length === 0) {
    return { grupos: [{ tutor: null, indiceTutor: 1, alumnos: clase.alumnos }], sinTutorPersonal: [] };
  }
  if (clase.tutores.length === 1) {
    return { grupos: [{ tutor: clase.tutores[0], indiceTutor: 1, alumnos: clase.alumnos }], sinTutorPersonal: [] };
  }
  const grupos: GrupoTutor[] = clase.tutores.map((tutor, i) => ({ tutor, indiceTutor: i + 1, alumnos: [] }));
  const sinTutorPersonal: AlumnoCuaderno[] = [];
  for (const alumno of clase.alumnos) {
    const grupo = grupos.find((g) => g.tutor?.teacherId === alumno.tutorPersonalId);
    if (grupo) grupo.alumnos.push(alumno);
    else sinTutorPersonal.push(alumno);
  }
  return { grupos: grupos.filter((g) => g.alumnos.length > 0), sinTutorPersonal };
}

export interface DocumentoPrevisto {
  plantillaId: string;
  plantillaNombre: string;
  curso: string;
  letra: string | null;
  clase: string;
  tutorNombre: string;
  indiceTutor: number;
  numAlumnos: number;
  nombre: string;
}

export interface PlanTirada {
  items: ItemNuevo[];
  previsto: DocumentoPrevisto[];
  bloqueos: string[];
  avisos: string[];
  etapas: Etapa[];
}

/** ¿Esta plantilla aplica a esta etapa? Sin etapa, vale para todas. */
const aplicaEtapa = (plantilla: CuadPlantilla, etapa: Etapa | null) => !plantilla.etapa || plantilla.etapa === etapa;

/**
 * Planifica una tirada: qué documentos saldrían y qué impide lanzarla. Se usa para la
 * vista previa del panel y para crear los ítems, con el mismo código en los dos casos.
 */
export async function planificarTirada(opciones: {
  clases: { curso: string; letra: string | null }[];
  plantillaIds: string[];
  soloSinHoja: boolean;
  /** Alumnos a los que limitar la tirada (los que llegaron tarde), por plantilla. */
  faltanPorPlantilla?: Record<string, string[]>;
}): Promise<PlanTirada> {
  const [plantillasTodas, clases, mapeo] = await Promise.all([
    getPlantillas(true),
    getClasesCuaderno({ clases: opciones.clases }),
    getMapeo(),
  ]);
  const plantillas = plantillasTodas
    .filter((p) => opciones.plantillaIds.includes(p.id))
    .sort((a, b) => a.orden - b.orden);

  const bloqueos: string[] = [];
  const avisos: string[] = [];
  if (plantillas.length === 0) bloqueos.push('No has elegido ninguna plantilla.');
  if (clases.length === 0) bloqueos.push('No has elegido ninguna clase con alumnado.');

  for (const plantilla of plantillas) {
    if (!plantilla.etiquetas || !plantilla.analizadaAt) {
      bloqueos.push(`«${plantilla.nombre}»: sin analizar todavía. Dale a «Analizar» en Plantillas.`);
      continue;
    }
    const analizadas = plantilla.etiquetas.map((e) => analizarEtiqueta(e, mapeo));
    for (const aviso of avisosDePlantilla(analizadas, plantilla.repeticion as Repeticion, plantilla.tieneFilas)) {
      (aviso.bloqueante ? bloqueos : avisos).push(`«${plantilla.nombre}»: ${aviso.texto}`);
    }
  }

  const items: ItemNuevo[] = [];
  const previsto: DocumentoPrevisto[] = [];
  const etapas = new Set<Etapa>();

  for (const clase of clases) {
    if (clase.etapa) etapas.add(clase.etapa);
    const { grupos, sinTutorPersonal } = gruposDeClase(clase);
    if (clase.tutores.length === 0) {
      avisos.push(`${clase.clase}: no tiene tutor asignado este curso. Se generará, pero no se puede compartir.`);
    }
    if (sinTutorPersonal.length > 0) {
      avisos.push(
        `${clase.clase}: ${sinTutorPersonal.length} alumno(s) sin tutor personal asignado se quedan fuera. Reparte la clase en Tutorías.`,
      );
    }
    for (const grupo of grupos) {
      for (const plantilla of plantillas) {
        if (!aplicaEtapa(plantilla, clase.etapa)) continue;
        const faltan = opciones.faltanPorPlantilla?.[plantilla.id];
        const alumnos = opciones.soloSinHoja && faltan ? grupo.alumnos.filter((a) => faltan.includes(a.id)) : grupo.alumnos;
        if (alumnos.length === 0) continue;
        items.push({
          plantillaId: plantilla.id,
          curso: clase.curso,
          letra: clase.letra,
          eduTeacherId: grupo.tutor?.teacherId ?? null,
          indiceTutor: grupo.indiceTutor,
          alumnoIds: alumnos.map((a) => a.id),
        });
        previsto.push({
          plantillaId: plantilla.id,
          plantillaNombre: plantilla.nombre,
          curso: clase.curso,
          letra: clase.letra,
          clase: clase.clase,
          tutorNombre: grupo.tutor?.corto ?? 'Sin tutor',
          indiceTutor: grupo.indiceTutor,
          numAlumnos: alumnos.length,
          nombre: `${grupo.indiceTutor}.${plantilla.orden} · ${plantilla.nombre} — ${grupo.tutor?.corto ?? 'Sin tutor'} — ${clase.clase}`,
        });
      }
    }
  }

  if (items.length === 0 && bloqueos.length === 0) {
    bloqueos.push('No hay nada que generar con esa selección (¿ya está todo hecho?).');
  }
  return { items, previsto, bloqueos, avisos, etapas: [...etapas] };
}

// ─── Ejecución ────────────────────────────────────────────────────────────────

const OPCIONES_POR_DEFECTO: OpcionesTirada = {
  formatos: ['doc', 'pdf'],
  cuadernoCompletoPdf: false,
  compartir: true,
  avisarPorCorreo: false,
  soloSinHoja: false,
  subcarpetaPropia: false,
};

export interface ResultadoWorker {
  tiradaId: string;
  procesados: number;
  errores: number;
  pendientes: number;
  terminada: boolean;
}

/** Caché de una invocación del worker: lo que no tiene sentido pedir dos veces. */
interface Cache {
  docx: Map<string, Buffer>;
  asignaturas: Map<string, AsignaturaCuaderno[]>;
  carpetaClase: Map<string, { id: string; url: string }>;
  carpetaEtapa: Map<string, string>;
  clases: Map<string, ClaseCuaderno>;
  numeros: Map<string, Map<string, { asignado: number; alfabetico: number }>>;
}

const claveClase = (curso: string, letra: string | null | undefined) => `${curso}|${letra ?? ''}`;

/**
 * Procesa ítems de una tirada mientras le quede tiempo. Devuelve cuánto queda para que el
 * llamante decida si re-despertarse. Es seguro llamarla en paralelo: cada ítem se reclama
 * con un UPDATE condicional y solo lo coge un worker.
 */
export async function procesarTirada(tiradaId: string, limiteMs = 240_000): Promise<ResultadoWorker> {
  const arranque = Date.now();
  const tirada = await getTirada(tiradaId);
  if (!tirada) throw new Error('Tirada no encontrada');
  if (tirada.estado === 'cancelada' || tirada.estado === 'hecha') {
    return { tiradaId, procesados: 0, errores: 0, pendientes: 0, terminada: true };
  }

  const [ajustes, plantillas, mapeo] = await Promise.all([getAjustes(), getPlantillas(), getMapeo()]);
  if (!ajustes.carpetaBaseId) {
    await actualizarTirada(tiradaId, {
      estado: 'error',
      error: 'Falta la carpeta base de Drive en los ajustes del módulo',
      finishedAt: new Date(),
    });
    return { tiradaId, procesados: 0, errores: 0, pendientes: 0, terminada: true };
  }

  const opciones = { ...OPCIONES_POR_DEFECTO, ...(tirada.opciones ?? {}) };
  const plantillaPorId = new Map(plantillas.map((p) => [p.id, p]));
  const items = await getItemsDeTirada(tiradaId);
  const etapasDeLaTirada = new Set(items.map((i) => etapaDeCurso(i.curso)).filter((e): e is Etapa => e !== null));
  const variasEtapas = etapasDeLaTirada.size > 1;

  if (tirada.estado === 'pendiente') await actualizarTirada(tiradaId, { estado: 'ejecutando' });

  // Carpeta del curso escolar (se reutiliza si ya existe: la tirada 2 no crea otra).
  let carpetaCursoId = tirada.carpetaCursoId;
  if (!carpetaCursoId) {
    const carpeta = await asegurarCarpeta(carpetaCursoEscolar(tirada.academicYear), ajustes.carpetaBaseId);
    carpetaCursoId = carpeta.id;
    await actualizarTirada(tiradaId, { carpetaCursoId: carpeta.id, carpetaCursoUrl: carpeta.url });
  }

  // Todas las clases de la tirada, de una vez.
  const clasesPedidas = [...new Set(items.map((i) => claveClase(i.curso, i.letra)))].map((c) => {
    const [curso, letra] = c.split('|');
    return { curso, letra: letra || null };
  });
  const cache: Cache = {
    docx: new Map(),
    asignaturas: await getAsignaturas(tirada.academicYear),
    carpetaClase: new Map(),
    carpetaEtapa: new Map(),
    clases: new Map(),
    numeros: new Map(),
  };
  for (const clase of await getClasesCuaderno({ clases: clasesPedidas })) {
    cache.clases.set(claveClase(clase.curso, clase.letra), clase);
  }

  let procesados = 0;
  let errores = 0;
  while (Date.now() - arranque < limiteMs) {
    const item = await reclamarItem(tiradaId);
    if (!item) break;
    try {
      await ejecutarItem({ item, tirada, ajustes, opciones, plantillaPorId, mapeo, cache, carpetaCursoId, variasEtapas });
      procesados++;
    } catch (error) {
      errores++;
      await marcarItem(item.id, { estado: 'error', error: mensajeDeError(error) });
    }
  }

  const progreso = await getProgreso(tiradaId);
  const pendientes = (progreso?.pendientes ?? 0) + (progreso?.haciendo ?? 0);
  if (pendientes === 0 && progreso) {
    await finalizarTirada({ tirada, ajustes, opciones, plantillas, carpetaCursoId, variasEtapas, cache });
    await actualizarTirada(tiradaId, {
      estado: progreso.errores > 0 ? 'error' : 'hecha',
      error: progreso.errores > 0 ? `${progreso.errores} documento(s) con error` : null,
      finishedAt: new Date(),
    });
  }
  return { tiradaId, procesados, errores, pendientes, terminada: pendientes === 0 };
}

interface ContextoItem {
  item: CuadItem;
  tirada: CuadTirada;
  ajustes: Awaited<ReturnType<typeof getAjustes>>;
  opciones: OpcionesTirada;
  plantillaPorId: Map<string, CuadPlantilla>;
  mapeo: Map<string, string>;
  cache: Cache;
  carpetaCursoId: string;
  variasEtapas: boolean;
}

/** Carpeta donde va un documento: [curso escolar]/(etapa)/[clase]/(ejecución N). */
async function carpetaDestino(ctx: ContextoItem, clase: ClaseCuaderno): Promise<{ id: string; url: string }> {
  const { cache, carpetaCursoId, variasEtapas, tirada, opciones } = ctx;
  let padre = carpetaCursoId;
  if (variasEtapas && clase.etapa) {
    const cacheada = cache.carpetaEtapa.get(clase.etapa);
    if (cacheada) padre = cacheada;
    else {
      const carpeta = await asegurarCarpeta(clase.etapa, carpetaCursoId);
      cache.carpetaEtapa.set(clase.etapa, carpeta.id);
      padre = carpeta.id;
    }
  }

  const clave = claveClase(clase.curso, clase.letra);
  let deLaClase = cache.carpetaClase.get(clave);
  if (!deLaClase) {
    const nombre = limpiarNombre(carpetaClase(clase.curso, clase.letra, clase.tutores.map((t) => t.corto)));
    deLaClase = await asegurarCarpeta(nombre, padre);
    cache.carpetaClase.set(clave, deLaClase);
  }

  // Las tiradas posteriores a la primera van a su propia subcarpeta dentro de la carpeta de
  // la clase (que ya está compartida): el alumnado que llega tarde no rehace nada de nadie.
  const propia = opciones.subcarpetaPropia || tirada.numero > 1;
  if (!propia) return deLaClase;
  const claveEjecucion = `${clave}#${tirada.numero}`;
  const cacheada = cache.carpetaClase.get(claveEjecucion);
  if (cacheada) return cacheada;
  const carpeta = await asegurarCarpeta(carpetaEjecucion(tirada.numero, tirada.createdAt), deLaClase.id);
  cache.carpetaClase.set(claveEjecucion, carpeta);
  return carpeta;
}

async function ejecutarItem(ctx: ContextoItem): Promise<void> {
  const { item, tirada, ajustes, opciones, plantillaPorId, mapeo, cache } = ctx;
  const plantilla = plantillaPorId.get(item.plantillaId);
  if (!plantilla) throw new Error('La plantilla ya no existe');
  const clase = cache.clases.get(claveClase(item.curso, item.letra));
  if (!clase) throw new Error(`La clase ${item.curso} ${item.letra} ya no tiene alumnado activo`);

  // El alumnado del documento, en el orden de la lista de la clase (no en el del snapshot).
  const alumnos = clase.alumnos.filter((a) => item.alumnoIds.includes(a.id));
  if (alumnos.length === 0) {
    await marcarItem(item.id, { estado: 'omitido', error: 'Sin alumnado (bajas desde que se planificó)' });
    return;
  }
  const tutor = clase.tutores.find((t) => t.teacherId === item.eduTeacherId) ?? null;

  // La numeración se congela sobre la clase ENTERA, no sobre el trozo de este tutor: el
  // nº de lista es de la clase.
  let numeros = cache.numeros.get(claveClase(item.curso, item.letra));
  if (!numeros) {
    numeros = await asegurarNumeracion(tirada.academicYear, clase.curso, clase.letra, clase.alumnos);
    cache.numeros.set(claveClase(item.curso, item.letra), numeros);
  }

  let docx = cache.docx.get(plantilla.id);
  if (!docx) {
    docx = await exportarDocx(plantilla.googleDocId);
    cache.docx.set(plantilla.id, docx);
  }

  const carpeta = await carpetaDestino(ctx, clase);
  const resultado = await generarDocumento({
    datos: {
      plantilla,
      ajustes,
      cursoEscolar: cursoEscolarLargo(tirada.academicYear),
      clase,
      tutor,
      alumnos,
      asignaturas: cache.asignaturas.get(clase.curso) ?? [],
      numeros,
      mapeo,
    },
    plantillaDocx: docx,
    plantillaNombre: plantilla.nombre,
    indiceTutor: item.indiceTutor,
    indicePlantilla: plantilla.orden,
    carpetaId: carpeta.id,
    conPdf: opciones.formatos.includes('pdf') && plantilla.generaPdf,
    previos: { docId: item.docId, pdfId: item.pdfId },
  });

  await marcarItem(item.id, {
    estado: 'hecho',
    docId: resultado.docId,
    docUrl: resultado.docUrl,
    pdfId: resultado.pdfId,
    pdfUrl: resultado.pdfUrl,
    carpetaId: carpeta.id,
    carpetaUrl: carpeta.url,
    error: resultado.sinResolver.length > 0 ? `Etiquetas sin datos: ${resultado.sinResolver.join(', ')}` : null,
  });
  await registrarHojas({
    alumnoIds: alumnos.map((a) => a.id),
    plantillaId: plantilla.id,
    academicYear: tirada.academicYear,
    tiradaId: tirada.id,
    itemId: item.id,
  });
}

// ─── Cierre de la tirada ─────────────────────────────────────────────────────

/**
 * Lo que se hace una vez, cuando ya no queda ningún documento por generar: el PDF del
 * cuaderno completo de cada tutor, la copia de las plantillas usadas, y compartir las
 * carpetas de clase con sus tutores. Todo idempotente, porque el worker puede llegar aquí
 * dos veces si dos invocaciones acaban a la vez.
 */
async function finalizarTirada(opciones: {
  tirada: CuadTirada;
  ajustes: Awaited<ReturnType<typeof getAjustes>>;
  opciones: OpcionesTirada;
  plantillas: CuadPlantilla[];
  carpetaCursoId: string;
  variasEtapas: boolean;
  cache: Cache;
}): Promise<void> {
  const { tirada, ajustes, plantillas, carpetaCursoId, cache } = opciones;
  const conf = opciones.opciones;
  const items = (await getItemsDeTirada(tirada.id)).filter((i) => i.estado === 'hecho');
  if (items.length === 0) return;

  // Copia de las plantillas usadas, para saber con qué se generó el curso.
  try {
    const carpetaPlantillas = await asegurarCarpeta(CARPETA_PLANTILLAS, carpetaCursoId);
    const usadas = new Set(items.map((i) => i.plantillaId));
    for (const plantilla of plantillas.filter((p) => usadas.has(p.id))) {
      const nombre = limpiarNombre(`${plantilla.orden} · ${plantilla.nombre} (plantilla usada)`);
      if (await buscarEnCarpeta(nombre, carpetaPlantillas.id)) continue;
      await copiarArchivo(plantilla.googleDocId, nombre, carpetaPlantillas.id);
    }
  } catch (error) {
    // Es trazabilidad, no el producto: si falla, la tirada sigue siendo buena.
    console.error('[cuaderno] no se pudo copiar la plantilla usada:', mensajeDeError(error));
  }

  // PDF con todo el cuaderno de cada tutor.
  if (conf.cuadernoCompletoPdf && conf.formatos.includes('pdf')) {
    const grupos = new Map<string, CuadItem[]>();
    for (const item of items) {
      const clave = `${claveClase(item.curso, item.letra)}#${item.eduTeacherId ?? 'sin'}`;
      grupos.set(clave, [...(grupos.get(clave) ?? []), item]);
    }
    for (const grupo of grupos.values()) {
      const conPdf = grupo.filter((i) => i.pdfId).sort((a, b) => a.indiceTutor - b.indiceTutor);
      if (conPdf.length < 2 || !conPdf[0].carpetaId) continue;
      const clase = cache.clases.get(claveClase(conPdf[0].curso, conPdf[0].letra));
      const tutor = clase?.tutores.find((t) => t.teacherId === conPdf[0].eduTeacherId);
      const nombre = limpiarNombre(
        `${nombreCuadernoCompleto(tutor?.corto ?? 'Sin tutor', clase?.clase ?? conPdf[0].curso)}.pdf`,
      );
      try {
        if (await buscarEnCarpeta(nombre, conPdf[0].carpetaId)) continue;
        const pdfs: Buffer[] = [];
        for (const item of conPdf) pdfs.push(await descargarArchivo(item.pdfId as string));
        await subirPdf({ nombre, carpetaId: conPdf[0].carpetaId, pdf: await unirPdfs(pdfs) });
      } catch (error) {
        console.error('[cuaderno] no se pudo unir el cuaderno completo:', mensajeDeError(error));
      }
    }
  }

  // Compartir la carpeta de la clase con sus tutores (nunca por enlace).
  if (!conf.compartir) return;
  const rol = (ajustes.permisoTutores === 'reader' ? 'reader' : 'writer') as RolDrive;
  const porClase = new Map<string, CuadItem[]>();
  for (const item of items) {
    const clave = claveClase(item.curso, item.letra);
    porClase.set(clave, [...(porClase.get(clave) ?? []), item]);
  }
  for (const [clave, suyos] of porClase) {
    const clase = cache.clases.get(clave);
    const carpeta = cache.carpetaClase.get(clave) ?? { id: suyos[0].carpetaId ?? '', url: suyos[0].carpetaUrl ?? '' };
    if (!clase || !carpeta.id) continue;
    for (const tutor of clase.tutores) {
      if (!tutor.email) continue;
      try {
        const estado = await compartirCarpeta(carpeta.id, tutor.email, rol, false);
        if (estado === 'nuevo' && conf.avisarPorCorreo) {
          await avisarTutorDelCuaderno({
            email: tutor.email,
            nombre: tutor.nombre,
            clase: clase.clase,
            cursoEscolar: cursoEscolarLargo(tirada.academicYear),
            carpetaUrl: carpeta.url,
            documentos: suyos.filter((i) => i.eduTeacherId === tutor.teacherId).length,
          });
        }
      } catch (error) {
        console.error('[cuaderno] no se pudo compartir la carpeta de clase:', mensajeDeError(error));
      }
    }
  }
}

// ─── Despertar al worker ─────────────────────────────────────────────────────

/**
 * Le da un toque al worker para que empiece (o siga) sin que nadie espere en el navegador.
 * Es "fire and forget" a propósito: quien lanza la tirada recibe su respuesta al momento y
 * el trabajo sigue en el servidor. Si el toque se pierde, el cron de `vercel.json` lo
 * recoge en el siguiente pase.
 */
export function despertarWorker(tiradaId?: string): void {
  const secreto = process.env.CRON_SECRET;
  const url = `${appBaseUrl()}/api/cuaderno/worker${tiradaId ? `?tirada=${tiradaId}` : ''}`;
  void fetch(url, {
    method: 'POST',
    headers: secreto ? { authorization: `Bearer ${secreto}` } : undefined,
    cache: 'no-store',
  }).catch((error) => {
    console.error('[cuaderno] no se pudo despertar al worker:', error instanceof Error ? error.message : error);
  });
}
