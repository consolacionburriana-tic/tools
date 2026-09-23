// Los tres formatos del informe de Alumnado. Solo PINTAN lo que ya decidió
// `construirInforme` (src/lib/alumnado-informe.ts): así el PDF, el Excel y el CSV no pueden
// decir cosas distintas.
//
// PDF con pdf-lib, que ya está en el repo (lo usa el cuaderno de tutor). Va con Helvetica,
// que es WinAnsi: tiene todas las letras del castellano y del valenciano, pero no cualquier
// carácter del mundo, y un nombre con una letra rara no puede tumbar el informe entero
// (`aWinAnsi`).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { LOGO_COLE_PNG_BASE64 } from '@/lib/logo-cole';
import { escribirXlsx, type EntradaCelda } from '@/lib/xlsx-escribir';
import type { Informe, TonoCelda } from '@/lib/alumnado-informe';

// ─── Colores (los mismos tonos que la pantalla) ───────────────────────────────

const HEX: Record<TonoCelda, { texto: string; fondo: string | null }> = {
  si: { texto: '047857', fondo: 'D1FAE5' },
  no: { texto: 'B91C1C', fondo: 'FEE2E2' },
  aviso: { texto: 'B45309', fondo: 'FEF3C7' },
  beca: { texto: '1D4ED8', fondo: 'DBEAFE' },
  gris: { texto: '71717A', fondo: null },
  nada: { texto: '18181B', fondo: null },
};

const color = (hex: string) =>
  rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);

// ─── PDF ──────────────────────────────────────────────────────────────────────

// Lo que WinAnsi sabe pintar además de Latin-1.
const EXTRA_WINANSI = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

/** Deja el texto pintable con Helvetica: quita acentos que no existan y cambia el resto por «?». */
export function aWinAnsi(texto: string): string {
  let salida = '';
  for (const ch of texto) {
    const code = ch.codePointAt(0)!;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || EXTRA_WINANSI.has(ch)) {
      salida += ch;
      continue;
    }
    if (ch === '\t' || ch === '\n') {
      salida += ' ';
      continue;
    }
    const sinAcento = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    salida += [...sinAcento].every((c) => c.codePointAt(0)! < 0x7f) && sinAcento ? sinAcento : '?';
  }
  return salida;
}

/** Recorta con «…» para que quepa en `ancho` puntos. */
function recortar(texto: string, fuente: PDFFont, tamano: number, ancho: number): string {
  if (fuente.widthOfTextAtSize(texto, tamano) <= ancho) return texto;
  let t = texto;
  while (t.length > 1 && fuente.widthOfTextAtSize(`${t}…`, tamano) > ancho) t = t.slice(0, -1);
  return `${t}…`;
}

/** Parte en líneas por palabras (para las cabeceras de columna, que pueden ser largas). */
function partir(texto: string, fuente: PDFFont, tamano: number, ancho: number, maxLineas: number): string[] {
  const palabras = texto.split(/\s+/);
  const lineas: string[] = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (fuente.widthOfTextAtSize(prueba, tamano) <= ancho || !actual) actual = prueba;
    else {
      lineas.push(actual);
      actual = p;
    }
  }
  if (actual) lineas.push(actual);
  if (lineas.length > maxLineas) {
    const resto = lineas.slice(maxLineas - 1).join(' ');
    return [...lineas.slice(0, maxLineas - 1), recortar(resto, fuente, tamano, ancho)];
  }
  return lineas.map((l) => recortar(l, fuente, tamano, ancho));
}

export async function informePdf(
  informe: Informe,
  opciones: { paginaPorClase?: boolean; fecha?: Date; centro?: string; cursoAcademico?: string } = {},
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(aWinAnsi(informe.titulo));
  pdf.setCreator('Tools · Colegio Consolación Burriana');
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  // El logo no puede tumbar el informe: si fallara, sale sin él.
  const logo = await pdf.embedPng(Buffer.from(LOGO_COLE_PNG_BASE64, 'base64')).catch(() => null);

  const folio = Boolean(opciones.paginaPorClase);
  // Vertical siempre que quepa: una lista de clase se lee y se reparte mejor así. Solo con
  // muchas columnas se pasa a apaisado.
  const apaisado = informe.columnas.length > 7;
  const [ANCHO, ALTO] = apaisado ? [841.89, 595.28] : [595.28, 841.89];
  const MARGEN = 34;
  const util = ANCHO - MARGEN * 2;
  const PIE = MARGEN + 16;

  // ── Anchos: nº de lista, nombre y columnas de valor ──
  const T_CAB = 7.5;
  const anchoNum = 30;
  let anchosValor = informe.columnas.map((c) =>
    Math.min(90, Math.max(44, negrita.widthOfTextAtSize(aWinAnsi(c.titulo), T_CAB) / 1.6 + 12)),
  );
  const sumaValor = anchosValor.reduce((a, b) => a + b, 0);
  if (util - anchoNum - sumaValor < 170) {
    const factor = (util - anchoNum - 170) / sumaValor;
    anchosValor = anchosValor.map((a) => a * factor);
  }
  const anchoAlumno = util - anchoNum - anchosValor.reduce((a, b) => a + b, 0);
  const cabeceras = informe.columnas.map((c, i) => partir(aWinAnsi(c.titulo), negrita, T_CAB, anchosValor[i] - 6, 2));
  const altoCabecera = Math.max(1, ...cabeceras.map((l) => l.length)) * 9 + 10;

  const fecha = (opciones.fecha ?? new Date()).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const curso = opciones.cursoAcademico ? `Curso ${opciones.cursoAcademico}` : '';
  const AZUL = color('1D4ED8');

  const ALTO_MEMBRETE = 58;
  const ALTO_CLASE = 58;
  // En modo folio la fila se ajusta para que la clase más larga quepa en UNA hoja (el peor
  // caso real son 32), sin pasar de 22 pt, que con 20 alumnos ya queda holgado.
  const maxFilas = Math.max(1, ...informe.grupos.map((g) => g.filas.length));
  const hueco = ALTO - MARGEN - ALTO_MEMBRETE - ALTO_CLASE - altoCabecera - PIE - 22; // 22 = fila de total
  const ALTO_FILA = folio ? Math.max(11, Math.min(22, hueco / maxFilas)) : 17;
  const T_CELDA = Math.min(10, Math.max(7.5, ALTO_FILA * 0.5));

  const paginas: PDFPage[] = [];
  let pagina!: PDFPage;
  let y = 0;

  const nuevaPagina = () => {
    pagina = pdf.addPage([ANCHO, ALTO]);
    paginas.push(pagina);
    y = ALTO - MARGEN;
    // Membrete: logo, colegio y curso a la izquierda; qué informe es y la fecha a la derecha.
    let x = MARGEN;
    if (logo) {
      const alto = 40;
      const ancho = (logo.width / logo.height) * alto;
      pagina.drawImage(logo, { x, y: y - alto, width: ancho, height: alto });
      x += ancho + 12;
    }
    pagina.drawText(aWinAnsi(opciones.centro ?? 'Colegio Consolación · Burriana'), { x, y: y - 16, size: 11, font: negrita, color: color('18181B') });
    if (curso) pagina.drawText(aWinAnsi(curso), { x, y: y - 31, size: 10, font: normal, color: AZUL });
    const titulo = recortar(aWinAnsi(informe.titulo), negrita, 11, util / 2);
    pagina.drawText(titulo, { x: ANCHO - MARGEN - negrita.widthOfTextAtSize(titulo, 11), y: y - 16, size: 11, font: negrita, color: color('18181B') });
    const f = aWinAnsi(fecha);
    pagina.drawText(f, { x: ANCHO - MARGEN - normal.widthOfTextAtSize(f, 9), y: y - 31, size: 9, font: normal, color: color('71717A') });
    y -= ALTO_MEMBRETE - 10;
    pagina.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO - MARGEN, y }, thickness: 1.2, color: AZUL });
    y -= 10;
  };

  // La clase en grande y sus tutores bien claros: es el folio que se le da a cada tutor.
  const cabeGrupo = (g: Informe['grupos'][number], continuacion: boolean) => {
    const nombre = g.clase || informe.ambito;
    pagina.drawText(aWinAnsi(continuacion ? `${nombre} (sigue)` : nombre), { x: MARGEN, y: y - 22, size: 22, font: negrita, color: color('18181B') });
    const tutores = g.tutores.length > 0 ? `Tutor/a: ${g.tutores.join(' y ')}` : 'Sin tutor/a asignado';
    pagina.drawText(recortar(aWinAnsi(tutores), negrita, 12, util * 0.6), { x: MARGEN, y: y - 40, size: 12, font: negrita, color: color('3F3F46') });
    const cuantos = aWinAnsi(`${g.filas.length} ${g.filas.length === 1 ? 'alumno' : 'alumnos'}`);
    pagina.drawText(cuantos, { x: ANCHO - MARGEN - normal.widthOfTextAtSize(cuantos, 10), y: y - 20, size: 10, font: normal, color: color('52525B') });
    if (g.clase && informe.ambito.includes(' · ')) {
      const filtro = recortar(aWinAnsi(informe.ambito.split(' · ').slice(1).join(' · ')), normal, 9, util * 0.38);
      pagina.drawText(filtro, { x: ANCHO - MARGEN - normal.widthOfTextAtSize(filtro, 9), y: y - 38, size: 9, font: normal, color: color('B45309') });
    }
    y -= ALTO_CLASE - 6;
  };

  const pintarCabeceraTabla = () => {
    pagina.drawRectangle({ x: MARGEN, y: y - altoCabecera, width: util, height: altoCabecera, color: color('EFF6FF') });
    const base = y - 12;
    pagina.drawText('Nº', { x: MARGEN + (anchoNum - negrita.widthOfTextAtSize('Nº', T_CAB)) / 2, y: base, size: T_CAB, font: negrita, color: AZUL });
    pagina.drawText('ALUMNO/A', { x: MARGEN + anchoNum + 6, y: base, size: T_CAB, font: negrita, color: AZUL });
    let x = MARGEN + anchoNum + anchoAlumno;
    informe.columnas.forEach((_, i) => {
      cabeceras[i].forEach((linea, j) => {
        const w = negrita.widthOfTextAtSize(linea, T_CAB);
        pagina.drawText(linea, { x: x + (anchosValor[i] - w) / 2, y: base - j * 9, size: T_CAB, font: negrita, color: AZUL });
      });
      x += anchosValor[i];
    });
    y -= altoCabecera;
  };

  const dentro = (alto: number) => y - alto >= PIE;
  nuevaPagina();

  if (informe.grupos.length === 0) {
    pagina.drawText('No hay nadie que cumpla lo pedido.', { x: MARGEN, y: y - 14, size: 11, font: normal, color: color('71717A') });
  }

  informe.grupos.forEach((g, gi) => {
    if (gi > 0) {
      const necesita = ALTO_CLASE + altoCabecera + ALTO_FILA * Math.min(3, g.filas.length);
      if (folio || !dentro(necesita)) nuevaPagina();
      else y -= 14;
    }
    cabeGrupo(g, false);
    pintarCabeceraTabla();

    g.filas.forEach((f, fi) => {
      if (!dentro(ALTO_FILA)) {
        nuevaPagina();
        cabeGrupo(g, true);
        pintarCabeceraTabla();
      }
      if (fi % 2 === 1) pagina.drawRectangle({ x: MARGEN, y: y - ALTO_FILA, width: util, height: ALTO_FILA, color: color('FAFAFA') });
      const base = y - ALTO_FILA / 2 - T_CELDA * 0.35;
      // El nº de lista, en negrita y bien visible: es por donde el tutor busca en su lista.
      const num = f.numero !== null ? String(f.numero) : '·';
      pagina.drawText(num, {
        x: MARGEN + (anchoNum - negrita.widthOfTextAtSize(num, T_CELDA + 0.5)) / 2,
        y: base,
        size: T_CELDA + 0.5,
        font: negrita,
        color: color('1E3A8A'),
      });
      pagina.drawText(recortar(aWinAnsi(f.alumno), normal, T_CELDA, anchoAlumno - 10), {
        x: MARGEN + anchoNum + 6,
        y: base,
        size: T_CELDA,
        font: normal,
        color: color('18181B'),
      });
      let x = MARGEN + anchoNum + anchoAlumno;
      f.celdas.forEach((c, i) => {
        const tono = HEX[c.tono];
        const pad = Math.min(3, ALTO_FILA * 0.15);
        if (tono.fondo && c.texto) {
          pagina.drawRectangle({ x: x + 4, y: y - ALTO_FILA + pad, width: anchosValor[i] - 8, height: ALTO_FILA - pad * 2, color: color(tono.fondo) });
        }
        const fuente = c.tono === 'nada' ? normal : negrita;
        const tam = T_CELDA - 0.5;
        const texto = recortar(aWinAnsi(c.texto), fuente, tam, anchosValor[i] - 10);
        const w = fuente.widthOfTextAtSize(texto, tam);
        pagina.drawText(texto, { x: x + (anchosValor[i] - w) / 2, y: base, size: tam, font: fuente, color: color(tono.texto) });
        x += anchosValor[i];
      });
      pagina.drawLine({ start: { x: MARGEN, y: y - ALTO_FILA }, end: { x: MARGEN + util, y: y - ALTO_FILA }, thickness: 0.4, color: color('E4E4E7') });
      y -= ALTO_FILA;
    });

    // Fila de totales de la clase.
    if (g.totales.some((t) => t !== null)) {
      if (!dentro(20)) nuevaPagina();
      pagina.drawRectangle({ x: MARGEN, y: y - 20, width: util, height: 20, color: color('F4F4F5') });
      const base = y - 13.5;
      pagina.drawText('Total', { x: MARGEN + anchoNum + 6, y: base, size: 9, font: negrita, color: color('3F3F46') });
      let x = MARGEN + anchoNum + anchoAlumno;
      g.totales.forEach((t, i) => {
        if (t) {
          const w = negrita.widthOfTextAtSize(t, 9);
          pagina.drawText(t, { x: x + (anchosValor[i] - w) / 2, y: base, size: 9, font: negrita, color: color('3F3F46') });
        }
        x += anchosValor[i];
      });
      y -= 20;
    }
  });

  // Pie con el número de página, cuando ya se sabe cuántas hay.
  paginas.forEach((p, i) => {
    const texto = `${i + 1} / ${paginas.length}`;
    p.drawText(texto, { x: ANCHO - MARGEN - normal.widthOfTextAtSize(texto, 8), y: MARGEN - 12, size: 8, font: normal, color: color('A1A1AA') });
    p.drawText(aWinAnsi('Contiene datos personales del alumnado: no dejar a la vista ni tirar sin destruir'), {
      x: MARGEN,
      y: MARGEN - 12,
      size: 8,
      font: normal,
      color: color('A1A1AA'),
    });
  });

  return pdf.save();
}

// ─── Excel ────────────────────────────────────────────────────────────────────

export async function informeXlsx(informe: Informe): Promise<Buffer> {
  const cab = { negrita: true, fondo: 'F4F4F5', color: '3F3F46', horizontal: 'center' as const, ajustarTexto: true };
  const filas: EntradaCelda[][] = [
    [
      { valor: 'Clase', estilo: { ...cab, horizontal: 'left' } },
      { valor: 'Nº', estilo: cab },
      { valor: 'Alumno', estilo: { ...cab, horizontal: 'left' } },
      ...informe.columnas.map((c) => ({ valor: c.titulo, estilo: cab })),
    ],
  ];
  for (const g of informe.grupos) {
    for (const f of g.filas) {
      filas.push([
        g.clase,
        f.numero,
        f.alumno,
        ...f.celdas.map((c) => {
          const tono = HEX[c.tono];
          return {
            valor: c.texto,
            estilo: {
              horizontal: 'center' as const,
              color: tono.texto,
              negrita: c.tono !== 'nada' && c.tono !== 'gris',
              ...(tono.fondo && c.texto ? { fondo: tono.fondo } : {}),
            },
          };
        }),
      ]);
    }
  }

  // Segunda hoja: los totales por clase, que es lo que se copia a un correo a dirección.
  const conTotal = informe.columnas.map((c, i) => ({ c, i })).filter(({ c }) => c.cuenta);
  const resumen: EntradaCelda[][] = [
    [
      { valor: 'Clase', estilo: { ...cab, horizontal: 'left' } },
      { valor: 'Alumnos', estilo: cab },
      ...conTotal.map(({ c }) => ({ valor: c.titulo, estilo: cab })),
    ],
    ...informe.grupos.map((g) => [
      g.clase || 'Todos',
      g.filas.length,
      ...conTotal.map(({ i }) => ({ valor: g.totales[i] ?? '', estilo: { horizontal: 'center' as const } })),
    ]),
  ];

  return escribirXlsx({
    fuente: 'Arial',
    hojas: [
      {
        nombre: 'Informe',
        filas,
        columnas: [{ ancho: 12 }, { ancho: 5 }, { ancho: 34 }, ...informe.columnas.map(() => ({ ancho: 16 }))],
        congelar: 'D2',
        autofiltro: true,
        altoCabecera: 30,
        colorPestana: '2563EB',
      },
      ...(conTotal.length > 0
        ? [
            {
              nombre: 'Totales',
              filas: resumen,
              columnas: [{ ancho: 14 }, { ancho: 9 }, ...conTotal.map(() => ({ ancho: 16 }))],
              congelar: 'B2',
              altoCabecera: 30,
            },
          ]
        : []),
    ],
  });
}
