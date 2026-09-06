// Generación de un documento del cuaderno de tutor, de punta a punta.
//
// Un "ítem" de la cola = un tutor × una plantilla = un documento en Drive. Aquí se arma el
// plan de relleno (qué copias, con qué datos), se rellena el .docx en memoria y se sube a
// Drive con conversión a Google Doc. Ficha: docs/18-cuaderno-tutor.md
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import type { CuadAjustes, CuadPlantilla } from '@/db/schema';
import { ASIGNATURAS_MAX, normalizarEtiqueta, TRIMESTRES, type Repeticion } from '@/lib/cuaderno/campos';
import { limpiarNombre, nombreDocumento, numeroListaTexto } from '@/lib/cuaderno/nombres';
import {
  etiquetasDeXml,
  rellenarDocumentXml,
  rellenarFragmentoXml,
  tieneFilasRepetibles,
  type Contexto,
  type PlanRelleno,
} from '@/lib/cuaderno/ooxml';
import { subirComoGoogleDoc, exportarPdf, subirPdf, borrarArchivo, buscarEnCarpeta } from '@/lib/cuaderno/drive';
import type {
  AlumnoCuaderno,
  AsignaturaCuaderno,
  ClaseCuaderno,
  NumeroAlumno,
  TutorCuaderno,
} from '@/lib/cuaderno-server';

// ─── Valores de cada ámbito ───────────────────────────────────────────────────

type Valores = Record<string, string>;

const fechaCorta = (iso: string | null): string => {
  if (!iso) return '';
  try {
    return format(parseISO(iso), 'dd/MM/yyyy');
  } catch {
    return iso;
  }
};

export function valoresCentro(ajustes: Pick<CuadAjustes, 'nombreCentro'>, cursoEscolar: string, hoy = new Date()): Valores {
  return {
    curso_escolar: cursoEscolar,
    centro: ajustes.nombreCentro,
    fecha_hoy: format(hoy, "d 'de' MMMM 'de' yyyy", { locale: es }),
  };
}

export function valoresClase(clase: ClaseCuaderno, tutor: TutorCuaderno | null, numAlumnos: number): Valores {
  return {
    clase: clase.clase,
    curso: clase.curso,
    letra: clase.letra ?? '',
    etapa: clase.etapa ?? '',
    tutor: tutor?.nombre ?? '',
    tutor_corto: tutor?.corto ?? '',
    tutores: clase.tutores.map((t) => t.corto).join(' + '),
    tutor_email: tutor?.email ?? '',
    num_alumnos: String(numAlumnos),
  };
}

export function valoresAlumno(alumno: AlumnoCuaderno, numero: NumeroAlumno | undefined): Valores {
  const apellidos = [alumno.apellido1, alumno.apellido2].filter(Boolean).join(' ');
  const asignado = numero?.asignado ?? 0;
  const alfabetico = numero?.alfabetico ?? asignado;
  const [f1, f2] = alumno.familiares;
  return {
    nombre: alumno.nombre,
    apellidos,
    apellido1: alumno.apellido1,
    apellido2: alumno.apellido2,
    nombre_completo: [alumno.nombre, apellidos].filter(Boolean).join(' '),
    nombre_lista: apellidos ? `${apellidos}, ${alumno.nombre}` : alumno.nombre,
    numero: asignado ? String(asignado) : '',
    numero_lista: asignado ? numeroListaTexto(asignado, alfabetico) : '',
    fecha_nacimiento: fechaCorta(alumno.fechaNacimiento),
    nia: alumno.nia,
    email: alumno.email,
    sexo: alumno.sexo,
    familiar1_nombre: f1?.nombre ?? '',
    familiar1_telefono: f1?.telefono ?? '',
    familiar1_correo: f1?.correo ?? '',
    familiar2_nombre: f2?.nombre ?? '',
    familiar2_telefono: f2?.telefono ?? '',
    familiar2_correo: f2?.correo ?? '',
  };
}

/**
 * Las asignaturas del curso en sus huecos: `<<asignatura1>>` … `<<asignatura15>>`. Sale el
 * nombre corto si lo hay, y los huecos sobrantes van **en blanco** a propósito: una plantilla
 * con doce filas no debe imprimir `<<asignatura12>>` en un curso que solo da diez.
 */
export function valoresAsignaturas(asignaturas: readonly Pick<AsignaturaCuaderno, 'enLaHoja'>[]): Valores {
  const valores: Valores = { num_asignaturas: String(asignaturas.length) };
  for (let i = 0; i < ASIGNATURAS_MAX; i++) {
    valores[`asignatura${i + 1}`] = asignaturas[i]?.enLaHoja ?? '';
  }
  return valores;
}

export function valoresTrimestre(indice: number): Valores {
  const t = TRIMESTRES[indice] ?? TRIMESTRES[0];
  return { trimestre: t.corto, trimestre_num: t.num, trimestre_nombre: t.nombre };
}

/**
 * Reparte los valores (que vienen por CAMPO) entre todas las etiquetas que apuntan a ese
 * campo. Es lo que hace que `<<tlf1>>`, `<<telefono1>>` y `<<familiar1_telefono>>` acaben
 * rellenándose igual sin que el generador sepa nada de alias.
 */
export function expandirConAlias(valores: Valores, mapeo: Map<string, string>): Valores {
  const salida: Valores = { ...valores };
  for (const [etiqueta, campo] of mapeo) {
    const valor = valores[campo];
    if (valor !== undefined) salida[etiqueta] = valor;
  }
  return salida;
}

/** Nombres que los condicionales `<<?x>>` pueden preguntar. */
function presentesDe(alumno: AlumnoCuaderno | null): string[] {
  const presentes: string[] = [];
  if (alumno && alumno.familiares.length >= 1) presentes.push('familiar1', 'familiar_1');
  if (alumno && alumno.familiares.length >= 2) presentes.push('familiar2', 'familiar_2');
  return presentes;
}

// ─── Plan de relleno ──────────────────────────────────────────────────────────

export interface DatosDocumento {
  plantilla: Pick<CuadPlantilla, 'repeticion' | 'saltoDePagina'>;
  ajustes: Pick<CuadAjustes, 'nombreCentro'>;
  cursoEscolar: string;
  clase: ClaseCuaderno;
  tutor: TutorCuaderno | null;
  /** Alumnado de ESTE tutor, en orden de lista. */
  alumnos: AlumnoCuaderno[];
  /** Asignaturas del curso de la clase, en orden: son los huecos `<<asignaturaN>>`. */
  asignaturas: readonly Pick<AsignaturaCuaderno, 'enLaHoja'>[];
  numeros: Map<string, NumeroAlumno>;
  mapeo: Map<string, string>;
  hoy?: Date;
}

/**
 * Plan de relleno de un documento. La repetición de la plantilla la manda la plantilla:
 * una copia por alumno (Dossier, entrevistas), una por trimestre (registro de entrevistas)
 * o una sola (reunión de familias, con el alumnado en una tabla).
 */
export function construirPlan(datos: DatosDocumento): PlanRelleno {
  const { plantilla, ajustes, cursoEscolar, clase, tutor, alumnos, asignaturas, numeros, mapeo, hoy } = datos;
  const base = {
    ...valoresCentro(ajustes, cursoEscolar, hoy),
    ...valoresClase(clase, tutor, alumnos.length),
    ...valoresAsignaturas(asignaturas),
  };
  const filas = (): Contexto[] =>
    alumnos.map((a) => ({
      valores: expandirConAlias({ ...base, ...valoresAlumno(a, numeros.get(a.id)) }, mapeo),
      presentes: presentesDe(a),
    }));

  const repeticion = plantilla.repeticion as Repeticion;
  let copias: Contexto[];
  if (repeticion === 'alumno') {
    copias = alumnos.map((a) => ({
      valores: expandirConAlias({ ...base, ...valoresAlumno(a, numeros.get(a.id)) }, mapeo),
      presentes: presentesDe(a),
    }));
  } else if (repeticion === 'trimestre') {
    copias = TRIMESTRES.map((_, i) => ({
      valores: expandirConAlias({ ...base, ...valoresTrimestre(i) }, mapeo),
      filas: filas(),
    }));
  } else {
    copias = [{ valores: expandirConAlias(base, mapeo), filas: filas() }];
  }
  // Sin alumnos no hay documento; el llamante ya lo filtra, pero por si acaso no se
  // devuelve un plan vacío (dejaría el cuerpo de la plantilla con las etiquetas crudas).
  if (copias.length === 0) copias = [{ valores: expandirConAlias(base, mapeo) }];
  return { copias, saltoDePagina: plantilla.saltoDePagina };
}

/**
 * Contexto de cabeceras y pies: solo datos de clase y centro (una cabecera es de página,
 * no puede cambiar por alumno). Los campos de alumno se dejan **en blanco** a propósito:
 * es mejor un hueco que un `<<nom>>` impreso 30 veces.
 */
export function contextoCabecera(datos: DatosDocumento): Contexto {
  const base = {
    ...valoresCentro(datos.ajustes, datos.cursoEscolar, datos.hoy),
    ...valoresClase(datos.clase, datos.tutor, datos.alumnos.length),
    ...valoresAsignaturas(datos.asignaturas),
  };
  const enBlanco: Valores = {};
  for (const etiqueta of datos.mapeo.keys()) enBlanco[etiqueta] = '';
  return { valores: { ...enBlanco, ...expandirConAlias(base, datos.mapeo) } };
}

// ─── Relleno del .docx ────────────────────────────────────────────────────────

const ES_CABECERA = /^word\/(header|footer)\d*\.xml$/;

export interface DocxRelleno {
  docx: Buffer;
  sinResolver: string[];
}

/**
 * Rellena el .docx de la plantilla con el plan. Trabaja sobre el zip en memoria: cambia
 * `word/document.xml` y, si las hay, las cabeceras y pies.
 */
export async function rellenarDocx(
  plantillaDocx: Buffer,
  plan: PlanRelleno,
  cabecera?: Contexto,
): Promise<DocxRelleno> {
  const zip = await JSZip.loadAsync(plantillaDocx);
  const documento = zip.file('word/document.xml');
  if (!documento) throw new Error('La plantilla no parece un .docx válido (falta word/document.xml)');

  const sinResolver = new Set<string>();
  const original = await documento.async('string');
  const relleno = rellenarDocumentXml(original, plan, normalizarEtiqueta);
  relleno.sinResolver.forEach((e) => sinResolver.add(e));
  zip.file('word/document.xml', relleno.xml);

  if (cabecera) {
    for (const nombre of Object.keys(zip.files)) {
      if (!ES_CABECERA.test(nombre)) continue;
      const fichero = zip.file(nombre);
      if (!fichero) continue;
      const xml = await fichero.async('string');
      if (!xml.includes('&lt;&lt;') && !xml.includes('<<')) continue;
      const resultado = rellenarFragmentoXml(xml, cabecera, normalizarEtiqueta);
      resultado.sinResolver.forEach((e) => sinResolver.add(e));
      zip.file(nombre, resultado.xml);
    }
  }

  const docx = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return { docx, sinResolver: [...sinResolver] };
}

// ─── Subida a Drive ───────────────────────────────────────────────────────────

export interface ResultadoDocumento {
  nombre: string;
  docId: string;
  docUrl: string;
  pdfId: string | null;
  pdfUrl: string | null;
  sinResolver: string[];
}

/**
 * Genera el documento de un ítem y lo deja en Drive. Antes de crear nada borra lo que
 * hubiera con el mismo nombre en la carpeta: así reintentar un ítem no deja duplicados
 * (que es exactamente lo que pasaría si el documento se creó pero el guardado en Neon no).
 */
export async function generarDocumento(opciones: {
  datos: DatosDocumento;
  plantillaDocx: Buffer;
  plantillaNombre: string;
  indiceTutor: number;
  indicePlantilla: number;
  carpetaId: string;
  conPdf: boolean;
  /** Documento y PDF de un intento anterior, para limpiarlos. */
  previos?: { docId?: string | null; pdfId?: string | null };
}): Promise<ResultadoDocumento> {
  const { datos, plantillaDocx, plantillaNombre, carpetaId, conPdf } = opciones;
  const nombre = limpiarNombre(
    nombreDocumento({
      indiceTutor: opciones.indiceTutor,
      indicePlantilla: opciones.indicePlantilla,
      plantilla: plantillaNombre,
      tutor: datos.tutor?.corto ?? '',
      clase: datos.clase.clase,
    }),
  );

  const plan = construirPlan(datos);
  const { docx, sinResolver } = await rellenarDocx(plantillaDocx, plan, contextoCabecera(datos));

  for (const previo of [opciones.previos?.docId, opciones.previos?.pdfId]) {
    if (previo) await borrarArchivo(previo);
  }
  const homonimo = await buscarEnCarpeta(nombre, carpetaId);
  if (homonimo) await borrarArchivo(homonimo.id);

  const doc = await subirComoGoogleDoc({ nombre, carpetaId, docx });

  let pdfId: string | null = null;
  let pdfUrl: string | null = null;
  if (conPdf) {
    const nombrePdf = `${nombre}.pdf`;
    const pdfHomonimo = await buscarEnCarpeta(nombrePdf, carpetaId);
    if (pdfHomonimo) await borrarArchivo(pdfHomonimo.id);
    const pdf = await exportarPdf(doc.id);
    const subido = await subirPdf({ nombre: nombrePdf, carpetaId, pdf });
    pdfId = subido.id;
    pdfUrl = subido.url;
  }

  return { nombre, docId: doc.id, docUrl: doc.url, pdfId, pdfUrl, sinResolver };
}

// ─── Cuaderno completo ────────────────────────────────────────────────────────

/** Une varios PDF en uno, en el orden dado. */
export async function unirPdfs(pdfs: readonly Buffer[]): Promise<Buffer> {
  const salida = await PDFDocument.create();
  for (const pdf of pdfs) {
    const origen = await PDFDocument.load(pdf, { ignoreEncryption: true });
    const paginas = await salida.copyPages(origen, origen.getPageIndices());
    for (const pagina of paginas) salida.addPage(pagina);
  }
  return Buffer.from(await salida.save());
}

// ─── Lectura de una plantilla ─────────────────────────────────────────────────

export interface AnalisisPlantilla {
  etiquetas: string[];
  tieneFilas: boolean;
}

/**
 * Lee las etiquetas que usa una plantilla, mirando también cabeceras y pies (donde el
 * colegio pone la línea de "Tutoria · tutor"). Es lo que el panel llama al darle a
 * «Analizar»: no hace falta que nadie escriba a mano qué campos tiene una plantilla.
 */
export async function leerEtiquetasDeDocx(docx: Buffer): Promise<AnalisisPlantilla> {
  const zip = await JSZip.loadAsync(docx);
  const partes = ['word/document.xml', ...Object.keys(zip.files).filter((n) => ES_CABECERA.test(n))];
  const etiquetas: string[] = [];
  let tieneFilas = false;
  for (const nombre of partes) {
    const fichero = zip.file(nombre);
    if (!fichero) continue;
    const xml = await fichero.async('string');
    for (const etiqueta of etiquetasDeXml(xml)) {
      if (!etiquetas.includes(etiqueta)) etiquetas.push(etiqueta);
    }
    if (tieneFilasRepetibles(xml)) tieneFilas = true;
  }
  return { etiquetas, tieneFilas };
}
