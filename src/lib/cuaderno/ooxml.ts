// Motor de relleno de plantillas .docx. **Sin red y sin estado**: entra el XML de un
// documento de Word (el que Google Docs devuelve al exportar la plantilla) y sale el XML
// del documento relleno. Todo lo de aquí es puro y está testeado en
// `src/lib/__tests__/cuaderno-ooxml.test.ts`.
//
// Por qué .docx y no la API de Google Docs: el resultado que quiere el colegio es UN
// documento por tutor con sus 30 alumnos dentro, y la API de Docs no sabe "duplicar el
// cuerpo de un documento". En el .docx sí: es XML, y duplicar el cuerpo es duplicar una
// cadena. Luego se sube a Drive con conversión y sale un Google Doc nativo y editable.
// De paso cuesta 2-3 llamadas por documento, en vez de 2 por alumno.
//
// Tres marcas, las mismas que documenta `docs/18-cuaderno-tutor.md`:
//   <<campo>>        se sustituye por el dato
//   <<#alumnos>>     en una fila de tabla: repite la fila una vez por alumno DEL TUTOR
//   <<#clase>>       igual, pero con TODA la clase (los dos tutores juntos)
//   <<?familiar2>>   en un párrafo: si el dato no existe, el párrafo entero se va
//
// El gotcha que justifica la mitad de este fichero: Word/Docs parten el texto de un
// párrafo en varios `<w:t>` (un "run" por trozo de formato, o por donde haya pasado el
// corrector). Una etiqueta puede estar troceada como `<<cla` + `se>>`, y un buscar/
// reemplazar ingenuo NO la encuentra. Aquí se une el texto de todos los `w:t` del párrafo,
// se busca sobre el texto unido, y se reparte el resultado de vuelta entre los runs.

const MARCA_FILAS = /^\s*#\s*(alumnos?|filas?)\s*$/i;
// La misma idea, pero con la clase entera: sirve para el listado general que va al final
// del cuaderno, donde el reparto entre los dos tutores no importa.
const MARCA_FILAS_CLASE = /^\s*#\s*(clase|classe|todos|tots)\s*$/i;
const MARCA_CONDICION = /^\s*\?\s*(.+?)\s*$/;
const ETIQUETA = /<<([^<>]{1,120})>>/g;
const SALTO_PAGINA = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
// Marcador interno para apartar las filas ya rellenadas: NUL no puede aparecer en un XML.
const HUECO = '\u0000';

/** Datos de una copia de la plantilla (o de una fila repetible). */
export interface Contexto {
  /** Etiqueta normalizada → valor ya formateado. Ver `normalizarEtiqueta` en campos.ts. */
  valores: Record<string, string>;
  /** Nombres normalizados que se consideran "presentes" para los condicionales `<<?x>>`. */
  presentes?: string[];
  /** Contextos de las filas marcadas con `<<#alumnos>>`. Sin esto, la fila se deja tal cual. */
  filas?: Contexto[];
  /** Lo mismo para `<<#clase>>`: la clase entera, no solo el trozo de este tutor. */
  filasClase?: Contexto[];
}

export interface PlanRelleno {
  /** Una entrada por copia de la plantilla: por alumno, por trimestre, o una sola. */
  copias: Contexto[];
  /** Separar las copias con salto de página (por defecto sí). */
  saltoDePagina?: boolean;
}

export interface ResultadoRelleno {
  xml: string;
  /** Etiquetas que aparecían en la plantilla y nadie supo resolver. */
  sinResolver: string[];
}

// ─── Utilidades de XML ────────────────────────────────────────────────────────

export function decodificar(texto: string): string {
  return texto
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

export function codificar(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Posiciones de los bloques `<tag>…</tag>` de primer nivel. Cuenta profundidad, así que
 * una tabla anidada dentro de una fila no aparece como una fila suelta.
 */
export function localizarBloques(xml: string, tag: string): { inicio: number; fin: number }[] {
  const re = new RegExp(`<${tag}(?=[\\s/>])[^>]*>|</${tag}>`, 'g');
  const bloques: { inicio: number; fin: number }[] = [];
  let profundidad = 0;
  let inicio = -1;
  for (const m of xml.matchAll(re)) {
    const etiqueta = m[0];
    if (etiqueta.startsWith('</')) {
      if (profundidad === 0) continue; // cierre huérfano: se ignora
      profundidad--;
      if (profundidad === 0 && inicio >= 0) {
        bloques.push({ inicio, fin: m.index + etiqueta.length });
        inicio = -1;
      }
    } else if (etiqueta.endsWith('/>')) {
      if (profundidad === 0) bloques.push({ inicio: m.index, fin: m.index + etiqueta.length });
    } else {
      if (profundidad === 0) inicio = m.index;
      profundidad++;
    }
  }
  return bloques;
}

/** Reemplaza bloques por texto nuevo, de atrás hacia delante para no invalidar posiciones. */
function reemplazarBloques(
  xml: string,
  bloques: { inicio: number; fin: number }[],
  nuevo: (fragmento: string, i: number) => string,
): string {
  let salida = xml;
  for (let i = bloques.length - 1; i >= 0; i--) {
    const b = bloques[i];
    salida = salida.slice(0, b.inicio) + nuevo(xml.slice(b.inicio, b.fin), i) + salida.slice(b.fin);
  }
  return salida;
}

interface NodoTexto {
  /** Posición del texto interno del `<w:t>`. */
  ini: number;
  fin: number;
  /** Posición de la etiqueta de apertura, para poder añadirle `xml:space`. */
  aperturaIni: number;
  aperturaFin: number;
  texto: string;
}

function nodosTexto(xml: string): NodoTexto[] {
  const nodos: NodoTexto[] = [];
  const re = /(<w:t(?:\s[^>]*)?>)([\s\S]*?)<\/w:t>/g;
  for (const m of xml.matchAll(re)) {
    const aperturaIni = m.index;
    const aperturaFin = aperturaIni + m[1].length;
    nodos.push({
      aperturaIni,
      aperturaFin,
      ini: aperturaFin,
      fin: aperturaFin + m[2].length,
      texto: decodificar(m[2]),
    });
  }
  return nodos;
}

/** Texto plano de un fragmento (uniendo todos sus runs). Lo que "se lee" del párrafo. */
export function textoPlano(xml: string): string {
  return nodosTexto(xml)
    .map((n) => n.texto)
    .join('');
}

function marcasDe(xml: string): string[] {
  return [...textoPlano(xml).matchAll(ETIQUETA)].map((m) => m[1]);
}

// ─── Sustitución de etiquetas dentro de un párrafo ────────────────────────────

interface Operacion {
  ini: number;
  fin: number;
  texto: string;
}

/**
 * Sustituye las etiquetas de UN fragmento (un párrafo, una fila) uniendo antes el texto de
 * sus runs. `resolver` devuelve `null` si no conoce la etiqueta, y entonces se deja intacta
 * (y se apunta en `sinResolver`, que es lo que hace que el panel pueda parar la tirada).
 */
export function sustituirEnFragmento(
  xml: string,
  resolver: (etiqueta: string) => string | null,
  sinResolver?: Set<string>,
): string {
  const nodos = nodosTexto(xml);
  if (nodos.length === 0) return xml;
  const completo = nodos.map((n) => n.texto).join('');
  if (!completo.includes('<<')) return xml;

  const ops: Operacion[] = [];
  for (const m of completo.matchAll(ETIQUETA)) {
    const cruda = m[1];
    if (MARCA_FILAS.test(cruda) || MARCA_FILAS_CLASE.test(cruda) || MARCA_CONDICION.test(cruda)) {
      // Las marcas estructurales las procesa quien va antes (filas y condicionales); si
      // llegan hasta aquí es que no aplicaban, y se borran para no imprimirlas.
      ops.push({ ini: m.index, fin: m.index + m[0].length, texto: '' });
      continue;
    }
    const valor = resolver(cruda);
    if (valor === null) {
      sinResolver?.add(cruda.trim());
      continue;
    }
    ops.push({ ini: m.index, fin: m.index + m[0].length, texto: valor });
  }
  if (ops.length === 0) return xml;

  // Texto nuevo de cada nodo: se recorre el texto unido saltando los tramos sustituidos y
  // metiendo el reemplazo en el nodo donde EMPIEZA la etiqueta (los demás quedan vacíos).
  let desde = 0;
  const nuevos = nodos.map((nodo) => {
    const hasta = desde + nodo.texto.length;
    let salida = '';
    let p = desde;
    while (p < hasta) {
      const op = ops.find((o) => o.ini === p);
      if (op) {
        salida += op.texto;
        p = op.fin;
        continue;
      }
      if (!ops.some((o) => p > o.ini && p < o.fin)) salida += completo[p];
      p++;
    }
    desde = hasta;
    return salida;
  });

  let resultado = xml;
  for (let i = nodos.length - 1; i >= 0; i--) {
    const nodo = nodos[i];
    const texto = nuevos[i];
    resultado = resultado.slice(0, nodo.ini) + codificar(texto) + resultado.slice(nodo.fin);
    // Los espacios de los extremos se pierden sin xml:space="preserve" ("Nom  <<nom>>").
    if (/^\s|\s$/.test(texto)) {
      const apertura = resultado.slice(nodo.aperturaIni, nodo.aperturaFin);
      if (!apertura.includes('xml:space')) {
        const conEspacio = apertura.replace(/^<w:t/, '<w:t xml:space="preserve"');
        resultado = resultado.slice(0, nodo.aperturaIni) + conEspacio + resultado.slice(nodo.aperturaFin);
      }
    }
  }
  return resultado;
}

// ─── Etiquetas de una plantilla ───────────────────────────────────────────────

/**
 * Etiquetas que usa un XML de Word, en orden de aparición y sin repetir. Se busca párrafo
 * a párrafo (uniendo runs) para no inventarse etiquetas a caballo entre dos párrafos.
 */
export function etiquetasDeXml(xml: string): string[] {
  const vistas = new Set<string>();
  const orden: string[] = [];
  for (const b of localizarBloques(xml, 'w:p')) {
    for (const cruda of marcasDe(xml.slice(b.inicio, b.fin))) {
      const limpia = cruda.trim();
      if (vistas.has(limpia)) continue;
      vistas.add(limpia);
      orden.push(limpia);
    }
  }
  return orden;
}

/** ¿Esta plantilla tiene filas repetibles (`<<#alumnos>>`)? */
export function tieneFilasRepetibles(xml: string): boolean {
  return localizarBloques(xml, 'w:tr').some((b) =>
    marcasDe(xml.slice(b.inicio, b.fin)).some((m) => MARCA_FILAS.test(m) || MARCA_FILAS_CLASE.test(m)),
  );
}

// ─── Aplicar un contexto a un fragmento ───────────────────────────────────────

function resolverDe(ctx: Contexto, normalizar: (s: string) => string) {
  const presentes = new Set((ctx.presentes ?? []).map(normalizar));
  return {
    valor: (etiqueta: string): string | null => {
      const valor = ctx.valores[normalizar(etiqueta)];
      return valor === undefined ? null : valor;
    },
    presente: (nombre: string): boolean => {
      const clave = normalizar(nombre);
      if (presentes.has(clave)) return true;
      return (ctx.valores[clave] ?? '') !== '';
    },
  };
}

/** Quita (o deja) los párrafos marcados con `<<?campo>>` según si el dato existe. */
function aplicarCondicionales(xml: string, presente: (n: string) => boolean): string {
  return reemplazarBloques(xml, localizarBloques(xml, 'w:p'), (parrafo) => {
    const condiciones = marcasDe(parrafo)
      .map((m) => MARCA_CONDICION.exec(m))
      .filter((m): m is RegExpExecArray => m !== null);
    if (condiciones.length === 0) return parrafo;
    // Con varias condiciones en el mismo párrafo tienen que cumplirse todas.
    return condiciones.every((c) => presente(c[1])) ? parrafo : '';
  });
}

/**
 * Rellena un fragmento con un contexto: primero las filas repetibles (cada una con su
 * propio contexto), luego los condicionales, y por último las etiquetas.
 */
export function aplicarContexto(
  xml: string,
  ctx: Contexto,
  normalizar: (s: string) => string,
  sinResolver?: Set<string>,
): string {
  const { valor, presente } = resolverDe(ctx, normalizar);
  let salida = xml;

  // Las filas repetibles se rellenan aparte y se apartan tras un marcador que no puede
  // aparecer en un XML, para que el resto del proceso no las vuelva a tocar.
  const guardadas: string[] = [];
  const repetir = (marca: RegExp, contextos: Contexto[] | undefined) => {
    if (!contextos) return;
    const filas = localizarBloques(salida, 'w:tr').filter((b) =>
      marcasDe(salida.slice(b.inicio, b.fin)).some((m) => marca.test(m)),
    );
    salida = reemplazarBloques(salida, filas, (plantillaFila) => {
      const clones = contextos.map((fila) => aplicarContexto(plantillaFila, fila, normalizar, sinResolver));
      guardadas.push(clones.join(''));
      return `${HUECO}${guardadas.length - 1}${HUECO}`;
    });
  };
  repetir(MARCA_FILAS, ctx.filas);
  repetir(MARCA_FILAS_CLASE, ctx.filasClase);

  salida = aplicarCondicionales(salida, presente);
  salida = reemplazarBloques(salida, localizarBloques(salida, 'w:p'), (parrafo) =>
    sustituirEnFragmento(parrafo, valor, sinResolver),
  );
  return salida.replace(new RegExp(`${HUECO}(\\d+)${HUECO}`, 'g'), (_, i: string) => guardadas[Number(i)] ?? '');
}

// ─── Repetición del cuerpo ────────────────────────────────────────────────────

interface Cuerpo {
  prefijo: string;
  contenido: string;
  sectPr: string;
  sufijo: string;
}

function partirCuerpo(xml: string): Cuerpo | null {
  const apertura = /<w:body(?:\s[^>]*)?>/.exec(xml);
  const cierre = xml.lastIndexOf('</w:body>');
  if (!apertura || cierre < 0) return null;
  const iniContenido = apertura.index + apertura[0].length;
  let contenido = xml.slice(iniContenido, cierre);
  let sectPr = '';
  // El `sectPr` final (tamaño de página, márgenes) es el último hijo de `w:body` y va una
  // sola vez, al final: si se duplicara con el cuerpo, el documento saldría con secciones
  // de más. Los `sectPr` de dentro de un párrafo (saltos de sección) no son este.
  const ultimo = localizarBloques(contenido, 'w:sectPr').at(-1);
  if (ultimo && contenido.slice(ultimo.fin).trim() === '') {
    sectPr = contenido.slice(ultimo.inicio, ultimo.fin);
    contenido = contenido.slice(0, ultimo.inicio);
  }
  return { prefijo: xml.slice(0, iniContenido), contenido, sectPr, sufijo: xml.slice(cierre) };
}

/**
 * Renumera los ids que tienen que ser únicos en el documento. Sin esto, 30 copias del
 * cuerpo dejan 30 marcadores con `w:id="0"` y 30 imágenes con `docPr id="1"`, y el
 * conversor de Google puede comerse una imagen o dejar los enlaces internos apuntando mal.
 */
export function renumerarIds(xml: string, copia: number): string {
  if (copia === 0) return xml;
  const salto = copia * 100000;
  const desplazar = (_: string, a: string, n: string, b: string) => `${a}${Number(n) + salto}${b}`;
  return xml
    .replace(/(<w:bookmark(?:Start|End)\b[^>]*?\bw:id=")(\d+)(")/g, (m, a, n, b) => desplazar(m, a, n, b))
    .replace(/(<w:bookmarkStart\b[^>]*?\bw:name=")([^"]*)(")/g, (_, a: string, n: string, b: string) => `${a}${n}_c${copia}${b}`)
    .replace(/(<wp:docPr\b[^>]*?\bid=")(\d+)(")/g, (m, a, n, b) => desplazar(m, a, n, b))
    .replace(/(<pic:cNvPr\b[^>]*?\bid=")(\d+)(")/g, (m, a, n, b) => desplazar(m, a, n, b));
}

/**
 * Rellena `word/document.xml`: repite el cuerpo una vez por copia (con salto de página
 * entre ellas), rellena cada copia con su contexto y deja el `sectPr` una sola vez.
 */
export function rellenarDocumentXml(
  xml: string,
  plan: PlanRelleno,
  normalizar: (s: string) => string,
): ResultadoRelleno {
  const sinResolver = new Set<string>();
  const cuerpo = partirCuerpo(xml);
  if (!cuerpo) {
    // Sin `w:body` no es un documento: se rellena como fragmento y a otra cosa.
    const ctx = plan.copias[0];
    const salida = ctx ? aplicarContexto(xml, ctx, normalizar, sinResolver) : xml;
    return { xml: salida, sinResolver: [...sinResolver] };
  }
  const separador = plan.saltoDePagina === false ? '' : SALTO_PAGINA;
  const copias = plan.copias.map((ctx, i) =>
    renumerarIds(aplicarContexto(cuerpo.contenido, ctx, normalizar, sinResolver), i),
  );
  const contenido = copias.join(separador) || cuerpo.contenido;
  return { xml: cuerpo.prefijo + contenido + cuerpo.sectPr + cuerpo.sufijo, sinResolver: [...sinResolver] };
}

/** Rellena una cabecera o un pie (no llevan `w:body` ni se repiten). */
export function rellenarFragmentoXml(xml: string, ctx: Contexto, normalizar: (s: string) => string): ResultadoRelleno {
  const sinResolver = new Set<string>();
  return { xml: aplicarContexto(xml, ctx, normalizar, sinResolver), sinResolver: [...sinResolver] };
}
