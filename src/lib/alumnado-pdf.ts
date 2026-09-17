// El PDF de protección de datos: el listado que la dirección imprime, lleva a una reunión o
// manda al fotógrafo. Ficha del módulo: docs/21-alumnado.md
//
// Sale de lo que se está viendo en pantalla (mismo filtro, mismo ámbito, mismo orden), y eso
// es a propósito: un papel que no coincide con la pantalla es un papel que nadie cree. El
// orden lo pone `listaAlumnado()` una sola vez —etapa, clase, nº de lista, apellidos— y aquí
// solo se agrupa.
//
// pdf-lib con las fuentes estándar: no hace falta empaquetar tipografías, y `WinAnsi` cubre
// de sobra los acentos y la Ñ del castellano.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { agruparPorClase, textoPermiso, type FiltroProteccion, FILTRO_LABELS } from '@/lib/alumnado';

export interface AlumnoPdf {
  numero: number | null;
  completo: string;
  clase: string;
  curso: string;
  letra: string | null;
  etapa: string | null;
  proteccion: { imagen: boolean | null; prodat: boolean | null } | null;
}

const A4: [number, number] = [595.28, 841.89];
const MARGEN = 42;
const ETAPA_LARGO: Record<string, string> = { EI: 'Infantil', EP: 'Primaria', ESO: 'Secundaria' };

const TINTA = rgb(0.09, 0.09, 0.11);
const SUAVE = rgb(0.45, 0.45, 0.5);
const RAYA = rgb(0.85, 0.85, 0.88);
const ROJO = rgb(0.72, 0.11, 0.11);
const VERDE = rgb(0.06, 0.45, 0.32);

interface Estado {
  pdf: PDFDocument;
  pagina: PDFPage;
  y: number;
  normal: PDFFont;
  negrita: PDFFont;
  paginas: PDFPage[];
}

export async function pdfProteccion(
  alumnos: readonly AlumnoPdf[],
  opciones: { ambito: string; filtro: FiltroProteccion; porEtapa: boolean; hoy?: Date },
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Protección de datos · ${opciones.ambito}`);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const estado: Estado = { pdf, pagina: pdf.addPage(A4), y: 0, normal, negrita, paginas: [] };
  estado.paginas.push(estado.pagina);
  estado.y = A4[1] - MARGEN;

  cabecera(estado, opciones);

  const grupos = agruparPorClase(alumnos);
  let etapaAnterior: string | null | undefined;

  for (const grupo of grupos) {
    // «Separado por etapas» = cada etapa empieza en su hoja, que es como se reparte en una
    // reunión: la de infantil a quien lleva infantil.
    if (opciones.porEtapa && etapaAnterior !== undefined && grupo.etapa !== etapaAnterior) {
      nuevaPagina(estado, opciones);
    }
    if (grupo.etapa !== etapaAnterior) {
      tituloEtapa(estado, grupo.etapa, opciones);
      etapaAnterior = grupo.etapa;
    }
    tituloClase(estado, grupo.clase, grupo.alumnos.length, opciones);
    for (const alumno of grupo.alumnos) fila(estado, alumno, opciones);
    estado.y -= 6;
  }

  if (alumnos.length === 0) {
    estado.pagina.drawText('No hay ningún alumno que cumpla este filtro.', {
      x: MARGEN,
      y: estado.y - 14,
      size: 10,
      font: normal,
      color: SUAVE,
    });
  }

  pies(estado, opciones.hoy ?? new Date());
  return pdf.save();
}

// ─── Trozos de la hoja ────────────────────────────────────────────────────────

function cabecera(e: Estado, o: { ambito: string; filtro: FiltroProteccion; hoy?: Date }) {
  e.pagina.drawText('Protección de datos del alumnado', {
    x: MARGEN,
    y: e.y - 14,
    size: 15,
    font: e.negrita,
    color: TINTA,
  });
  e.y -= 32;
  const sub = `${o.ambito} · ${FILTRO_LABELS[o.filtro].titulo}`;
  e.pagina.drawText(sub, { x: MARGEN, y: e.y, size: 10, font: e.normal, color: SUAVE });
  e.y -= 18;
}

function nuevaPagina(e: Estado, o: { ambito: string; filtro: FiltroProteccion }) {
  e.pagina = e.pdf.addPage(A4);
  e.paginas.push(e.pagina);
  e.y = A4[1] - MARGEN;
  // Cada hoja se lee sola: quien recibe la de Primaria tiene que saber qué tiene en la mano.
  e.pagina.drawText(`Protección de datos · ${o.ambito}`, {
    x: MARGEN,
    y: e.y - 10,
    size: 9,
    font: e.normal,
    color: SUAVE,
  });
  e.y -= 30;
}

function sitio(e: Estado, alto: number, o: { ambito: string; filtro: FiltroProteccion }) {
  if (e.y - alto < MARGEN + 26) nuevaPagina(e, o);
}

function tituloEtapa(e: Estado, etapa: string | null, o: { ambito: string; filtro: FiltroProteccion }) {
  sitio(e, 40, o);
  e.y -= 8;
  e.pagina.drawText((etapa && ETAPA_LARGO[etapa]) ?? 'Otras clases', {
    x: MARGEN,
    y: e.y,
    size: 12,
    font: e.negrita,
    color: TINTA,
  });
  e.y -= 6;
  e.pagina.drawLine({
    start: { x: MARGEN, y: e.y },
    end: { x: A4[0] - MARGEN, y: e.y },
    thickness: 0.8,
    color: RAYA,
  });
  e.y -= 12;
}

const COL_NUM = MARGEN;
const COL_NOMBRE = MARGEN + 26;
const COL_FOTOS = A4[0] - MARGEN - 110;
const COL_PRODAT = A4[0] - MARGEN - 45;

function tituloClase(e: Estado, clase: string, cuantos: number, o: { ambito: string; filtro: FiltroProteccion }) {
  sitio(e, 46, o);
  e.pagina.drawText(`${clase}`, { x: MARGEN, y: e.y, size: 10, font: e.negrita, color: TINTA });
  e.pagina.drawText(`${cuantos} alumno${cuantos === 1 ? '' : 's'}`, {
    x: MARGEN + 70,
    y: e.y,
    size: 8,
    font: e.normal,
    color: SUAVE,
  });
  // La cabecera de columnas se repite en cada clase: así una hoja suelta sigue teniendo
  // sentido, y con una clase por bloque no llega a molestar.
  e.pagina.drawText('Fotos', { x: COL_FOTOS, y: e.y, size: 8, font: e.normal, color: SUAVE });
  e.pagina.drawText('Prodat', { x: COL_PRODAT, y: e.y, size: 8, font: e.normal, color: SUAVE });
  e.y -= 13;
}

function fila(e: Estado, alumno: AlumnoPdf, o: { ambito: string; filtro: FiltroProteccion }) {
  sitio(e, 16, o);
  const imagen = alumno.proteccion?.imagen ?? null;
  const prodat = alumno.proteccion?.prodat ?? null;

  if (alumno.numero !== null) {
    e.pagina.drawText(String(alumno.numero), { x: COL_NUM, y: e.y, size: 9, font: e.normal, color: SUAVE });
  }
  e.pagina.drawText(recorta(alumno.completo, e.normal, 9, COL_FOTOS - COL_NOMBRE - 8), {
    x: COL_NOMBRE,
    y: e.y,
    size: 9,
    font: imagen === false ? e.negrita : e.normal,
    color: TINTA,
  });
  e.pagina.drawText(textoPermiso(imagen), {
    x: COL_FOTOS,
    y: e.y,
    size: 9,
    font: imagen === false ? e.negrita : e.normal,
    color: imagen === false ? ROJO : imagen === true ? VERDE : SUAVE,
  });
  e.pagina.drawText(textoPermiso(prodat), {
    x: COL_PRODAT,
    y: e.y,
    size: 9,
    font: e.normal,
    color: prodat === false ? ROJO : prodat === true ? VERDE : SUAVE,
  });
  e.y -= 14;
}

function pies(e: Estado, hoy: Date) {
  const fecha = hoy.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  e.paginas.forEach((pagina, i) => {
    // Un listado con nombres y con quién no puede salir en fotos no es un papel cualquiera:
    // lo dice él mismo, para que no acabe olvidado encima de una mesa.
    pagina.drawText(`Colegio Consolación Burriana · ${fecha} · documento con datos personales`, {
      x: MARGEN,
      y: MARGEN - 12,
      size: 7.5,
      font: e.normal,
      color: SUAVE,
    });
    pagina.drawText(`${i + 1} / ${e.paginas.length}`, {
      x: A4[0] - MARGEN - 24,
      y: MARGEN - 12,
      size: 7.5,
      font: e.normal,
      color: SUAVE,
    });
  });
}

/** Corta por el ancho real de la fuente, no por número de letras. */
function recorta(texto: string, fuente: PDFFont, tamano: number, ancho: number): string {
  if (fuente.widthOfTextAtSize(texto, tamano) <= ancho) return texto;
  let corto = texto;
  while (corto.length > 4 && fuente.widthOfTextAtSize(`${corto}…`, tamano) > ancho) corto = corto.slice(0, -1);
  return `${corto}…`;
}
