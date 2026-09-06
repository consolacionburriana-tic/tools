// Cómo se escriben las personas en el cuaderno. Puro y testeado.
//
// De Educamos todo llega A GRITOS: «CARLOS ANDRES VALERO AICART», «MARIA@…». En una hoja
// que va a leer una familia eso queda fatal, así que aquí se arregla una sola vez, en el
// sitio por el que pasan todos: nombres con mayúsculas de verdad, correos en minúscula y
// el nombre por el que a la gente se la llama de normal.
//
// Regla que manda sobre todo lo demás: **si alguien ha escrito el nombre a mano, se
// respeta tal cual**. Estas funciones solo arreglan lo que viene mal del export.

// ─── Mayúsculas bellas ────────────────────────────────────────────────────────

/**
 * Palabras que van en minúscula cuando están EN MEDIO del nombre. Es la lista corta de las
 * que se usan de verdad aquí: castellano, valenciano y los apellidos de fuera más comunes
 * en el centro. Al principio de un nombre siempre van en mayúscula («De la Fuente, Ana»).
 */
const PARTICULAS = new Set([
  'de', 'del', 'la', 'las', 'le', 'lo', 'los', 'y', 'e', 'i',
  'da', 'das', 'do', 'dos', 'dello', 'della', 'di', 'du',
  'van', 'von', 'der', 'den', 'ter', 'ten', 'bin', 'ben', 'el', 'al',
]);

/** `MC`/`MAC` + nombre y el `O'` irlandés llevan mayúscula dentro de la palabra. */
function capitalizarPalabra(palabra: string): string {
  if (palabra === '') return palabra;
  // Trozos unidos por guion o apóstrofe: cada uno se capitaliza («maría-josé», «o'connor»).
  if (/[-'’]/.test(palabra)) {
    return palabra
      .split(/([-'’])/)
      .map((trozo) => (/[-'’]/.test(trozo) ? trozo : capitalizarPalabra(trozo)))
      .join('');
  }
  return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
}

/**
 * ¿Hace falta tocar este texto? Solo si viene TODO en mayúsculas o TODO en minúsculas, que
 * es lo que hace el export. Un nombre ya escrito como toca —«María de la O», «van Gogh»,
 * «McCarthy»— se deja en paz: quien lo escribió sabía más que esta función.
 */
export function pareceMalEscrito(texto: string): boolean {
  const letras = texto.replace(/[^\p{L}]/gu, '');
  if (letras === '') return false;
  return letras === letras.toUpperCase() || letras === letras.toLowerCase();
}

/**
 * `CARLOS ANDRES VALERO AICART` → `Carlos Andrés Valero Aicart`… salvo los acentos, que no
 * se inventan: lo que no traía tilde sigue sin traerla. Lo que sí se arregla son las
 * mayúsculas y las partículas: `MARIA DE LA FUENTE` → `Maria de la Fuente`.
 */
export function mayusculasBellas(texto: string | null | undefined): string {
  const limpio = (texto ?? '').replace(/\s+/g, ' ').trim();
  if (limpio === '' || !pareceMalEscrito(limpio)) return limpio;
  const palabras = limpio.split(' ');
  return palabras
    .map((palabra, i) => {
      const baja = palabra.toLowerCase();
      // La partícula solo va en minúscula en medio: ni la primera ni la última palabra.
      if (i > 0 && i < palabras.length - 1 && PARTICULAS.has(baja)) return baja;
      return capitalizarPalabra(baja);
    })
    .join(' ');
}

/** Correos siempre en minúscula y sin espacios: es lo único correcto y lo que se ve mejor. */
export function correoBonito(correo: string | null | undefined): string {
  return (correo ?? '').trim().toLowerCase();
}

// ─── El nombre por el que se llama a alguien ──────────────────────────────────

/**
 * Nombres de pila que en España forman compuesto tan a menudo que cortar por el primero
 * deja algo raro: «María» a secas cuando se llama «María José». Con dos tokens y uno de
 * estos delante, se cogen los dos.
 */
const INICIO_DE_COMPUESTO = new Set([
  'maria', 'mª', 'ma', 'mari', 'jose', 'josé', 'juan', 'ana', 'luis', 'miguel',
  'francisco', 'antonio', 'manuel', 'pedro', 'jesus', 'jesús', 'carmen', 'rosa',
]);

/**
 * El nombre de pila: el trozo de `nombre` por el que a alguien se le llama de verdad.
 *
 * `CARLOS ANDRES` → `Carlos` · `MARIA JOSE` → `María Jose` · `MARIA DEL CARMEN` → `Maria del Carmen`
 *
 * Es una heurística, y como tal se equivoca alguna vez; por eso el panel deja fijar a mano
 * el nombre de quien haga falta (`cuad_personas`), que es lo que manda cuando existe.
 */
export function nombreDePila(nombre: string | null | undefined): string {
  const bonito = mayusculasBellas(nombre);
  if (bonito === '') return '';
  const trozos = bonito.split(' ');
  if (trozos.length === 1) return trozos[0];
  if (!INICIO_DE_COMPUESTO.has(trozos[0].toLowerCase())) return trozos[0];
  // «María del Carmen»: la partícula arrastra la palabra que va detrás.
  if (trozos.length >= 3 && PARTICULAS.has(trozos[1].toLowerCase())) return trozos.slice(0, 3).join(' ');
  return trozos.slice(0, 2).join(' ');
}

export interface PersonaBruta {
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
}

/** Cómo se decidió llamar a alguien a mano, si es que se hizo (tabla `cuad_personas`). */
export interface NombreAMano {
  /** Nombre de pila: «Pepe» donde el export dice «JOSE MANUEL». */
  pila?: string | null;
  /** Nombre entero, si ni siquiera los apellidos valen. Manda sobre todo lo demás. */
  completo?: string | null;
}

/** Los cuatro nombres de una persona, ya escritos como salen en el cuaderno. */
export interface NombrePersona {
  /** `Carlos Andrés Valero Aicart` — todo lo que hay, por si alguien lo quiere entero. */
  completo: string;
  /** `Carlos Valero Aicart` — el de la hoja: sin el segundo nombre de pila. */
  usual: string;
  /** `Carlos V` — el de las carpetas y los nombres de archivo. */
  corto: string;
  /** `Carlos` — el nombre a secas. */
  pila: string;
  /** `Valero Aicart`. */
  apellidos: string;
}

/**
 * Escribe los nombres de una persona a partir de lo que hay en `edu_*`, con lo puesto a
 * mano por delante. `usual` es el que va en las hojas: nombre de pila + apellidos, porque
 * «CARLOS ANDRES VALERO AICART» en la cabecera de una entrevista con la familia no lo
 * quiere nadie.
 */
export function nombresDe(persona: PersonaBruta | null, aMano?: NombreAMano | null): NombrePersona {
  const apellidos = [mayusculasBellas(persona?.apellido1), mayusculasBellas(persona?.apellido2)]
    .filter(Boolean)
    .join(' ');
  const nombreExport = mayusculasBellas(persona?.nombre);
  const pila = (aMano?.pila ?? '').trim() || nombreDePila(nombreExport);
  const completo = [nombreExport, apellidos].filter(Boolean).join(' ');
  const usual = (aMano?.completo ?? '').trim() || [pila, apellidos].filter(Boolean).join(' ');
  const inicial = mayusculasBellas(persona?.apellido1).charAt(0);
  return {
    completo: completo || usual,
    usual,
    corto: pila ? (inicial ? `${pila} ${inicial}` : pila) : inicial ? `${inicial}.` : '',
    pila,
    apellidos,
  };
}
