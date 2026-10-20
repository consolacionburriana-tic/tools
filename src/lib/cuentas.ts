// Correos y grupos: helpers puros (sin IO). Ficha: docs/30-cuentas.md
//
// El módulo pone una al lado de la otra dos listas que hasta ahora se miraban por separado:
// las personas de Educamos (alumnado y profesorado de la BBDD central) y las cuentas de Google
// del dominio. Del cruce sale todo lo que hay que hacer: a quién le falta el correo, quién está
// en la unidad organizativa de otra clase, qué bajas siguen con la cuenta abierta y qué
// cuentas no son de nadie. Aquí se decide todo eso sin tocar la BBDD ni Google: el servidor
// (`cuentas-server.ts`) carga los datos y el adaptador (`cuentas-google.ts`) aplica.
//
// Los grupos van al final: qué miembros deberían tener según sus reglas y qué cambia.
import { z } from 'zod';
import { academicYearActual } from '@/lib/constants';
import { compararClases, cursoSiguiente, ETAPA_LABEL, ETAPAS, etapaDeCurso, nivelDeCurso, nombreClase, type Etapa } from '@/lib/cursos';
import { mayusculasBellas, tildesProbables } from '@/lib/personas';

// ─── Lo que llega de cada lado ────────────────────────────────────────────────

/** Una cuenta de Google tal y como se guarda en la foto (`cue_usuarios`). */
export interface CuentaGoogle {
  id: string;
  email: string;
  alias: string[];
  nombre: string | null;
  apellidos: string | null;
  uo: string;
  suspendida: boolean;
  archivada: boolean;
  admin: boolean;
  creadaAt: string | null;
  /** null = no ha entrado nunca. */
  ultimoAccesoAt: string | null;
}

export interface AlumnoCruce {
  id: string;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  curso: string | null;
  letra: string | null;
  emailGoogle: string | null;
  email: string | null;
  activo: boolean;
  /** Última sincronización de Educamos en la que salía: en una baja, cuándo se fue (más o menos). */
  salidaAt: string | null;
  /** La familia ha desestimado el correo del alumno (protección de datos). */
  desestimaCorreo: boolean;
}

export interface ProfeCruce {
  id: string;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  email: string | null;
  emailOtro: string | null;
  activo: boolean;
  /** Fecha de baja de Educamos (`YYYY-MM-DD`). */
  fechaBaja: string | null;
  etapas: Etapa[];
  /** El nombre por el que se le llama, puesto a mano en /gestion/profes («Pepe», «Mª Carmen»). */
  nombreMostrado?: string | null;
}

export const TIPOS_MARCA = ['centro', 'conservar'] as const;
export type TipoMarca = (typeof TIPOS_MARCA)[number];
export const MARCA_LABEL: Record<TipoMarca, string> = {
  centro: 'Cuenta del colegio',
  conservar: 'Se queda',
};
export const MARCA_AYUDA: Record<TipoMarca, string> = {
  centro: 'No es de una persona: tic@, secretaría, licencias, cuentas de servicio…',
  conservar: 'Es de alguien que no está en Educamos y la sigue usando (PAS, colaboradores…)',
};

/** Una cuenta que no casa con nadie de Educamos y que alguien ha dicho que se deja. */
export interface MarcaCuenta {
  googleId: string;
  tipo: TipoMarca;
  nota: string | null;
  por: string | null;
  at: string;
}

// ─── Textos y correos ─────────────────────────────────────────────────────────

/** Sin acentos, en mayúsculas y sin espacios de sobra: para comparar textos de dos sitios. */
function normal(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * La parte de un correo que sale de un nombre: minúsculas, sin acentos, la ñ y la ç como n y
 * c, y solo letras y números. `MARÍA DEL MAR`, `NÚÑEZ` → `mariadelmar`, `nunez`. Google no
 * admite la ñ en un correo, y así están hechos los del colegio.
 */
export function usuarioCorreo(...partes: (string | null | undefined)[]): string {
  return partes
    .filter(Boolean)
    .join('')
    // NFKD y no NFD: así la «ª» de «Mª» se queda en «a» en vez de desaparecer.
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

interface NombreBruto {
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
}

/**
 * Correos que le tocarían a alguien, en orden de preferencia. La regla es la del colegio
 * (medida el 20-oct-2026 sobre las 576 cuentas del alumnado): **nombre + primer apellido**, y
 * si está pillado, con el segundo apellido entero y luego con su inicial.
 */
export function propuestasCorreo(p: NombreBruto): string[] {
  const n = usuarioCorreo(p.nombre);
  const a1 = usuarioCorreo(p.apellido1);
  const a2 = usuarioCorreo(p.apellido2);
  const base = n + (a1 || a2);
  if (!base) return [];
  const lista = [base];
  if (a1 && a2) lista.push(n + a1 + a2, n + a1 + a2.charAt(0));
  return [...new Set(lista)];
}

/** El primer correo libre de los que le tocan, y si no queda ninguno, con un número detrás. */
export function elegirCorreo(p: NombreBruto, ocupados: ReadonlySet<string>, dominio: string): string | null {
  const candidatos = propuestasCorreo(p);
  if (candidatos.length === 0) return null;
  for (const c of candidatos) {
    const email = `${c}@${dominio}`;
    if (!ocupados.has(email)) return email;
  }
  for (let i = 2; i < 100; i++) {
    const email = `${candidatos[0]}${i}@${dominio}`;
    if (!ocupados.has(email)) return email;
  }
  return null;
}

/** Lo que Google admite antes de la arroba: letras, números, punto, guion, guion bajo y apóstrofo. */
const RE_USUARIO = /^[a-z0-9](?:[a-z0-9._'-]{0,62}[a-z0-9])?$/;

/** ¿Es un correo válido de una cuenta nueva del dominio? Devuelve el motivo si no. */
export function motivoCorreoNoValido(email: string, dominio: string): string | null {
  const limpio = email.trim().toLowerCase();
  const [usuario, dom, ...resto] = limpio.split('@');
  if (resto.length > 0 || !usuario || !dom) return 'No parece un correo';
  if (dom !== dominio) return `Tiene que ser @${dominio}`;
  if (!RE_USUARIO.test(usuario)) return 'Solo letras sin acentos, números, punto y guion';
  return null;
}

/**
 * Qué correos se quedan en un profe al volver a importar Educamos. El correo del colegio
 * es el que casa con su cuenta de Google y con el login: si ya lo tiene y el export trae
 * uno personal (Educamos suele tener el de antes de entrar), no se pisa; el personal pasa a
 * `emailOtro`. En todo lo demás manda Educamos.
 */
export function correosProfeTrasSync(
  actual: { email: string | null; emailOtro: string | null } | null,
  entrante: { email: string | null; emailOtro: string | null },
  dominio: string,
): { email: string | null; emailOtro: string | null } {
  const delCole = (e: string | null | undefined) => !!e && e.trim().toLowerCase().endsWith(`@${dominio}`);
  if (!actual || !delCole(actual.email) || delCole(entrante.email)) return entrante;
  const personal = entrante.email ?? entrante.emailOtro;
  return { email: actual.email, emailOtro: personal && personal !== actual.email ? personal : actual.emailOtro };
}

/** «García López, Ana»: como se ordena y se lee una lista de clase. */
export function nombreLista(p: NombreBruto): string {
  const apellidos = [mayusculasBellas(p.apellido1), mayusculasBellas(p.apellido2)].filter(Boolean).join(' ');
  const nombre = mayusculasBellas(p.nombre);
  return apellidos && nombre ? `${apellidos}, ${nombre}` : apellidos || nombre || '(sin nombre)';
}

/**
 * El nombre y los apellidos con los que se crea la cuenta en Google: con mayúsculas de verdad
 * y, en el profesorado, con el nombre por el que se le llama si está puesto a mano. Las
 * tildes no se inventan aquí (ver `sugerenciaTildes`): Educamos las trae cuando la familia
 * las escribió.
 */
export function nombreGoogle(p: NombreBruto & { nombreMostrado?: string | null }): { nombre: string; apellidos: string } {
  return {
    nombre: p.nombreMostrado?.trim() || mayusculasBellas(p.nombre),
    apellidos: [mayusculasBellas(p.apellido1), mayusculasBellas(p.apellido2)].filter(Boolean).join(' '),
  };
}

/**
 * El mismo nombre con las tildes que casi seguro le faltan («Adrian Gomez» → «Adrián
 * Gómez»), o null si no hay nada que sugerir. Es una sugerencia que se acepta con un toque,
 * no un cambio automático: un nombre de fuera puede ir sin tilde a propósito.
 */
export function sugerenciaTildes(n: { nombre: string; apellidos: string }): { nombre: string; apellidos: string } | null {
  const nombre = tildesProbables(n.nombre);
  const apellidos = tildesProbables(n.apellidos);
  return nombre === n.nombre && apellidos === n.apellidos ? null : { nombre, apellidos };
}

/**
 * Los correos (lo de antes de la arroba) que salen de un nombre ya escrito en el diálogo,
 * con los apellidos en un solo texto, en el orden de la norma del cole: nombre + primer
 * apellido con sus partículas («de la Fuente García» → `delafuente`), luego con el segundo
 * entero y luego con su inicial. Para volver a proponer el correo al corregir el nombre.
 */
export function usuariosDesdeNombre(nombre: string, apellidos: string): string[] {
  const palabras = apellidos.trim().split(/\s+/).filter(Boolean);
  let corte = 0;
  while (corte < palabras.length) {
    corte++;
    if (!PARTICULAS_APELLIDO.has(palabras[corte - 1].toLowerCase())) break;
  }
  return propuestasCorreo({ nombre, apellido1: palabras.slice(0, corte).join(' '), apellido2: palabras.slice(corte).join(' ') || null });
}

const PARTICULAS_APELLIDO = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'i', 'da', 'do', 'dos', 'van', 'von', 'di']);

/** Formas en que se puede escribir el nombre de alguien, para encontrar «cuentas que se le parecen». */
function clavesPersona(p: NombreBruto): Set<string> {
  const pila = (p.nombre ?? '').trim().split(/\s+/)[0] ?? '';
  return new Set(
    [
      usuarioCorreo(p.nombre, p.apellido1, p.apellido2),
      usuarioCorreo(p.nombre, p.apellido1),
      usuarioCorreo(pila, p.apellido1),
      ...propuestasCorreo(p),
    ].filter((c) => c.length >= 6),
  );
}

function clavesCuenta(c: CuentaGoogle): Set<string> {
  const familia = (c.apellidos ?? '').trim();
  const primerApellido = familia.split(/\s+/)[0] ?? '';
  return new Set(
    [
      usuarioCorreo(c.nombre, familia),
      usuarioCorreo(c.nombre, primerApellido),
      c.email.split('@')[0] ?? '',
      ...c.alias.map((a) => a.split('@')[0] ?? ''),
    ].filter((x) => x.length >= 6),
  );
}

// ─── Unidades organizativas ───────────────────────────────────────────────────

/** Clave de una clase en el mapa de unidades: `3INF|A`, `3ºPPDC|PDC`, `1BACH|`. */
export function claveClase(curso: string, letra: string | null | undefined): string {
  return `${curso}|${letra ?? ''}`;
}

export function deClaveClase(clave: string): { curso: string; letra: string | null } {
  const [curso, letra] = clave.split('|');
  return { curso: curso ?? '', letra: letra || null };
}

/** `ruta` es `padre` o está dentro de ella. */
export function uoDentroDe(ruta: string | null | undefined, padre: string | null | undefined): boolean {
  if (!ruta || !padre) return false;
  if (padre === '/') return true;
  return ruta === padre || ruta.startsWith(`${padre}/`);
}

/**
 * Las rutas y todas sus unidades padre. Cuando las unidades se deducen de dónde están los
 * usuarios (si no se pueden leer de Google), `/Alumnos` no sale porque no tiene a nadie
 * directamente: sale `/Alumnos/Alumnos Infantil/3 A`.
 */
export function conAscendientes(rutas: readonly string[]): string[] {
  const todas = new Set<string>();
  for (const r of rutas) {
    const partes = r.split('/').filter(Boolean);
    for (let i = 1; i <= partes.length; i++) todas.add(`/${partes.slice(0, i).join('/')}`);
  }
  return [...todas].sort((a, b) => a.localeCompare(b, 'es'));
}

/** El nombre de la unidad: lo que va detrás de la última barra. */
export function nombreUo(ruta: string): string {
  if (ruta === '/') return 'Raíz del dominio';
  return ruta.split('/').filter(Boolean).at(-1) ?? ruta;
}

/** Unidades que no son de una clase: archivo, bajas, pruebas… Nunca se proponen como destino de una clase. */
const RE_APARTADA = /EX[- ]?ALUMN|EX[- ]?PROFE|ANTIGU|ACABAD|ARCHIV|\bBAJAS?\b|PENDIENTE|ELIMINAR|PRUEBA|TEST|GRADUAD|PROMOCION|SALIDA/;

export interface FirmaUo {
  etapa: Etapa | null;
  nivel: number | null;
  letra: string | null;
  /** Lleva un curso delante («2526 3INFA»): es de una promoción, no de una clase fija. */
  cohorte: boolean;
  apartada: boolean;
}

const ETAPA_DE_TOKEN: Record<string, Etapa> = {
  ANO: 'EI',
  ANOS: 'EI',
  INF: 'EI',
  INFANTIL: 'EI',
  EI: 'EI',
  PRI: 'EP',
  PRIMARIA: 'EP',
  EP: 'EP',
  ESO: 'ESO',
  PDC: 'ESO',
  PPDC: 'ESO',
  BACH: 'BACH',
  BAT: 'BACH',
  BACHILLERATO: 'BACH',
};

function etapaDeContexto(contexto: string): Etapa | null {
  if (/INFANTIL/.test(contexto)) return 'EI';
  if (/PRIMARIA/.test(contexto)) return 'EP';
  if (/SECUNDARIA|\bESO\b/.test(contexto)) return 'ESO';
  if (/BACHILLER/.test(contexto)) return 'BACH';
  return null;
}

/**
 * Qué clase parece ser una unidad, leyendo su nombre y el de sus padres. Entiende los nombres
 * que hay en el colegio: `1º ESO A`, `1ºA` (dentro de «Alumnos Primaria»), `3 A` y `4 Años A`
 * (dentro de «Alumnos Infantil») y `2526 3INFA` (la promoción que entró en 2025-26).
 */
export function firmaUo(ruta: string): FirmaUo {
  const partes = ruta.split('/').filter(Boolean);
  const apartada = partes.some((p) => RE_APARTADA.test(normal(p)));
  const hoja = normal(partes.at(-1)).replace(/[º°ª.]/g, ' ').replace(/\s+/g, ' ').trim();
  const contexto = partes.slice(0, -1).map(normal).join(' / ');
  let resto = hoja;
  let cohorte = false;
  const conCurso = resto.match(/^(?:\d{4}|\d{2}[-/]\d{2}|\d{4}[-/]\d{2,4})\s+(.+)$/);
  if (conCurso) {
    cohorte = true;
    resto = conCurso[1];
  }
  const m = resto.match(
    /^(\d{1,2})\s*(ANOS|ANO|INFANTIL|INF|PRIMARIA|PRI|EP|EI|ESO|PPDC|PDC|BACHILLERATO|BACH|BAT)?\s*([A-Z]{1,3})?$/,
  );
  if (!m) return { etapa: null, nivel: null, letra: null, cohorte, apartada };
  const etapa = (m[2] ? ETAPA_DE_TOKEN[m[2]] : null) ?? etapaDeContexto(contexto);
  return { etapa, nivel: Number(m[1]), letra: m[3] ?? null, cohorte, apartada };
}

/**
 * La unidad de una clase, si se ve clara entre las que hay: misma etapa, mismo nivel y misma
 * letra, y que no sea de archivo ni de una promoción. Si hay dos que valen, o ninguna, no
 * adivina: la elige TIC.
 */
export function adivinarUo(clase: { curso: string; letra: string | null }, rutas: readonly string[]): string | null {
  const etapa = etapaDeCurso(clase.curso);
  const nivel = nivelDeCurso(clase.curso);
  const letra = clase.letra ? clase.letra.toUpperCase() : null;
  if (!etapa) return null;
  const buenas = rutas.filter((r) => {
    const f = firmaUo(r);
    return !f.apartada && !f.cohorte && f.etapa === etapa && f.nivel === nivel && f.letra === letra;
  });
  return buenas.length === 1 ? buenas[0] : null;
}

// ─── Ajustes ──────────────────────────────────────────────────────────────────

/**
 * Lo que TIC fija una vez en «Unidades». Lo que está a null se propone solo a partir de las
 * unidades que hay (ver `ajustesEfectivos`) hasta que alguien lo confirme.
 */
export interface AjustesCuentas {
  /** De dónde cuelgan las unidades del alumnado y del profesorado. */
  raizAlumnos: string | null;
  raizProfes: string | null;
  /** La unidad de cada clase. Clave: `claveClase(curso, letra)`. */
  clases: Record<string, string>;
  /** Dónde se crea la cuenta de un profe, según su etapa. */
  profes: Partial<Record<Etapa, string>>;
  /** A dónde van las cuentas que se suspenden. */
  archivoAlumnos: string | null;
  archivoProfes: string | null;
  /** Meter cada baja en una subunidad con su curso («Promoción 2025-26», «Bajas 2026-27»). */
  archivoPorCurso: boolean;
  /** Meses desde que se van hasta que se suspende la cuenta. */
  graciaGraduados: number;
  graciaBajas: number;
  graciaProfes: number;
}

export const AJUSTES_CUENTAS_POR_DEFECTO: AjustesCuentas = {
  raizAlumnos: null,
  raizProfes: null,
  clases: {},
  profes: {},
  archivoAlumnos: null,
  archivoProfes: null,
  archivoPorCurso: false,
  // David, 20-oct-2026: a los de 4º de ESO se les deja el correo unos 8 meses después de irse.
  graciaGraduados: 8,
  graciaBajas: 1,
  graciaProfes: 1,
};

const rutaUo = z.string().trim().max(400).regex(/^\//, 'Una unidad empieza por /');
const meses = z.number().int().min(0).max(36);

export const ajustesCuentasSchema = z.object({
  raizAlumnos: rutaUo.nullable(),
  raizProfes: rutaUo.nullable(),
  clases: z.record(z.string().max(60), rutaUo),
  profes: z.partialRecord(z.enum(ETAPAS), rutaUo),
  archivoAlumnos: rutaUo.nullable(),
  archivoProfes: rutaUo.nullable(),
  archivoPorCurso: z.boolean(),
  graciaGraduados: meses,
  graciaBajas: meses,
  graciaProfes: meses,
});

/** Lo guardado en `cfg_ajustes`, con lo que falte rellenado con lo de por defecto. */
export function leerAjustesCuentas(valor: unknown): AjustesCuentas {
  const r = ajustesCuentasSchema.partial().safeParse(valor);
  if (!r.success) return { ...AJUSTES_CUENTAS_POR_DEFECTO };
  const leido = Object.fromEntries(Object.entries(r.data).filter(([, v]) => v !== undefined));
  return { ...AJUSTES_CUENTAS_POR_DEFECTO, ...leido };
}

/** Qué ajustes son una propuesta (no los ha confirmado nadie todavía). */
export type AjustePropuesto = 'raizAlumnos' | 'raizProfes' | 'archivoAlumnos' | 'archivoProfes' | `profes.${Etapa}`;

/**
 * Los ajustes con los huecos rellenados a partir de las unidades que hay: la raíz del alumnado
 * es la unidad de primer nivel que se llama algo como «Alumnos», el archivo la que se llama
 * «Ex-alumnos»… Lo guardado manda siempre.
 */
export function ajustesEfectivos(
  guardados: AjustesCuentas,
  rutas: readonly string[],
): { ajustes: AjustesCuentas; propuestos: AjustePropuesto[] } {
  const propuestos: AjustePropuesto[] = [];
  rutas = conAscendientes(rutas);
  const primerNivel = rutas.filter((r) => r.split('/').filter(Boolean).length === 1);
  const buscar = (lista: readonly string[], re: RegExp) =>
    lista.filter((r) => re.test(normal(nombreUo(r)))).sort((a, b) => a.length - b.length)[0] ?? null;

  const raizAlumnos = guardados.raizAlumnos ?? buscar(primerNivel, /ALUMN/);
  if (!guardados.raizAlumnos && raizAlumnos) propuestos.push('raizAlumnos');
  const raizProfes = guardados.raizProfes ?? buscar(primerNivel, /PROFES|DOCENT|CLAUSTRO/);
  if (!guardados.raizProfes && raizProfes) propuestos.push('raizProfes');
  const archivoAlumnos = guardados.archivoAlumnos ?? buscar(rutas, /EX[- ]?ALUMN|ANTIGUOS ALUMN/);
  if (!guardados.archivoAlumnos && archivoAlumnos) propuestos.push('archivoAlumnos');
  const archivoProfes = guardados.archivoProfes ?? buscar(rutas, /EX[- ]?PROFES|ANTIGUOS PROFES|EX[- ]?DOCENT/);
  if (!guardados.archivoProfes && archivoProfes) propuestos.push('archivoProfes');

  const profes: Partial<Record<Etapa, string>> = { ...guardados.profes };
  if (raizProfes) {
    const hijas = rutas.filter((r) => r !== raizProfes && uoDentroDe(r, raizProfes));
    for (const etapa of ETAPAS) {
      if (profes[etapa]) continue;
      const re = new RegExp(normal(ETAPA_LABEL[etapa]).slice(0, 6));
      const hallada = buscar(hijas, re);
      if (hallada) {
        profes[etapa] = hallada;
        propuestos.push(`profes.${etapa}`);
      }
    }
  }
  return {
    ajustes: { ...guardados, raizAlumnos, raizProfes, archivoAlumnos, archivoProfes, profes },
    propuestos,
  };
}

// ─── Fechas ───────────────────────────────────────────────────────────────────

/** Una fecha (o un instante) como `YYYY-MM-DD`, o null si no lo es. */
export function aFechaISO(valor: string | Date | null | undefined): string | null {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor.toISOString().slice(0, 10);
  const m = valor.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` + n meses, sin pasarse de fin de mes (31-ene + 1 = 28-feb). */
export function sumarMeses(fecha: string, n: number): string {
  const [y, m, d] = fecha.slice(0, 10).split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const anio = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${anio}-${String(mes).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`;
}

function hoyISO(hoy: Date): string {
  return hoy.toISOString().slice(0, 10);
}

/** Meses enteros entre dos fechas (lo que se pinta como «hace 14 meses»). */
export function mesesEntre(desde: string, hasta: Date): number {
  const a = new Date(desde);
  return (hasta.getUTCFullYear() - a.getUTCFullYear()) * 12 + (hasta.getUTCMonth() - a.getUTCMonth()) - (hasta.getUTCDate() < a.getUTCDate() ? 1 : 0);
}

// ─── El cruce ─────────────────────────────────────────────────────────────────

export type EstadoFila =
  // Personas que están en Educamos
  | 'ok'
  | 'fuera'
  | 'suspendida'
  | 'sin-correo'
  | 'no-le-toca'
  // Bajas de Educamos que conservan la cuenta
  | 'baja'
  | 'baja-espera'
  // Cuentas sin nadie de Educamos
  | 'suelta'
  | 'marcada'
  // Suspendidas: ya fuera de su sitio o ya archivadas
  | 'archivar'
  | 'archivada';

export const ESTADO_LABEL: Record<EstadoFila, string> = {
  ok: 'En su sitio',
  fuera: 'En otra unidad',
  suspendida: 'Suspendida',
  'sin-correo': 'Sin correo',
  'no-le-toca': 'Correo desestimado',
  baja: 'Baja · toca suspender',
  'baja-espera': 'Baja · en espera',
  suelta: 'No está en Educamos',
  marcada: 'Se queda',
  archivar: 'Suspendida · sin archivar',
  archivada: 'Archivada',
};

export type Zona = 'alumnado' | 'profesorado' | 'otras';

export interface CuentaFila {
  id: string;
  email: string;
  nombre: string;
  uo: string;
  suspendida: boolean;
  admin: boolean;
  creadaAt: string | null;
  ultimoAccesoAt: string | null;
}

export interface Parecida {
  /** `a:<id>` alumno · `p:<id>` profe · `g:<id>` cuenta de Google. */
  clave: string;
  nombre: string;
  email: string | null;
  detalle: string | null;
}

export interface FilaCuenta {
  /** `a:<id>` alumno · `p:<id>` profe · `g:<id de Google>` cuenta que no casa con nadie. */
  clave: string;
  tipo: 'alumno' | 'profe' | 'cuenta';
  personaId: string | null;
  nombre: string;
  /** Para ordenar sin acentos. */
  orden: string;
  /** Alumnado: su clase (o la última, si es baja). */
  clase: string | null;
  claveClase: string | null;
  etapa: Etapa | null;
  /** Sigue en Educamos. */
  activo: boolean;
  estado: EstadoFila;
  cuenta: CuentaFila | null;
  /** Lo que tiene apuntado Educamos (correo de Google del alumno, correo del profe). */
  correoEducamos: string | null;
  /** El correo que se le crearía, y con qué nombre y apellidos. */
  propuesta: string | null;
  /** Otros correos libres que también le valdrían (con el segundo apellido, solo el primer nombre…). */
  alternativas: string[];
  paraGoogle: { nombre: string; apellidos: string } | null;
  /** A dónde tendría que ir la cuenta: su clase, o el archivo si se suspende. */
  uoDestino: string | null;
  zona: Zona | null;
  /** Bajas: cuándo se fue y desde cuándo toca suspender. */
  salidaAt: string | null;
  suspenderDesde: string | null;
  graduado: boolean;
  marca: MarcaCuenta | null;
  /** Persona sin correo → cuentas que se le parecen · cuenta suelta → personas que se le parecen. */
  parecidas: Parecida[];
  avisos: string[];
}

export interface FilaClase {
  clave: string;
  curso: string;
  letra: string | null;
  nombre: string;
  etapa: Etapa | null;
  alumnos: number;
  conCuenta: number;
  /** La confirmada, o la propuesta si no hay. */
  uo: string | null;
  confirmada: boolean;
  enSuSitio: number;
  fuera: number;
}

export interface ResumenCuentas {
  crear: { alumnos: number; profes: number; porCurso: { curso: string; n: number }[] };
  fuera: number;
  reactivar: number;
  suspender: number;
  enEspera: number;
  /** La próxima fecha en que a alguna baja le tocará suspender. */
  proximaBaja: string | null;
  archivar: number;
  sueltas: Record<Zona, number>;
  parecidas: number;
  clasesSinUo: number;
}

export interface CruceCuentas {
  filas: FilaCuenta[];
  /** Correos y alias que ya existen en Google: para avisar al escribir uno a mano. */
  enGoogle: string[];
  clases: FilaClase[];
  resumen: ResumenCuentas;
}

export interface DatosCruce {
  cuentas: readonly CuentaGoogle[];
  rutas: readonly string[];
  alumnos: readonly AlumnoCruce[];
  profes: readonly ProfeCruce[];
  marcas: readonly MarcaCuenta[];
  ajustes: AjustesCuentas;
  dominio: string;
  hoy: Date;
}

function aFila(c: CuentaGoogle): CuentaFila {
  const nombre = [c.nombre, c.apellidos].filter(Boolean).join(' ').trim();
  return {
    id: c.id,
    email: c.email,
    nombre: nombre || c.email,
    uo: c.uo,
    suspendida: c.suspendida || c.archivada,
    admin: c.admin,
    creadaAt: c.creadaAt,
    ultimoAccesoAt: c.ultimoAccesoAt,
  };
}

function correoDominio(email: string | null | undefined, dominio: string): string | null {
  const e = (email ?? '').trim().toLowerCase();
  return e.endsWith(`@${dominio}`) ? e : null;
}

/** La unidad de archivo de una cuenta que se suspende, con la subunidad de su curso si se pide. */
export function uoArchivo(
  ajustes: AjustesCuentas,
  quien: { zona: Zona; salidaAt: string | null; graduado: boolean },
): string | null {
  const base = quien.zona === 'alumnado' ? ajustes.archivoAlumnos : ajustes.archivoProfes;
  if (!base) return null;
  if (!ajustes.archivoPorCurso || !quien.salidaAt) return base;
  const curso = academicYearActual(new Date(`${quien.salidaAt.slice(0, 10)}T12:00:00Z`));
  return `${base}/${quien.graduado ? 'Promoción' : 'Bajas'} ${curso}`;
}

function zonaDe(uo: string, ajustes: AjustesCuentas): Zona {
  if (uoDentroDe(uo, ajustes.raizAlumnos)) return 'alumnado';
  if (uoDentroDe(uo, ajustes.raizProfes)) return 'profesorado';
  if (uoDentroDe(uo, ajustes.archivoAlumnos)) return 'alumnado';
  if (uoDentroDe(uo, ajustes.archivoProfes)) return 'profesorado';
  return 'otras';
}

const ORDEN_ESTADO: Record<EstadoFila, number> = {
  'sin-correo': 0,
  suspendida: 1,
  fuera: 2,
  baja: 3,
  suelta: 4,
  archivar: 5,
  'baja-espera': 6,
  'no-le-toca': 7,
  ok: 8,
  marcada: 9,
  archivada: 10,
};

/**
 * El cruce entero. Cada persona de Educamos encuentra su cuenta por el correo que tiene
 * apuntado (el de Google del alumno, o el del profe), contando los alias. Primero las que
 * siguen en el centro: si una baja y un alta apuntan a la misma cuenta, es del alta.
 */
export function cruzar(d: DatosCruce): CruceCuentas {
  const { ajustes, dominio, hoy } = d;
  const hoyTxt = hoyISO(hoy);
  const porCorreo = new Map<string, CuentaGoogle>();
  for (const c of d.cuentas) {
    porCorreo.set(c.email.toLowerCase(), c);
    for (const a of c.alias) porCorreo.set(a.toLowerCase(), c);
  }
  const marcas = new Map(d.marcas.map((m) => [m.googleId, m]));
  const asignadas = new Map<string, string>(); // id de Google → clave de la persona
  const filas: FilaCuenta[] = [];

  // Correos que ya no se pueden proponer: los de Google (también suspendidas y alias) y los
  // que Educamos tiene apuntados a otra persona.
  const ocupados = new Set<string>(porCorreo.keys());
  for (const a of d.alumnos) for (const e of [a.emailGoogle, a.email]) if (e) ocupados.add(e.trim().toLowerCase());
  for (const p of d.profes) for (const e of [p.email, p.emailOtro]) if (e) ocupados.add(e.trim().toLowerCase());

  function buscar(clave: string, correos: (string | null)[]): { cuenta: CuentaGoogle | null; aviso: string | null } {
    for (const e of correos) {
      const c = e ? porCorreo.get(e.trim().toLowerCase()) : undefined;
      if (!c) continue;
      const duena = asignadas.get(c.id);
      if (duena && duena !== clave) return { cuenta: null, aviso: `Su correo ${c.email} es el de otra persona de Educamos` };
      asignadas.set(c.id, clave);
      return { cuenta: c, aviso: null };
    }
    return { cuenta: null, aviso: null };
  }

  // ── Alumnado ──
  const alumnosOrdenados = [...d.alumnos].sort((a, b) => Number(b.activo) - Number(a.activo));
  const clasesUo = new Map<string, { uo: string | null; confirmada: boolean }>();
  function uoDeClase(clave: string): { uo: string | null; confirmada: boolean } {
    let r = clasesUo.get(clave);
    if (!r) {
      const confirmada = ajustes.clases[clave] ?? null;
      r = confirmada ? { uo: confirmada, confirmada: true } : { uo: adivinarUo(deClaveClase(clave), d.rutas), confirmada: false };
      clasesUo.set(clave, r);
    }
    return r;
  }

  for (const a of alumnosOrdenados) {
    const clave = `a:${a.id}`;
    const correoEducamos = correoDominio(a.emailGoogle, dominio) ?? correoDominio(a.email, dominio);
    const { cuenta, aviso } = buscar(clave, [a.emailGoogle, a.email]);
    if (!a.activo && !cuenta) continue; // baja sin cuenta: nada que hacer
    const cc = a.curso ? claveClase(a.curso, a.letra) : null;
    const fila: FilaCuenta = {
      clave,
      tipo: 'alumno',
      personaId: a.id,
      nombre: nombreLista(a),
      orden: normal([a.apellido1, a.apellido2, a.nombre].filter(Boolean).join(' ')),
      clase: a.curso ? nombreClase(a.curso, a.letra) : null,
      claveClase: cc,
      etapa: etapaDeCurso(a.curso),
      activo: a.activo,
      estado: 'ok',
      cuenta: cuenta ? aFila(cuenta) : null,
      correoEducamos,
      propuesta: null,
      alternativas: [],
      paraGoogle: null,
      uoDestino: null,
      zona: 'alumnado',
      salidaAt: null,
      suspenderDesde: null,
      graduado: false,
      marca: null,
      parecidas: [],
      avisos: aviso ? [aviso] : [],
    };
    if (a.activo) {
      const destino = cc ? uoDeClase(cc) : { uo: null, confirmada: false };
      fila.uoDestino = destino.uo;
      if (!cuenta) {
        fila.estado = a.desestimaCorreo ? 'no-le-toca' : 'sin-correo';
        if (correoEducamos && !aviso) fila.avisos.push(`Educamos dice ${correoEducamos}, pero esa cuenta no existe en Google`);
      } else if (cuenta.suspendida || cuenta.archivada) {
        fila.estado = 'suspendida';
      } else if (destino.confirmada && destino.uo && !uoDentroDe(cuenta.uo, destino.uo)) {
        fila.estado = 'fuera';
      }
      if (cuenta && a.desestimaCorreo) fila.avisos.push('La familia desestimó el correo, pero la cuenta existe');
    } else {
      // Baja con cuenta
      fila.graduado = cursoSiguiente(a.curso) === null && etapaDeCurso(a.curso) !== null;
      fila.salidaAt = aFechaISO(a.salidaAt);
      const gracia = fila.graduado ? ajustes.graciaGraduados : ajustes.graciaBajas;
      fila.suspenderDesde = fila.salidaAt ? sumarMeses(fila.salidaAt, gracia) : null;
      fila.uoDestino = uoArchivo(ajustes, { zona: 'alumnado', salidaAt: fila.salidaAt, graduado: fila.graduado });
      fila.estado = estadoDeBaja(cuenta!, fila.suspenderDesde, fila.uoDestino, hoyTxt);
    }
    filas.push(fila);
  }

  // ── Profesorado ──
  const profesOrdenados = [...d.profes].sort((a, b) => Number(b.activo) - Number(a.activo));
  for (const p of profesOrdenados) {
    const clave = `p:${p.id}`;
    const { cuenta, aviso } = buscar(clave, [p.email, p.emailOtro]);
    if (!p.activo && !cuenta) continue;
    const etapa = p.etapas[0] ?? null;
    const fila: FilaCuenta = {
      clave,
      tipo: 'profe',
      personaId: p.id,
      nombre: nombreLista(p),
      orden: normal([p.apellido1, p.apellido2, p.nombre].filter(Boolean).join(' ')),
      clase: null,
      claveClase: null,
      etapa,
      activo: p.activo,
      estado: 'ok',
      cuenta: cuenta ? aFila(cuenta) : null,
      correoEducamos: correoDominio(p.email, dominio),
      propuesta: null,
      alternativas: [],
      paraGoogle: null,
      uoDestino: null,
      zona: 'profesorado',
      salidaAt: null,
      suspenderDesde: null,
      graduado: false,
      marca: null,
      parecidas: [],
      avisos: aviso ? [aviso] : [],
    };
    if (p.activo) {
      fila.uoDestino = (etapa && ajustes.profes[etapa]) || ajustes.raizProfes;
      if (!cuenta) fila.estado = 'sin-correo';
      else if (cuenta.suspendida || cuenta.archivada) fila.estado = 'suspendida';
      if (!cuenta && fila.correoEducamos && !aviso)
        fila.avisos.push(`Educamos dice ${fila.correoEducamos}, pero esa cuenta no existe en Google`);
    } else {
      fila.salidaAt = aFechaISO(p.fechaBaja);
      fila.suspenderDesde = fila.salidaAt ? sumarMeses(fila.salidaAt, ajustes.graciaProfes) : null;
      fila.uoDestino = uoArchivo(ajustes, { zona: 'profesorado', salidaAt: fila.salidaAt, graduado: false });
      fila.estado = estadoDeBaja(cuenta!, fila.suspenderDesde, fila.uoDestino, hoyTxt);
    }
    filas.push(fila);
  }

  // ── Cuentas que no son de nadie ──
  const sueltas: FilaCuenta[] = [];
  for (const c of d.cuentas) {
    if (asignadas.has(c.id)) continue;
    const zona = zonaDe(c.uo, ajustes);
    const marca = marcas.get(c.id) ?? null;
    const destino = zona === 'otras' ? ajustes.archivoProfes : uoArchivo(ajustes, { zona, salidaAt: null, graduado: false });
    const suspendida = c.suspendida || c.archivada;
    let estado: EstadoFila;
    if (suspendida) estado = estadoSuspendida(c.uo, destino);
    else estado = marca || c.admin ? 'marcada' : 'suelta';
    const familia = (c.apellidos ?? '').trim();
    const fila: FilaCuenta = {
      clave: `g:${c.id}`,
      tipo: 'cuenta',
      personaId: null,
      nombre: familia && c.nombre ? `${familia}, ${c.nombre}` : familia || c.nombre || c.email,
      orden: normal([familia, c.nombre].filter(Boolean).join(' ') || c.email),
      clase: null,
      claveClase: null,
      etapa: null,
      activo: false,
      estado,
      cuenta: aFila(c),
      correoEducamos: null,
      propuesta: null,
      alternativas: [],
      paraGoogle: null,
      uoDestino: destino,
      zona,
      salidaAt: null,
      suspenderDesde: null,
      graduado: false,
      marca,
      parecidas: [],
      avisos: c.admin ? ['Es administrador del dominio: no se toca desde aquí'] : [],
    };
    sueltas.push(fila);
    filas.push(fila);
  }

  // ── Personas sin correo ↔ cuentas sueltas que se les parecen ──
  const sinCorreo = filas.filter((f) => f.estado === 'sin-correo' || f.estado === 'no-le-toca');
  const cuentaPorId = new Map(d.cuentas.map((c) => [c.id, c]));
  // También las suspendidas: un alumno que vuelve al colegio ya tiene su cuenta de antes.
  const clavesSueltas = sueltas.map((s) => ({ fila: s, claves: clavesCuenta(cuentaPorId.get(s.cuenta!.id)!) }));
  const personasPorId = new Map<string, NombreBruto & { nombreMostrado?: string | null }>();
  for (const a of d.alumnos) personasPorId.set(`a:${a.id}`, a);
  for (const p of d.profes) personasPorId.set(`p:${p.id}`, p);
  for (const f of sinCorreo) {
    const claves = clavesPersona(personasPorId.get(f.clave)!);
    for (const s of clavesSueltas) {
      if (![...s.claves].some((k) => claves.has(k))) continue;
      f.parecidas.push({
        clave: s.fila.clave,
        nombre: s.fila.nombre,
        email: s.fila.cuenta!.email,
        detalle: `${s.fila.cuenta!.uo}${s.fila.cuenta!.suspendida ? ' · suspendida' : ''}`,
      });
      s.fila.parecidas.push({
        clave: f.clave,
        nombre: f.nombre,
        email: null,
        detalle: f.tipo === 'alumno' ? f.clase : 'Profesorado',
      });
    }
  }

  // ── Correos propuestos (sin repetir entre hermanos ni con lo que ya hay) ──
  for (const f of filas) {
    if (f.estado !== 'sin-correo') continue;
    const persona = personasPorId.get(f.clave)!;
    const libreEducamos = f.correoEducamos && !porCorreo.has(f.correoEducamos) ? f.correoEducamos : null;
    f.propuesta = libreEducamos ?? elegirCorreo(persona, ocupados, dominio);
    if (f.propuesta) ocupados.add(f.propuesta);
    const pila = (persona.nombre ?? '').trim().split(/\s+/)[0] ?? '';
    f.alternativas = [
      ...new Set(
        [...propuestasCorreo(persona), usuarioCorreo(pila, persona.apellido1)]
          .filter(Boolean)
          .map((u) => `${u}@${dominio}`),
      ),
    ]
      .filter((e) => e !== f.propuesta && !ocupados.has(e))
      .slice(0, 4);
    f.paraGoogle = nombreGoogle(persona);
  }

  filas.sort(
    (a, b) =>
      ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] ||
      compararClases({ curso: a.claveClase?.split('|')[0] ?? null, letra: a.claveClase?.split('|')[1] ?? null }, {
        curso: b.claveClase?.split('|')[0] ?? null,
        letra: b.claveClase?.split('|')[1] ?? null,
      }) ||
      a.orden.localeCompare(b.orden, 'es'),
  );

  // ── Clases ──
  const porClase = new Map<string, FilaCuenta[]>();
  for (const f of filas) {
    if (f.tipo !== 'alumno' || !f.activo || !f.claveClase) continue;
    const lista = porClase.get(f.claveClase) ?? [];
    lista.push(f);
    porClase.set(f.claveClase, lista);
  }
  const clases: FilaClase[] = [...porClase.entries()]
    .map(([clave, lista]) => {
      const { curso, letra } = deClaveClase(clave);
      const destino = uoDeClase(clave);
      const conCuenta = lista.filter((f) => f.cuenta && !f.cuenta.suspendida);
      return {
        clave,
        curso,
        letra,
        nombre: nombreClase(curso, letra),
        etapa: etapaDeCurso(curso),
        alumnos: lista.length,
        conCuenta: conCuenta.length,
        uo: destino.uo,
        confirmada: destino.confirmada,
        enSuSitio: destino.uo ? conCuenta.filter((f) => uoDentroDe(f.cuenta!.uo, destino.uo)).length : 0,
        fuera: destino.uo ? conCuenta.filter((f) => !uoDentroDe(f.cuenta!.uo, destino.uo)).length : 0,
      };
    })
    .sort(compararClases);

  return { filas, enGoogle: [...porCorreo.keys()], clases, resumen: resumir(filas, clases) };
}

/**
 * Una cuenta suspendida está archivada si ya está en su archivo… o en cualquier otra unidad
 * de archivo («4 ESO acabado 2023-2024», «Pendientes de eliminar»): lo que sobra es que siga
 * en la unidad de una clase.
 */
function estadoSuspendida(uo: string, archivo: string | null): EstadoFila {
  return archivo && !uoDentroDe(uo, archivo) && !firmaUo(uo).apartada ? 'archivar' : 'archivada';
}

function estadoDeBaja(cuenta: CuentaGoogle, suspenderDesde: string | null, archivo: string | null, hoy: string): EstadoFila {
  if (cuenta.suspendida || cuenta.archivada) return estadoSuspendida(cuenta.uo, archivo);
  return !suspenderDesde || suspenderDesde <= hoy ? 'baja' : 'baja-espera';
}

function resumir(filas: readonly FilaCuenta[], clases: readonly FilaClase[]): ResumenCuentas {
  const crearAlumnos = filas.filter((f) => f.tipo === 'alumno' && f.estado === 'sin-correo');
  const porCurso = new Map<string, number>();
  for (const f of crearAlumnos) {
    const curso = f.claveClase?.split('|')[0] ?? '¿?';
    porCurso.set(curso, (porCurso.get(curso) ?? 0) + 1);
  }
  const espera = filas.filter((f) => f.estado === 'baja-espera').map((f) => f.suspenderDesde!).sort();
  const sueltas: Record<Zona, number> = { alumnado: 0, profesorado: 0, otras: 0 };
  for (const f of filas) if (f.estado === 'suelta' && f.zona) sueltas[f.zona]++;
  return {
    crear: {
      alumnos: crearAlumnos.length,
      profes: filas.filter((f) => f.tipo === 'profe' && f.estado === 'sin-correo').length,
      porCurso: [...porCurso.entries()]
        .map(([curso, n]) => ({ curso, n }))
        .sort((a, b) => compararClases({ curso: a.curso, letra: null }, { curso: b.curso, letra: null })),
    },
    fuera: filas.filter((f) => f.estado === 'fuera').length,
    reactivar: filas.filter((f) => f.estado === 'suspendida').length,
    suspender: filas.filter((f) => f.estado === 'baja').length,
    enEspera: espera.length,
    proximaBaja: espera[0] ?? null,
    archivar: filas.filter((f) => f.estado === 'archivar').length,
    sueltas,
    parecidas: filas.filter((f) => f.tipo !== 'cuenta' && f.parecidas.length > 0).length,
    clasesSinUo: clases.filter((c) => !c.confirmada).length,
  };
}

// ─── Contraseñas ──────────────────────────────────────────────────────────────

const CONSONANTES = 'bcdfghjkmnprstvz';
const VOCALES = 'aeiu'; // sin «o», que se confunde con el cero al dictarla

function aleatorioSeguro(n: number): number {
  const b = new Uint32Array(1);
  globalThis.crypto.getRandomValues(b);
  return b[0] % n;
}

/**
 * Una contraseña que se pueda dictar a una familia o teclear en un iPad: cuatro sílabas y dos
 * cifras («Bakimeru47»). No se guarda en ningún sitio: se enseña una vez al crear la cuenta.
 */
export function generarContrasena(aleatorio: (n: number) => number = aleatorioSeguro): string {
  let palabra = '';
  for (let i = 0; i < 4; i++) palabra += CONSONANTES[aleatorio(CONSONANTES.length)] + VOCALES[aleatorio(VOCALES.length)];
  return palabra.charAt(0).toUpperCase() + palabra.slice(1) + String(10 + aleatorio(90));
}

export const contrasenaSchema = z
  .string()
  .min(8, 'Google pide al menos 8 caracteres')
  .max(100)
  .refine((s) => s.trim() === s, 'Sin espacios al principio ni al final');

// ─── Enlaces a Google ─────────────────────────────────────────────────────────

/** La ficha de una persona en la consola de administración (para lo que no se hace aquí). */
export function enlaceConsolaUsuario(id: string): string {
  return `https://admin.google.com/ac/users/${encodeURIComponent(id)}`;
}

export function enlaceConsolaGrupo(id: string): string {
  return `https://admin.google.com/ac/groups/${encodeURIComponent(id)}`;
}

export const ENLACE_CONSOLA_UNIDADES = 'https://admin.google.com/ac/orgunits';

/** El grupo en groups.google.com, donde lo ven sus miembros. */
export function enlaceGrupo(email: string): string {
  const [nombre, dominio] = email.split('@');
  return `https://groups.google.com/a/${dominio}/g/${encodeURIComponent(nombre ?? '')}`;
}

// ─── Lo que llega por la red ──────────────────────────────────────────────────

const idGoogle = z.string().trim().min(1).max(64);
const correo = z.string().trim().toLowerCase().max(200);

export const crearSchema = z.object({
  cuentas: z
    .array(
      z.object({
        tipo: z.enum(['alumno', 'profe']),
        id: z.string().uuid(),
        email: correo,
        nombre: z.string().trim().min(1, 'Falta el nombre').max(60),
        apellidos: z.string().trim().min(1, 'Faltan los apellidos').max(60),
        uo: rutaUo,
      }),
    )
    .min(1)
    .max(25),
  contrasena: z.discriminatedUnion('modo', [
    z.object({ modo: z.literal('aleatoria') }),
    z.object({ modo: z.literal('comun'), valor: contrasenaSchema }),
  ]),
  cambiarAlEntrar: z.boolean(),
});
export type PeticionCrear = z.infer<typeof crearSchema>;

/** Mover: sin `uo`, a la que le toca según el cruce (su clase). */
export const moverSchema = z.object({
  cuentas: z.array(z.object({ id: idGoogle, uo: rutaUo.optional() })).min(1).max(50),
});

export const suspenderSchema = z.object({
  ids: z.array(idGoogle).min(1).max(50),
  /** Llevarlas a su unidad de archivo. */
  archivar: z.boolean(),
  /** La pantalla obliga a escribir SUSPENDER: el servidor lo comprueba también. */
  confirmacion: z.literal('SUSPENDER'),
});

export const archivarSchema = z.object({ ids: z.array(idGoogle).min(1).max(50) });

export const reactivarSchema = z.object({
  ids: z.array(idGoogle).min(1).max(50),
  /** Devolverla a su sitio (su clase o la unidad de su etapa) al reactivar. */
  aSuSitio: z.boolean(),
});

export const nuevaContrasenaSchema = z.object({
  id: idGoogle,
  contrasena: z.discriminatedUnion('modo', [
    z.object({ modo: z.literal('aleatoria') }),
    z.object({ modo: z.literal('comun'), valor: contrasenaSchema }),
  ]),
  cambiarAlEntrar: z.boolean(),
});

export const vincularSchema = z.object({
  tipo: z.enum(['alumno', 'profe']),
  personaId: z.string().uuid(),
  googleId: idGoogle,
});

export const marcarSchema = z.object({
  googleId: idGoogle,
  tipo: z.enum(TIPOS_MARCA).nullable(),
  nota: z.string().trim().max(300).nullable(),
});

export const crearUoSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'Ponle nombre')
    .max(100)
    .refine((n) => !n.includes('/'), 'Sin barras en el nombre'),
  padre: rutaUo,
});

// ─── Grupos ───────────────────────────────────────────────────────────────────

/**
 * De dónde salen los miembros de un grupo. Cada fuente da una lista de correos desde la BBDD
 * central (nunca por el nombre visible, que se repite), y el grupo es la unión de todas.
 */
export type FuenteGrupo =
  | { tipo: 'profes'; etapa: Etapa | null }
  | { tipo: 'tutores'; etapa: Etapa | null }
  | { tipo: 'alumnos'; etapa: Etapa | null; curso: string | null; clase: string | null }
  | { tipo: 'uo'; ruta: string };

export const MODOS_GRUPO = ['exacto', 'solo-anadir'] as const;
export type ModoGrupo = (typeof MODOS_GRUPO)[number];
export const MODO_GRUPO_LABEL: Record<ModoGrupo, string> = {
  exacto: 'Añadir y quitar',
  'solo-anadir': 'Solo añadir',
};
export const MODO_GRUPO_AYUDA: Record<ModoGrupo, string> = {
  exacto: 'El grupo queda igual que las reglas: entra quien falta y sale quien sobra',
  'solo-anadir': 'Entra quien falta y no sale nadie (para grupos donde también se añade gente a mano)',
};

export interface ReglasGrupo {
  fuentes: FuenteGrupo[];
  /** Correos que están siempre: de fuera del colegio, otros grupos… */
  extra: string[];
  /** Correos que no están nunca, aunque una fuente los traiga. */
  excluidos: string[];
  modo: ModoGrupo;
}

export const REGLAS_VACIAS: ReglasGrupo = { fuentes: [], extra: [], excluidos: [], modo: 'exacto' };

const etapaONull = z.enum(ETAPAS).nullable();
export const fuenteSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('profes'), etapa: etapaONull }),
  z.object({ tipo: z.literal('tutores'), etapa: etapaONull }),
  z.object({
    tipo: z.literal('alumnos'),
    etapa: etapaONull,
    curso: z.string().max(20).nullable(),
    clase: z.string().max(40).nullable(),
  }),
  z.object({ tipo: z.literal('uo'), ruta: rutaUo }),
]);

const listaCorreos = z.array(z.string().trim().toLowerCase().email('Hay un correo mal escrito').max(200)).max(500);

export const reglasSchema = z.object({
  fuentes: z.array(fuenteSchema).max(40),
  extra: listaCorreos,
  excluidos: listaCorreos,
  modo: z.enum(MODOS_GRUPO),
});

export function leerReglas(valor: unknown): ReglasGrupo {
  const r = reglasSchema.safeParse(valor);
  return r.success ? r.data : { ...REGLAS_VACIAS };
}

export const crearGrupoSchema = z.object({
  email: correo,
  nombre: z.string().trim().min(1, 'Ponle nombre').max(120),
  descripcion: z.string().trim().max(500),
  reglas: reglasSchema,
});

/** Cómo se lee una fuente en pantalla: «Profesorado de Primaria», «Alumnado de 3ESO A». */
export function describirFuente(f: FuenteGrupo): string {
  switch (f.tipo) {
    case 'profes':
      return f.etapa ? `Profesorado de ${ETAPA_LABEL[f.etapa]}` : 'Todo el claustro';
    case 'tutores':
      return f.etapa ? `Tutores de ${ETAPA_LABEL[f.etapa]}` : 'Todos los tutores';
    case 'alumnos': {
      if (f.clase) {
        const { curso, letra } = deClaveClase(f.clase);
        return `Alumnado de ${nombreClase(curso, letra)}`;
      }
      if (f.curso) return `Alumnado de ${f.curso}`;
      return f.etapa ? `Alumnado de ${ETAPA_LABEL[f.etapa]}` : 'Todo el alumnado';
    }
    case 'uo':
      return `Cuentas de ${f.ruta === '/' ? 'todo el dominio' : nombreUo(f.ruta)}`;
  }
}

/** Lo que hace falta para resolver las fuentes. Los correos son los de cuentas activas de Google. */
export interface DatosGrupos {
  profes: readonly { nombre: string; email: string | null; etapas: readonly Etapa[] }[];
  /** Tutorías del curso en vigor, con el correo del tutor ya resuelto. */
  tutores: readonly { nombre: string; email: string | null; curso: string; letra: string | null }[];
  alumnos: readonly { nombre: string; email: string | null; curso: string; letra: string | null }[];
  cuentas: readonly CuentaGoogle[];
}

export interface MiembroDeseado {
  email: string;
  nombre: string | null;
  /** Por qué está: la primera fuente que lo trae. */
  motivo: string;
}

export interface Deseados {
  miembros: MiembroDeseado[];
  /** Personas que una fuente pide y no tienen cuenta activa: no entran, y se dice. */
  sinCorreo: { nombre: string; motivo: string }[];
}

/** Quién debería estar en el grupo según sus reglas. */
export function miembrosDeseados(reglas: ReglasGrupo, datos: DatosGrupos): Deseados {
  const excluidos = new Set(reglas.excluidos.map((e) => e.toLowerCase()));
  const miembros = new Map<string, MiembroDeseado>();
  const sinCorreo: Deseados['sinCorreo'] = [];
  const poner = (email: string | null, nombre: string, motivo: string) => {
    if (!email) {
      sinCorreo.push({ nombre, motivo });
      return;
    }
    const e = email.toLowerCase();
    if (excluidos.has(e) || miembros.has(e)) return;
    miembros.set(e, { email: e, nombre, motivo });
  };

  for (const f of reglas.fuentes) {
    const motivo = describirFuente(f);
    if (f.tipo === 'profes') {
      for (const p of datos.profes) if (!f.etapa || p.etapas.includes(f.etapa)) poner(p.email, p.nombre, motivo);
    } else if (f.tipo === 'tutores') {
      for (const t of datos.tutores) if (!f.etapa || etapaDeCurso(t.curso) === f.etapa) poner(t.email, t.nombre, motivo);
    } else if (f.tipo === 'alumnos') {
      for (const a of datos.alumnos) {
        if (f.clase && claveClase(a.curso, a.letra) !== f.clase) continue;
        if (f.curso && a.curso !== f.curso) continue;
        if (f.etapa && etapaDeCurso(a.curso) !== f.etapa) continue;
        poner(a.email, a.nombre, motivo);
      }
    } else {
      for (const c of datos.cuentas) {
        if (c.suspendida || c.archivada || !uoDentroDe(c.uo, f.ruta)) continue;
        poner(c.email, [c.nombre, c.apellidos].filter(Boolean).join(' ') || c.email, motivo);
      }
    }
  }
  for (const e of reglas.extra) {
    const limpio = e.toLowerCase();
    if (!excluidos.has(limpio) && !miembros.has(limpio)) miembros.set(limpio, { email: limpio, nombre: null, motivo: 'Añadido a mano' });
  }
  // Una persona que sale por dos fuentes se cuenta una vez; la que no tiene correo, también.
  const vistos = new Set<string>();
  const sinRepetir = sinCorreo.filter((s) => (vistos.has(s.nombre) ? false : (vistos.add(s.nombre), true)));
  return { miembros: [...miembros.values()], sinCorreo: sinRepetir };
}

/** Un miembro del grupo en Google, como lo da `members.list`. */
export interface MiembroActual {
  id: string | null;
  email: string | null;
  rol: string;
  tipo: string;
}

export interface PlanGrupo {
  anadir: MiembroDeseado[];
  quitar: { id: string | null; email: string; motivo: string }[];
  /** Ya están y se quedan. */
  siguen: number;
  /** Propietarios y gestores: no se tocan nunca, estén o no en las reglas. */
  gestores: number;
  /** Cuántos quitar ya es mucho: la pantalla pide escribir QUITAR. */
  muchasBajas: boolean;
  avisos: string[];
}

/**
 * Qué cambia en un grupo para que quede como dicen sus reglas. Lo aprendido de
 * asistente-grupos (pfelipm), con sus agujeros tapados:
 *
 * - Se compara por el id de Google además de por el correo: un alias o un correo renombrado
 *   no hace que alguien entre y salga en cada pasada.
 * - Propietarios y gestores no se quitan nunca, y los miembros sin correo (el «todo el
 *   dominio» de Google) tampoco.
 * - Si las reglas no dan a nadie, no se quita a nadie: casi seguro que algo está mal.
 */
export function planGrupo(
  deseados: Deseados,
  actuales: readonly MiembroActual[],
  modo: ModoGrupo,
  idPorCorreo: ReadonlyMap<string, string>,
): PlanGrupo {
  const avisos: string[] = [];
  const deseadosId = new Set<string>();
  const deseadosCorreo = new Set<string>();
  for (const m of deseados.miembros) {
    deseadosCorreo.add(m.email);
    const id = idPorCorreo.get(m.email);
    if (id) deseadosId.add(id);
  }
  const actualesId = new Set(actuales.map((a) => a.id).filter((x): x is string => !!x));
  const actualesCorreo = new Set(actuales.map((a) => a.email?.toLowerCase()).filter((x): x is string => !!x));

  const anadir = deseados.miembros.filter((m) => {
    const id = idPorCorreo.get(m.email);
    return !(actualesCorreo.has(m.email) || (id && actualesId.has(id)));
  });

  let gestores = 0;
  const quitar: PlanGrupo['quitar'] = [];
  let siguen = 0;
  for (const a of actuales) {
    const email = a.email?.toLowerCase() ?? null;
    const esta = (email && deseadosCorreo.has(email)) || (a.id && deseadosId.has(a.id));
    if (a.rol === 'OWNER' || a.rol === 'MANAGER') {
      gestores++;
      continue;
    }
    if (esta) {
      siguen++;
      continue;
    }
    if (!email || a.tipo === 'CUSTOMER') continue;
    if (modo === 'exacto') quitar.push({ id: a.id, email, motivo: 'No sale en las reglas' });
    else siguen++;
  }

  if (modo === 'exacto' && deseados.miembros.length === 0 && quitar.length > 0) {
    avisos.push('Las reglas no dan a nadie: no se quita a nadie hasta que las revises');
    siguen += quitar.length;
    quitar.length = 0;
  }
  if (deseados.sinCorreo.length > 0) {
    avisos.push(
      `${deseados.sinCorreo.length} persona${deseados.sinCorreo.length === 1 ? '' : 's'} de las reglas no tiene${deseados.sinCorreo.length === 1 ? '' : 'n'} cuenta activa`,
    );
  }
  const muchasBajas = quitar.length > Math.max(5, Math.ceil(actuales.length * 0.25));
  return { anadir, quitar, siguen, gestores, muchasBajas, avisos };
}
