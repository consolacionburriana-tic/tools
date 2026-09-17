// Helpers puros de la ficha de alumnado. Sin red y sin BBDD: todo lo de aquí se puede
// probar con `pnpm test` (`src/lib/__tests__/alumnado.test.ts`).
//
// La ficha existe para responder rápido a tres preguntas que el claustro hace a diario:
// «¿a quién llamo?», «¿este es del banco de libros / tiene el pedido hecho?» y «dame su NIA».
// Todo lo que hay aquí está al servicio de eso.
// Ficha del módulo: docs/21-alumnado.md

// ─── Búsqueda ─────────────────────────────────────────────────────────────────

/**
 * Texto normalizado para buscar: sin acentos, sin mayúsculas y sin signos. Es lo que hace
 * que «muñoz», «MUNOZ» y «Muñóz» encuentren a la misma persona, y que un NIA pegado con
 * espacios de sobra siga casando.
 */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * ¿Casa esta ficha con lo que se está escribiendo? Todas las palabras del término tienen que
 * aparecer en alguno de los campos indexados, en cualquier orden: «roldan aitana» encuentra a
 * «Aitana Pitarch Roldán», y «11430» encuentra su NIA.
 */
export function casaBusqueda(indice: string, termino: string): boolean {
  const palabras = normalizar(termino).split(' ').filter(Boolean);
  if (palabras.length === 0) return true;
  return palabras.every((p) => indice.includes(p));
}

/** El texto sobre el que se busca una ficha: nombre, apellidos, clase e identificadores. */
export function indiceDeBusqueda(alumno: {
  nombre: string;
  apellido1: string;
  apellido2: string;
  clase: string;
  nia: string | null;
  dni: string | null;
  codigo: string | null;
}): string {
  return normalizar(
    [alumno.nombre, alumno.apellido1, alumno.apellido2, alumno.clase, alumno.nia, alumno.dni, alumno.codigo]
      .filter(Boolean)
      .join(' '),
  );
}

// ─── Edad y cumpleaños ────────────────────────────────────────────────────────

/** Fecha ISO (`'2013-01-29'`) → fecha local de ese día. Null si no se entiende. */
export function fechaDeIso(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function edadEnAnios(nacimiento: string | null | undefined, hoy = new Date()): number | null {
  const fecha = fechaDeIso(nacimiento);
  if (!fecha) return null;
  let edad = hoy.getFullYear() - fecha.getFullYear();
  const cumplioYa =
    hoy.getMonth() > fecha.getMonth() || (hoy.getMonth() === fecha.getMonth() && hoy.getDate() >= fecha.getDate());
  if (!cumplioYa) edad--;
  return edad >= 0 && edad < 130 ? edad : null;
}

/**
 * Días que faltan para el próximo cumpleaños (0 = hoy). El 29 de febrero se celebra el 1 de
 * marzo en los años que no son bisiestos, que es lo que hace `Date` solo al normalizar.
 */
export function diasHastaCumple(nacimiento: string | null | undefined, hoy = new Date()): number | null {
  const fecha = fechaDeIso(nacimiento);
  if (!fecha) return null;
  const hoySinHora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  let proximo = new Date(hoy.getFullYear(), fecha.getMonth(), fecha.getDate());
  if (proximo < hoySinHora) proximo = new Date(hoy.getFullYear() + 1, fecha.getMonth(), fecha.getDate());
  return Math.round((proximo.getTime() - hoySinHora.getTime()) / 86_400_000);
}

/** «Hoy 🎂», «mañana», «en 5 días» — o null si queda más de una semana. */
export function avisoCumple(nacimiento: string | null | undefined, hoy = new Date()): string | null {
  const dias = diasHastaCumple(nacimiento, hoy);
  if (dias === null || dias > 7) return null;
  if (dias === 0) return 'Cumple hoy 🎂';
  if (dias === 1) return 'Cumple mañana 🎂';
  return `Cumple en ${dias} días`;
}

// ─── Teléfonos y correos ──────────────────────────────────────────────────────

/**
 * Teléfono presentable y, sobre todo, **pulsable**: Educamos los manda de todas las formas
 * posibles (`618609291`, `'661 61 40 20'`, y como número cuando viene de un Excel). Se
 * devuelve el texto agrupado de tres en tres y el `tel:` limpio para el enlace.
 */
export function telefono(bruto: string | number | null | undefined): { texto: string; tel: string } | null {
  const crudo = String(bruto ?? '').trim();
  if (!crudo) return null;
  const digitos = crudo.replace(/[^\d+]/g, '');
  const soloNumeros = digitos.replace(/\D/g, '');
  // Menos de 9 cifras no es un teléfono español: se devuelve tal cual y sin enlace, para no
  // inventar una llamada a un dato que en realidad es una nota.
  if (soloNumeros.length < 9) return { texto: crudo, tel: '' };
  const nacional = soloNumeros.length === 9;
  const texto = nacional ? soloNumeros.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3') : crudo;
  return { texto, tel: nacional ? `+34${soloNumeros}` : digitos.startsWith('+') ? digitos : `+${soloNumeros}` };
}

/** Número para un enlace de WhatsApp, solo si parece un móvil español (6 o 7). */
export function whatsapp(bruto: string | number | null | undefined): string | null {
  const t = telefono(bruto);
  if (!t?.tel) return null;
  const nacional = /^\+34([67]\d{8})$/.exec(t.tel);
  return nacional ? `34${nacional[1]}` : null;
}

export function esCorreo(texto: string | null | undefined): boolean {
  const t = (texto ?? '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t);
}

/** Correos únicos y en minúscula, en el orden en que llegan. */
export function correosUnicos(correos: readonly (string | null | undefined)[]): string[] {
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const c of correos) {
    const limpio = (c ?? '').trim().toLowerCase();
    if (!limpio || !esCorreo(limpio) || vistos.has(limpio)) continue;
    vistos.add(limpio);
    salida.push(limpio);
  }
  return salida;
}

// ─── Domicilio ────────────────────────────────────────────────────────────────

/**
 * La dirección **no viene en una columna**: Educamos la reparte en `TIPO VÍA`, `CALLE`,
 * `NÚMERO`, `BLOQUE`, `ESCALERA`, `PISO` y `PUERTA` dentro del `extra` del tutor legal
 * (`edu_guardians.direccion` está a null en las 977 filas). Esto la vuelve a juntar en la
 * línea de siempre: «C/ Mayor 14, esc. 2, 3º B».
 */
export interface ValorDomicilio {
  calle: string;
  poblacion: string;
  /** Las dos líneas juntas, para copiar de un clic. */
  completo: string;
}

export function domicilio(
  extra: Record<string, string> | null | undefined,
  datos: { cp?: string | null; localidad?: string | null; provincia?: string | null } = {},
): ValorDomicilio | null {
  const de = (sufijo: string): string => {
    if (!extra) return '';
    // Las claves llevan pegado el número de tutor (`CALLE TUTOR1`), así que se busca por
    // prefijo en vez de por igualdad: la ficha no tiene por qué saber de qué tutor es.
    const clave = Object.keys(extra).find((k) => k.toUpperCase().startsWith(sufijo));
    return clave ? (extra[clave] ?? '').trim() : '';
  };
  const via = [de('TIPO VÍA'), de('CALLE')].filter(Boolean).join(' ');
  const numero = de('NÚMERO');
  // Piso y puerta son UN dato («3º B»), no dos: separados por coma se lee como si fueran
  // dos viviendas distintas.
  const vivienda = [de('PISO') && `${de('PISO')}º`, de('PUERTA')].filter(Boolean).join(' ');
  const detalles = [
    de('BLOQUE') && `bl. ${de('BLOQUE')}`,
    de('ESCALERA') && `esc. ${de('ESCALERA')}`,
    vivienda,
  ].filter(Boolean);

  const calle = [[via, numero].filter(Boolean).join(' '), ...detalles].filter(Boolean).join(', ');
  const poblacion = [datos.cp, datos.localidad, datos.provincia && `(${datos.provincia})`].filter(Boolean).join(' ');
  if (!calle && !poblacion) return null;
  return { calle, poblacion, completo: [calle, poblacion].filter(Boolean).join(' · ') };
}

// ─── Banderitas del `extra` ───────────────────────────────────────────────────

/** `'TRUE'`/`'FALSE'` de Educamos → booleano. Cualquier otra cosa, null. */
export function siNo(valor: string | null | undefined): boolean | null {
  const v = (valor ?? '').trim().toUpperCase();
  if (v === 'TRUE' || v === 'SI' || v === 'SÍ' || v === '1') return true;
  if (v === 'FALSE' || v === 'NO' || v === '0') return false;
  return null;
}

/** Busca una clave del `extra` sin preocuparse del sufijo `TUTOR1`/`TUTOR2` ni de acentos. */
export function delExtra(extra: Record<string, string> | null | undefined, prefijo: string): string | null {
  if (!extra) return null;
  const buscado = normalizar(prefijo);
  const clave = Object.keys(extra).find((k) => normalizar(k).startsWith(buscado));
  const valor = clave ? (extra[clave] ?? '').trim() : '';
  return valor || null;
}

// ─── Etapa y clase ────────────────────────────────────────────────────────────

/**
 * `'2ESO'` + `'B'` → `'2º ESO B'`, la forma larga que usa el colegio al hablar.
 *
 * Tres rarezas reales del listado que hay que respetar: el código de los PDC ya trae el
 * ordinal pegado (`'3ºPPDC'`, y su letra es literalmente `'PDC'`), así que ni se le añade
 * otro `º` ni se repite el `PDC` al final; y ese `PPDC` es como viene de Educamos, pero se
 * dice y se escribe «PDC».
 */
export function claseLarga(curso: string | null | undefined, letra: string | null | undefined): string {
  if (!curso) return '—';
  const m = /^(\d+)\s*[ºo°]?\s*(.*)$/.exec(curso);
  const resto = (m?.[2] ?? '').trim().replace(/^PPDC$/i, 'PDC');
  const base = m ? `${m[1]}º ${resto}`.trim() : curso;
  const cola = letra && !base.toUpperCase().includes(letra.toUpperCase()) ? ` ${letra}` : '';
  return `${base}${cola}`;
}

/** Iniciales para el avatar: «Aitana Pitarch» → «AP». */
export function iniciales(nombre: string, apellido1: string): string {
  const a = (nombre ?? '').trim().charAt(0).toUpperCase();
  const b = (apellido1 ?? '').trim().charAt(0).toUpperCase();
  return `${a}${b}` || '?';
}

/**
 * Color estable a partir de un id, para el avatar. Es determinista a propósito: el mismo
 * alumno tiene siempre el mismo color, así que la vista se vuelve reconocible con el uso.
 */
export const COLORES_AVATAR = [
  'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
] as const;

export function colorAvatar(id: string): string {
  let suma = 0;
  for (let i = 0; i < id.length; i++) suma = (suma + id.charCodeAt(i)) % 4096;
  return COLORES_AVATAR[suma % COLORES_AVATAR.length];
}

// ─── Protección de datos ──────────────────────────────────────────────────────
//
// Las cuatro autorizaciones que firma la familia al matricular. Son TRI-ESTADO:
// `true` autoriza · `false` NO autoriza · `null` no consta. Esa tercera posibilidad es la
// importante: «no consta» no es «ha dicho que no», y tampoco es «se puede publicar». Quien
// mira la ficha antes de subir una foto necesita ver la diferencia de un vistazo.

export const CAMPOS_PROTECCION = ['imagen', 'redes', 'ampa', 'ong'] as const;
export type CampoProteccion = (typeof CAMPOS_PROTECCION)[number];

export const PROTECCION_LABELS: Record<CampoProteccion, { titulo: string; corto: string; ayuda: string }> = {
  imagen: {
    titulo: 'Imagen y voz',
    corto: 'imagen',
    ayuda: 'Fotos y vídeos hechos en actividades del colegio',
  },
  redes: {
    titulo: 'Redes y web',
    corto: 'redes',
    ayuda: 'Publicarlas en la web y las redes del colegio',
  },
  ampa: {
    titulo: 'AMPA',
    corto: 'AMPA',
    ayuda: 'Que el AMPA publique fotos suyas en sus canales',
  },
  ong: {
    titulo: 'ONG',
    corto: 'ONG',
    ayuda: 'Cesión a la ONG (MCM) para sus materiales y campañas',
  },
};

export interface ProteccionDatos {
  imagen: boolean | null;
  redes: boolean | null;
  ampa: boolean | null;
  ong: boolean | null;
  /** ¿Está el documento firmado y guardado en secretaría? */
  firmada: boolean;
  notas: string | null;
  actualizadoAt: string | null;
  actualizadoPor: string | null;
}

/** Los cuatro permisos, sin la metainformación de la firma. */
export const permisosDe = (pd: ProteccionDatos): Record<CampoProteccion, boolean | null> => ({
  imagen: pd.imagen,
  redes: pd.redes,
  ampa: pd.ampa,
  ong: pd.ong,
});

/** Lo que la familia ha dicho que NO, en el orden de siempre y con el nombre corto. */
export function noAutorizados(pd: ProteccionDatos): string[] {
  const permisos = permisosDe(pd);
  return CAMPOS_PROTECCION.filter((c) => permisos[c] === false).map((c) => PROTECCION_LABELS[c].corto);
}

/** Los que no constan: ni sí ni no. */
export function sinConstar(pd: ProteccionDatos): string[] {
  const permisos = permisosDe(pd);
  return CAMPOS_PROTECCION.filter((c) => permisos[c] === null).map((c) => PROTECCION_LABELS[c].corto);
}

export type TonoProteccion = 'rojo' | 'ambar' | 'verde' | 'gris';

/**
 * El chip que se pinta arriba del todo en la ficha, que es donde se mira antes de publicar
 * una foto. El orden de la decisión no es casual:
 *
 *  1. Un NO a la imagen manda sobre todo lo demás y sale en ROJO: es el error caro.
 *  2. Un no a cualquiera de las otras tres, en ámbar y diciendo a cuál.
 *  3. Con huecos sin marcar, gris: ni sí ni no, y se dice cuáles.
 *  4. Todo autorizado, verde; y si encima falta la firma, se dice al lado sin dar la nota.
 */
export function avisoProteccion(pd: ProteccionDatos): { tono: TonoProteccion; texto: string; detalle?: string } {
  const noes = noAutorizados(pd);
  const faltan = sinConstar(pd);

  if (pd.imagen === false) {
    const otros = noes.filter((n) => n !== PROTECCION_LABELS.imagen.corto);
    return {
      tono: 'rojo',
      texto: 'NO puede salir en fotos',
      detalle: otros.length > 0 ? `tampoco ${otros.join(', ')}` : undefined,
    };
  }
  if (noes.length > 0) {
    return { tono: 'ambar', texto: `Sin permiso de ${noes.join(', ')}`, detalle: pd.firmada ? undefined : 'sin firmar' };
  }
  if (faltan.length > 0) {
    return { tono: 'gris', texto: 'Protección de datos a medias', detalle: `sin marcar: ${faltan.join(', ')}` };
  }
  // Todo autorizado. Que falte la firma se dice, pero en verde y de refilón: desde que el
  // punto de partida es «sí a todo», un ámbar aquí saldría en las 639 fichas, y una alarma
  // que sale siempre es una alarma que nadie lee.
  return { tono: 'verde', texto: 'Imagen autorizada', detalle: pd.firmada ? undefined : 'sin firmar' };
}

/** ¿Hay algo aquí que no sea «todo en blanco»? Sirve para no pintar filas vacías. */
export const tieneProteccion = (pd: ProteccionDatos): boolean =>
  pd.firmada || Boolean(pd.notas) || CAMPOS_PROTECCION.some((c) => permisosDe(pd)[c] !== null);
