// Los tres formatos del informe de Alumnado. Solo PINTAN lo que ya decidió
// `construirInforme` (src/lib/alumnado-informe.ts): así el PDF, el Excel y el CSV no pueden
// decir cosas distintas.
//
// PDF con pdf-lib, que ya está en el repo (lo usa el cuaderno de tutor). Va con Helvetica,
// que es WinAnsi: tiene todas las letras del castellano y del valenciano, pero no cualquier
// carácter del mundo, y un nombre con una letra rara no puede tumbar el informe entero
// (`aWinAnsi`).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
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
  opciones: { paginaPorClase?: boolean; fecha?: Date; centro?: string } = {},
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(aWinAnsi(informe.titulo));
  pdf.setCreator('Tools · Colegio Consolación Burriana');
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Con muchas columnas, apaisado: una lista de clase con 8 columnas en vertical no se lee.
  const apaisado = informe.columnas.length > 5;
  const [ANCHO, ALTO] = apaisado ? [841.89, 595.28] : [595.28, 841.89];
  const MARGEN = 36;
  const util = ANCHO - MARGEN * 2;

  // Anchos: Nº fijo, columnas de valor según su cabecera (entre 46 y 92 pt) y el nombre se
  // queda con lo que sobre (nunca menos de 150).
  const T_CAB = 7.5;
  const T_CELDA = 8.5;
  const anchoNum = 22;
  let anchosValor = informe.columnas.map((c) =>
    Math.min(92, Math.max(46, negrita.widthOfTextAtSize(aWinAnsi(c.titulo), T_CAB) / 1.6 + 12)),
  );
  const sumaValor = anchosValor.reduce((a, b) => a + b, 0);
  if (util - anchoNum - sumaValor < 150) {
    const factor = (util - anchoNum - 150) / sumaValor;
    anchosValor = anchosValor.map((a) => a * factor);
  }
  const anchoAlumno = util - anchoNum - anchosValor.reduce((a, b) => a + b, 0);
  const cabeceras = informe.columnas.map((c, i) => partir(aWinAnsi(c.titulo), negrita, T_CAB, anchosValor[i] - 6, 2));
  const altoCabecera = Math.max(1, ...cabeceras.map((l) => l.length)) * 9 + 8;
  const ALTO_FILA = 15;

  const fecha = (opciones.fecha ?? new Date()).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const paginas: PDFPage[] = [];
  let pagina!: PDFPage;
  let y = 0;

  const nuevaPagina = () => {
    pagina = pdf.addPage([ANCHO, ALTO]);
    paginas.push(pagina);
    y = ALTO - MARGEN;
    // Membrete: pequeño y gris, para que lo importante sea la tabla.
    pagina.drawText(aWinAnsi(opciones.centro ?? 'Colegio Consolación · Burriana'), {
      x: MARGEN,
      y: y - 8,
      size: 8,
      font: normal,
      color: color('71717A'),
    });
    const f = aWinAnsi(fecha);
    pagina.drawText(f, { x: ANCHO - MARGEN - normal.widthOfTextAtSize(f, 8), y: y - 8, size: 8, font: normal, color: color('71717A') });
    y -= 30;
    pagina.drawText(recortar(aWinAnsi(informe.titulo), negrita, 16, util), { x: MARGEN, y, size: 16, font: negrita, color: color('18181B') });
    y -= 15;
    pagina.drawText(recortar(aWinAnsi(informe.ambito), normal, 9, util), { x: MARGEN, y, size: 9, font: normal, color: color('52525B') });
    y -= 18;
  };

  const pintarCabeceraTabla = () => {
    pagina.drawRectangle({ x: MARGEN, y: y - altoCabecera, width: util, height: altoCabecera, color: color('F4F4F5') });
    const base = y - 11;
    pagina.drawText('Nº', { x: MARGEN + 4, y: base, size: T_CAB, font: negrita, color: color('52525B') });
    pagina.drawText('Alumno', { x: MARGEN + anchoNum + 4, y: base, size: T_CAB, font: negrita, color: color('52525B') });
    let x = MARGEN + anchoNum + anchoAlumno;
    informe.columnas.forEach((_, i) => {
      cabeceras[i].forEach((linea, j) => {
        const w = negrita.widthOfTextAtSize(linea, T_CAB);
        pagina.drawText(linea, { x: x + (anchosValor[i] - w) / 2, y: base - j * 9, size: T_CAB, font: negrita, color: color('52525B') });
      });
      x += anchosValor[i];
    });
    y -= altoCabecera;
  };

  const cabeGrupo = (clase: string, continuacion: boolean) => {
    if (!clase) return;
    const texto = aWinAnsi(continuacion ? `${clase} (sigue)` : clase);
    pagina.drawText(texto, { x: MARGEN, y: y - 12, size: 12, font: negrita, color: color('18181B') });
    y -= 20;
  };

  const MIN_Y = MARGEN + 20;
  nuevaPagina();

  if (informe.grupos.length === 0) {
    pagina.drawText('No hay nadie que cumpla lo pedido.', { x: MARGEN, y: y - 12, size: 10, font: normal, color: color('71717A') });
  }

  informe.grupos.forEach((g, gi) => {
    const hueco = (g.clase ? 20 : 0) + altoCabecera + ALTO_FILA * Math.min(3, g.filas.length) + ALTO_FILA;
    if (gi > 0 && (opciones.paginaPorClase || y - hueco < MIN_Y)) nuevaPagina();
    else if (gi > 0) y -= 10;
    cabeGrupo(g.clase, false);
    pintarCabeceraTabla();

    g.filas.forEach((f, fi) => {
      if (y - ALTO_FILA < MIN_Y) {
        nuevaPagina();
        cabeGrupo(g.clase, true);
        pintarCabeceraTabla();
      }
      if (fi % 2 === 1) {
        pagina.drawRectangle({ x: MARGEN, y: y - ALTO_FILA, width: util, height: ALTO_FILA, color: color('FAFAFA') });
      }
      const base = y - 10.5;
      if (f.numero !== null) {
        pagina.drawText(String(f.numero), { x: MARGEN + 4, y: base, size: T_CELDA, font: normal, color: color('A1A1AA') });
      }
      pagina.drawText(recortar(aWinAnsi(f.alumno), normal, T_CELDA, anchoAlumno - 8), {
        x: MARGEN + anchoNum + 4,
        y: base,
        size: T_CELDA,
        font: normal,
        color: color('18181B'),
      });
      let x = MARGEN + anchoNum + anchoAlumno;
      f.celdas.forEach((c, i) => {
        const tono = HEX[c.tono];
        if (tono.fondo && c.texto) {
          pagina.drawRectangle({
            x: x + 3,
            y: y - ALTO_FILA + 2,
            width: anchosValor[i] - 6,
            height: ALTO_FILA - 4,
            color: color(tono.fondo),
          });
        }
        const texto = recortar(aWinAnsi(c.texto), c.tono === 'nada' ? normal : negrita, T_CELDA - 0.5, anchosValor[i] - 8);
        const fuente = c.tono === 'nada' ? normal : negrita;
        const w = fuente.widthOfTextAtSize(texto, T_CELDA - 0.5);
        pagina.drawText(texto, { x: x + (anchosValor[i] - w) / 2, y: base, size: T_CELDA - 0.5, font: fuente, color: color(tono.texto) });
        x += anchosValor[i];
      });
      pagina.drawLine({
        start: { x: MARGEN, y: y - ALTO_FILA },
        end: { x: MARGEN + util, y: y - ALTO_FILA },
        thickness: 0.4,
        color: color('E4E4E7'),
      });
      y -= ALTO_FILA;
    });

    // Fila de totales de la clase.
    if (g.totales.some((t) => t !== null)) {
      if (y - ALTO_FILA < MIN_Y) nuevaPagina();
      const base = y - 10.5;
      pagina.drawText(aWinAnsi(`Total · ${g.filas.length} ${g.filas.length === 1 ? 'alumno' : 'alumnos'}`), {
        x: MARGEN + anchoNum + 4,
        y: base,
        size: T_CELDA,
        font: negrita,
        color: color('3F3F46'),
      });
      let x = MARGEN + anchoNum + anchoAlumno;
      g.totales.forEach((t, i) => {
        if (t) {
          const w = negrita.widthOfTextAtSize(t, T_CELDA);
          pagina.drawText(t, { x: x + (anchosValor[i] - w) / 2, y: base, size: T_CELDA, font: negrita, color: color('3F3F46') });
        }
        x += anchosValor[i];
      });
      y -= ALTO_FILA;
    }
  });

  // Pie con el número de página, cuando ya se sabe cuántas hay.
  paginas.forEach((p, i) => {
    const texto = `${i + 1} / ${paginas.length}`;
    p.drawText(texto, {
      x: ANCHO - MARGEN - normal.widthOfTextAtSize(texto, 8),
      y: MARGEN - 14,
      size: 8,
      font: normal,
      color: color('A1A1AA'),
    });
    p.drawText(aWinAnsi(`${informe.total} ${informe.total === 1 ? 'alumno' : 'alumnos'} · datos personales: no dejar a la vista`), {
      x: MARGEN,
      y: MARGEN - 14,
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
