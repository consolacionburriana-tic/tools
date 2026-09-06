// AUTOASM · núcleo puro del generador de ficheros de Apple School Manager.
//
// ASM importa el centro con SEIS CSV enlazados entre sí (el "SIS CSV" de Apple).
// Este fichero conoce su formato exacto, sabe leerlos, escribirlos y validarlos.
// Todo lo de aquí es puro (sin IO, sin React): es lo que se testea en
// `src/lib/__tests__/autoasm.test.ts`.
//
// El grafo de dependencias entre ficheros es el que manda en el orden de importación
// y en las comprobaciones:
//
//   locations ──┬─> courses ──> classes ──> rosters
//               ├─> staff   ──────┘  (instructor_id_1..12)
//               └─> students ───────────────┘  (student_id)

// ─── Especificación de los ficheros ───────────────────────────────────────────

export const ARCHIVOS_ASM = ['locations', 'students', 'staff', 'courses', 'classes', 'rosters'] as const;
export type ArchivoAsm = (typeof ARCHIVOS_ASM)[number];

export type FilaCsv = Record<string, string>;

export interface CampoAsm {
  nombre: string;
  etiqueta: string;
  obligatorio: boolean;
  ayuda: string;
  /** El campo es una referencia a la clave de otro fichero (navegación cruzada). */
  enlace?: ArchivoAsm;
}

export interface EspecArchivo {
  id: ArchivoAsm;
  fichero: string;
  titulo: string;
  /** Qué representa una fila de este fichero, en una línea. */
  descripcion: string;
  /** Campo que identifica la fila de forma única. */
  clave: string;
  campos: CampoAsm[];
}

const LOC = 'Identificador del centro; tiene que existir en locations.csv.';

export const ESPEC: Record<ArchivoAsm, EspecArchivo> = {
  locations: {
    id: 'locations',
    fichero: 'locations.csv',
    titulo: 'Centros',
    descripcion: 'Un centro (o sede). En Consolación es una sola fila y la referencian todos los demás ficheros.',
    clave: 'location_id',
    campos: [
      { nombre: 'location_id', etiqueta: 'ID de centro', obligatorio: true, ayuda: 'Identificador estable. Si cambia, ASM crea un centro nuevo y hay que reasignar todo.' },
      { nombre: 'location_name', etiqueta: 'Nombre', obligatorio: true, ayuda: 'Nombre visible en Apple School Manager.' },
    ],
  },
  students: {
    id: 'students',
    fichero: 'students.csv',
    titulo: 'Alumnado',
    descripcion: 'Un alumno o alumna. De aquí sale su Managed Apple ID y la política de contraseña.',
    clave: 'person_id',
    campos: [
      { nombre: 'person_id', etiqueta: 'ID de persona', obligatorio: true, ayuda: 'Único en TODA la organización (no puede repetirse con el de un profe). En Consolación es el NIA.' },
      { nombre: 'person_number', etiqueta: 'Nº de persona', obligatorio: false, ayuda: 'Opcional. Número interno del SIS; aquí va vacío.' },
      { nombre: 'first_name', etiqueta: 'Nombre', obligatorio: true, ayuda: 'Nombre de pila.' },
      { nombre: 'middle_name', etiqueta: 'Segundo nombre', obligatorio: false, ayuda: 'Opcional; en castellano se deja vacío (los dos apellidos van juntos en last_name).' },
      { nombre: 'last_name', etiqueta: 'Apellidos', obligatorio: true, ayuda: 'Los dos apellidos, separados por un espacio.' },
      { nombre: 'grade_level', etiqueta: 'Curso', obligatorio: true, ayuda: 'Texto libre que ASM usa para agrupar ("ESO 1A"). Conviene que no cambie de un año a otro sin motivo.' },
      { nombre: 'email_address', etiqueta: 'Correo', obligatorio: false, ayuda: 'Correo del dominio del centro: es el Managed Apple ID que se crea.' },
      { nombre: 'sis_username', etiqueta: 'Usuario SIS', obligatorio: false, ayuda: 'Nombre de usuario para iniciar sesión en dispositivos compartidos. Único.' },
      { nombre: 'password_policy', etiqueta: 'Política de contraseña', obligatorio: false, ayuda: '4 = PIN de 4 dígitos (peques) · 6 = PIN de 6 · 8 = contraseña de 8 o más caracteres.' },
      { nombre: 'location_id', etiqueta: 'Centro', obligatorio: true, ayuda: LOC, enlace: 'locations' },
    ],
  },
  staff: {
    id: 'staff',
    fichero: 'staff.csv',
    titulo: 'Profesorado',
    descripcion: 'Una persona del claustro. Se referencia desde classes.csv como instructor.',
    clave: 'person_id',
    campos: [
      { nombre: 'person_id', etiqueta: 'ID de persona', obligatorio: true, ayuda: 'Único en toda la organización. Aquí es nombre+primer apellido sin espacios (josemiguelbatalla).' },
      { nombre: 'person_number', etiqueta: 'Nº de persona', obligatorio: false, ayuda: 'Opcional; vacío.' },
      { nombre: 'first_name', etiqueta: 'Nombre', obligatorio: true, ayuda: 'Nombre de pila.' },
      { nombre: 'middle_name', etiqueta: 'Segundo nombre', obligatorio: false, ayuda: 'Opcional; vacío.' },
      { nombre: 'last_name', etiqueta: 'Apellidos', obligatorio: true, ayuda: 'Los dos apellidos.' },
      { nombre: 'email_address', etiqueta: 'Correo', obligatorio: true, ayuda: 'Correo del centro: su Managed Apple ID.' },
      { nombre: 'sis_username', etiqueta: 'Usuario SIS', obligatorio: false, ayuda: 'Opcional en el profesorado; en Consolación va vacío.' },
      { nombre: 'location_id', etiqueta: 'Centro', obligatorio: true, ayuda: LOC, enlace: 'locations' },
    ],
  },
  courses: {
    id: 'courses',
    fichero: 'courses.csv',
    titulo: 'Cursos',
    descripcion: 'La "materia contenedora": agrupa las clases. En Consolación hay un curso por grupo (ESO 1A) y algunos de nivel entero (ESO1).',
    clave: 'course_id',
    campos: [
      { nombre: 'course_id', etiqueta: 'ID de curso', obligatorio: true, ayuda: 'Identificador estable del curso.' },
      { nombre: 'course_number', etiqueta: 'Código', obligatorio: true, ayuda: 'Código corto visible (ESO1A).' },
      { nombre: 'course_name', etiqueta: 'Nombre', obligatorio: true, ayuda: 'Nombre visible del curso.' },
      { nombre: 'location_id', etiqueta: 'Centro', obligatorio: true, ayuda: LOC, enlace: 'locations' },
    ],
  },
  classes: {
    id: 'classes',
    fichero: 'classes.csv',
    titulo: 'Clases',
    descripcion: 'Una clase de verdad: la que sale en la app Aula/Tareas Escolares, con sus profes. Hasta 12 instructores.',
    clave: 'class_id',
    campos: [
      { nombre: 'class_id', etiqueta: 'ID de clase', obligatorio: true, ayuda: 'Identificador estable de la clase.' },
      { nombre: 'class_number', etiqueta: 'Nombre de la clase', obligatorio: true, ayuda: 'Lo que ve el profe: "Matemáticas", "Tutoría".' },
      { nombre: 'course_id', etiqueta: 'Curso', obligatorio: true, ayuda: 'Curso al que pertenece; tiene que existir en courses.csv.', enlace: 'courses' },
      ...Array.from({ length: 12 }, (_, i) => ({
        nombre: i === 0 ? 'instructor_id' : `instructor_id_${i + 1}`,
        etiqueta: i === 0 ? 'Profesor/a 1' : `Profesor/a ${i + 1}`,
        obligatorio: false,
        ayuda: 'person_id de staff.csv. El primero es el titular; se pueden dejar huecos en blanco.',
        enlace: 'staff' as ArchivoAsm,
      })),
      { nombre: 'location_id', etiqueta: 'Centro', obligatorio: true, ayuda: LOC, enlace: 'locations' },
    ],
  },
  rosters: {
    id: 'rosters',
    fichero: 'rosters.csv',
    titulo: 'Matrículas',
    descripcion: 'Una línea por alumno y clase: quién está en qué. Es el fichero más largo con diferencia.',
    clave: 'roster_id',
    campos: [
      { nombre: 'roster_id', etiqueta: 'ID de matrícula', obligatorio: true, ayuda: 'Identificador único de la línea (rst00001…).' },
      { nombre: 'class_id', etiqueta: 'Clase', obligatorio: true, ayuda: 'Clase en la que se matricula; tiene que existir en classes.csv.', enlace: 'classes' },
      { nombre: 'student_id', etiqueta: 'Alumno/a', obligatorio: true, ayuda: 'person_id del alumno; tiene que existir en students.csv.', enlace: 'students' },
    ],
  },
};

/** Orden en el que ASM quiere los ficheros (y en el que los pintamos). */
export const ORDEN_ARCHIVOS: ArchivoAsm[] = ['locations', 'students', 'staff', 'courses', 'classes', 'rosters'];

export function cabecerasDe(archivo: ArchivoAsm): string[] {
  return ESPEC[archivo].campos.map((c) => c.nombre);
}

/** Los 12 campos de instructor de classes.csv, en orden. */
export const CAMPOS_INSTRUCTOR = ESPEC.classes.campos.filter((c) => c.nombre.startsWith('instructor_id')).map((c) => c.nombre);

export const POLITICAS_PASSWORD = ['4', '6', '8'] as const;

// ─── CSV: leer y escribir ─────────────────────────────────────────────────────

export interface OpcionesCsv {
  /** `,` es lo que pide Apple; `;` es lo que escupe Excel en español. */
  delimitador: ',' | ';';
  /** BOM UTF-8: Excel lo necesita para no romper las tildes; ASM lo tolera. */
  bom: boolean;
  /** Fin de línea CRLF (como Excel) o LF. */
  crlf: boolean;
}

export const OPCIONES_CSV_ASM: OpcionesCsv = { delimitador: ',', bom: false, crlf: false };

/** Delimitador más probable de un texto CSV: el que más veces aparece en la cabecera. */
export function detectarDelimitador(texto: string): ',' | ';' {
  const cabecera = texto.replace(/^\ufeff/, '').split(/\r?\n/, 1)[0] ?? '';
  const puntoYComa = (cabecera.match(/;/g) ?? []).length;
  const comas = (cabecera.match(/,/g) ?? []).length;
  return puntoYComa > comas ? ';' : ',';
}

/**
 * Parser de CSV completo (comillas dobles, comillas escapadas, saltos de línea dentro
 * de un campo, CRLF y BOM). No usamos SheetJS aquí a propósito: estos ficheros son CSV
 * planos y el parser cabe en 30 líneas, sin dependencia ni sorpresas de tipos.
 */
export function parseCsv(texto: string, delimitador?: ',' | ';'): { cabeceras: string[]; filas: string[][] } {
  const d = delimitador ?? detectarDelimitador(texto);
  const limpio = texto.replace(/^\ufeff/, '');
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let enComillas = false;

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (enComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') { campo += '"'; i++; } else enComillas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') { enComillas = true; continue; }
    if (c === d) { fila.push(campo); campo = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; continue; }
    campo += c;
  }
  if (campo !== '' || fila.length > 0) { fila.push(campo); filas.push(fila); }

  const noVacias = filas.filter((f) => f.some((v) => v.trim() !== ''));
  const cabeceras = (noVacias.shift() ?? []).map((h) => h.trim());
  return { cabeceras, filas: noVacias };
}

function escapar(valor: string, d: string): string {
  return valor.includes(d) || valor.includes('"') || valor.includes('\n') || valor.includes('\r')
    ? `"${valor.replace(/"/g, '""')}"`
    : valor;
}

export function serializarCsv(cabeceras: string[], filas: FilaCsv[], opciones: OpcionesCsv = OPCIONES_CSV_ASM): string {
  const { delimitador: d, bom, crlf } = opciones;
  const eol = crlf ? '\r\n' : '\n';
  const lineas = [cabeceras.join(d)];
  for (const fila of filas) lineas.push(cabeceras.map((c) => escapar(fila[c] ?? '', d)).join(d));
  return (bom ? '\ufeff' : '') + lineas.join(eol) + eol;
}

export function serializarArchivo(archivo: ArchivoAsm, filas: FilaCsv[], opciones?: OpcionesCsv): string {
  return serializarCsv(cabecerasDe(archivo), filas, opciones);
}

export interface ResultadoLectura {
  archivo: ArchivoAsm;
  filas: FilaCsv[];
  /** Cabeceras del fichero original, tal cual venían. */
  cabecerasOriginales: string[];
  avisos: string[];
}

/** Nombre de campo normalizado para casarlo con la especificación (sin espacios ni mayúsculas). */
function normalizarCabecera(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Convierte el contenido de un CSV en filas canónicas del fichero indicado: se queda con
 * los campos de la especificación (en su orden) y avisa de lo que se ha ignorado o falta.
 *
 * Aquí se absorben las rarezas de los ficheros que salen de Excel — como la primera
 * columna vacía sin nombre que traían los `students.csv` exportados a mano.
 */
export function leerArchivo(archivo: ArchivoAsm, texto: string, delimitador?: ',' | ';'): ResultadoLectura {
  const { cabeceras, filas } = parseCsv(texto, delimitador);
  const campos = cabecerasDe(archivo);
  const avisos: string[] = [];

  const indice = new Map<string, number>();
  cabeceras.forEach((h, i) => {
    const n = normalizarCabecera(h);
    if (n && !indice.has(n)) indice.set(n, i);
  });

  const anonimas = cabeceras.filter((h) => h.trim() === '').length;
  if (anonimas > 0) avisos.push(`El fichero traía ${anonimas} columna(s) sin nombre; se descartan al generar.`);

  const faltan = campos.filter((c) => !indice.has(c));
  if (faltan.length > 0) avisos.push(`Faltaban columnas (se rellenan vacías): ${faltan.join(', ')}.`);

  const sobran = cabeceras.filter((h) => h.trim() !== '' && !campos.includes(normalizarCabecera(h)));
  if (sobran.length > 0) avisos.push(`Columnas que no son de ${ESPEC[archivo].fichero} (se ignoran): ${sobran.join(', ')}.`);

  const salida = filas.map((f) => {
    const fila: FilaCsv = {};
    for (const campo of campos) {
      const i = indice.get(campo);
      fila[campo] = i === undefined ? '' : (f[i] ?? '').trim();
    }
    return fila;
  });

  return { archivo, filas: salida, cabecerasOriginales: cabeceras, avisos };
}

/** ¿A qué fichero de ASM corresponde este nombre de archivo? */
export function archivoDeNombre(nombre: string): ArchivoAsm | null {
  const base = nombre.split('/').pop()?.toLowerCase() ?? '';
  if (base.startsWith('.') || base.startsWith('__macosx')) return null;
  return ARCHIVOS_ASM.find((a) => base === `${a}.csv` || base.endsWith(`_${a}.csv`) || base.endsWith(`-${a}.csv`)) ?? null;
}

/**
 * Identifica un CSV por sus cabeceras cuando el nombre del fichero no lo delata
 * (`export_final_v3.csv` y demás clásicos). Se queda con el fichero de ASM cuyas
 * columnas obligatorias estén todas presentes.
 */
export function archivoPorCabeceras(cabeceras: string[]): ArchivoAsm | null {
  const presentes = new Set(cabeceras.map(normalizarCabecera).filter(Boolean));
  let mejor: { archivo: ArchivoAsm; aciertos: number } | null = null;
  for (const archivo of ARCHIVOS_ASM) {
    const campos = cabecerasDe(archivo);
    const obligatorios = ESPEC[archivo].campos.filter((c) => c.obligatorio).map((c) => c.nombre);
    if (!obligatorios.every((c) => presentes.has(c))) continue;
    const aciertos = campos.filter((c) => presentes.has(c)).length;
    if (!mejor || aciertos > mejor.aciertos) mejor = { archivo, aciertos };
  }
  return mejor?.archivo ?? null;
}

// ─── Normalizadores de datos del centro ───────────────────────────────────────

/** Minúsculas sin acentos, pero conservando la ñ (así están los person_id del claustro). */
export function slugPersona(...partes: (string | null | undefined)[]): string {
  return partes
    .filter(Boolean)
    .join('')
    .normalize('NFD')
    // La ñ se recompone antes de quitar diacríticos: 'Núñez' → 'nuñez', no 'nunez'
    // (así están escritos los person_id del claustro en Apple School Manager).
    .replace(/n\u0303/gi, '\u00f1')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u00f1]/g, '');
}

/** Parte local de un correo (`paula@centro.com` → `paula`). */
export function usuarioDeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase().split('@')[0] ?? '';
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function emailValido(email: string): boolean {
  return RE_EMAIL.test(email.trim());
}

/**
 * `grade_level` tal y como está hoy en Apple School Manager, a partir del curso y la
 * letra de la BBDD central. Se respeta la forma exacta que ya usa el centro (incluido el
 * "PRIMARIA" en mayúsculas): cambiarla movería de grupo a todo el alumnado en ASM.
 */
export function gradeLevelDe(curso: string | null | undefined, letra: string | null | undefined): string {
  const c = (curso ?? '').toUpperCase().replace(/\s|º/g, '');
  const l = (letra ?? '').trim().toUpperCase();
  const pdc = c.match(/^(\d)P?PDC$/);
  if (pdc) return `ESO ${pdc[1]} PDC`;
  const eso = c.match(/^(\d)ESO$/);
  if (eso) return l === 'PDC' ? `ESO ${eso[1]} PDC` : `ESO ${eso[1]}${l}`;
  const pri = c.match(/^(\d)PRI$/);
  if (pri) return `PRIMARIA ${pri[1]}${l}`;
  const inf = c.match(/^(\d)INF$/);
  if (inf) return `Infantil ${inf[1]}${l}`;
  return [curso, letra].filter(Boolean).join(' ').trim();
}

/** ID de matrícula correlativo: rst00001, rst00002… (el formato que ya usa el centro). */
export function rosterId(n: number): string {
  return `rst${String(n).padStart(5, '0')}`;
}

// ─── Validación ───────────────────────────────────────────────────────────────

export type NivelIncidencia = 'error' | 'aviso';

export interface Incidencia {
  id: string;
  nivel: NivelIncidencia;
  /** Clase de problema, para agrupar 300 filas iguales en una línea de la revisión. */
  tipo: string;
  archivo: ArchivoAsm;
  /** Índice (0-based) de la fila afectada, si aplica. */
  fila?: number;
  campo?: string;
  /** Valor de la clave de la fila, para poder buscarla en el explorador. */
  clave?: string;
  mensaje: string;
}

export type Archivos = Record<ArchivoAsm, FilaCsv[]>;

const LIMITE_TEXTO = 255;

function anadir(lista: Incidencia[], inc: Omit<Incidencia, 'id'>): void {
  lista.push({ ...inc, id: `${inc.archivo}:${inc.fila ?? '-'}:${inc.campo ?? '-'}:${lista.length}` });
}

/**
 * Todo lo que ASM rechazaría (o importaría mal) revisado de una vez. Los `error` son
 * motivo de rechazo o de datos incorrectos en ASM; los `aviso` son cosas que conviene
 * mirar pero que importan igual (una clase sin alumnos, un profe sin clases…).
 */
export function validarProyecto(archivos: Archivos): Incidencia[] {
  const inc: Incidencia[] = [];
  const locations = new Set(archivos.locations.map((f) => f.location_id).filter(Boolean));
  const students = new Map(archivos.students.map((f) => [f.person_id, f]));
  const staff = new Map(archivos.staff.map((f) => [f.person_id, f]));
  const courses = new Set(archivos.courses.map((f) => f.course_id).filter(Boolean));
  const classes = new Map(archivos.classes.map((f) => [f.class_id, f]));

  // 1. Campos obligatorios, longitudes y centro existente (común a los seis ficheros).
  for (const archivo of ORDEN_ARCHIVOS) {
    const espec = ESPEC[archivo];
    const vistos = new Map<string, number>();
    archivos[archivo].forEach((fila, i) => {
      for (const campo of espec.campos) {
        const valor = fila[campo.nombre] ?? '';
        if (campo.obligatorio && valor.trim() === '') {
          anadir(inc, { nivel: 'error', tipo: 'obligatorio', archivo, fila: i, campo: campo.nombre, clave: fila[espec.clave], mensaje: `Falta ${campo.etiqueta.toLowerCase()} (${campo.nombre}), que es obligatorio.` });
        }
        if (valor.length > LIMITE_TEXTO) {
          anadir(inc, { nivel: 'aviso', tipo: 'longitud', archivo, fila: i, campo: campo.nombre, clave: fila[espec.clave], mensaje: `${campo.nombre} pasa de ${LIMITE_TEXTO} caracteres.` });
        }
        if (valor !== valor.trim()) {
          anadir(inc, { nivel: 'aviso', tipo: 'espacios', archivo, fila: i, campo: campo.nombre, clave: fila[espec.clave], mensaje: `${campo.nombre} tiene espacios sobrantes al principio o al final.` });
        }
      }
      const clave = fila[espec.clave] ?? '';
      if (clave) {
        const antes = vistos.get(clave);
        if (antes !== undefined) {
          anadir(inc, { nivel: 'error', tipo: 'clave-repetida', archivo, fila: i, campo: espec.clave, clave, mensaje: `${espec.clave} repetido: "${clave}" ya está en la fila ${antes + 1}.` });
        } else vistos.set(clave, i);
      }
      const loc = fila.location_id;
      if (loc !== undefined && archivo !== 'locations' && loc !== '' && !locations.has(loc)) {
        anadir(inc, { nivel: 'error', tipo: 'centro-inexistente', archivo, fila: i, campo: 'location_id', clave, mensaje: `El centro "${loc}" no está en locations.csv.` });
      }
    });
  }

  // 2. person_id único entre alumnado y profesorado (ASM los mete en el mismo saco).
  for (const [id] of students) {
    if (staff.has(id)) {
      const fila = archivos.students.findIndex((f) => f.person_id === id);
      anadir(inc, { nivel: 'error', tipo: 'person-id-compartido', archivo: 'students', fila, campo: 'person_id', clave: id, mensaje: `El person_id "${id}" está también en staff.csv; en ASM tiene que ser único en toda la organización.` });
    }
  }

  // 3. Correos y usuarios: formato y unicidad global.
  const correos = new Map<string, string>();
  const usuarios = new Map<string, string>();
  for (const archivo of ['students', 'staff'] as const) {
    archivos[archivo].forEach((fila, i) => {
      const clave = fila.person_id;
      const email = (fila.email_address ?? '').trim();
      if (email) {
        if (!emailValido(email)) {
          anadir(inc, { nivel: 'error', tipo: 'email-invalido', archivo, fila: i, campo: 'email_address', clave, mensaje: `"${email}" no parece un correo válido.` });
        }
        const bajo = email.toLowerCase();
        const dueno = correos.get(bajo);
        if (dueno) anadir(inc, { nivel: 'error', tipo: 'email-duplicado', archivo, fila: i, campo: 'email_address', clave, mensaje: `El correo ${email} ya lo usa ${dueno}: en ASM un Managed Apple ID es de una sola persona.` });
        else correos.set(bajo, clave);
        if (email !== bajo) {
          anadir(inc, { nivel: 'aviso', tipo: 'email-mayusculas', archivo, fila: i, campo: 'email_address', clave, mensaje: 'El correo lleva mayúsculas; ASM lo pasa a minúsculas al importar.' });
        }
      } else if (archivo === 'staff') {
        anadir(inc, { nivel: 'error', tipo: 'staff-sin-email', archivo, fila: i, campo: 'email_address', clave, mensaje: 'El profesorado necesita correo para tener Managed Apple ID.' });
      } else {
        anadir(inc, { nivel: 'aviso', tipo: 'alumno-sin-email', archivo, fila: i, campo: 'email_address', clave, mensaje: 'Sin correo no se le crea Managed Apple ID.' });
      }

      const usuario = (fila.sis_username ?? '').trim();
      if (usuario) {
        const bajo = usuario.toLowerCase();
        const dueno = usuarios.get(bajo);
        if (dueno) anadir(inc, { nivel: 'error', tipo: 'usuario-duplicado', archivo, fila: i, campo: 'sis_username', clave, mensaje: `El usuario "${usuario}" ya lo usa ${dueno}; tiene que ser único.` });
        else usuarios.set(bajo, clave);
      }
    });
  }

  // 4. Política de contraseña del alumnado.
  archivos.students.forEach((fila, i) => {
    const p = (fila.password_policy ?? '').trim();
    if (p && !(POLITICAS_PASSWORD as readonly string[]).includes(p)) {
      anadir(inc, { nivel: 'error', tipo: 'password-policy', archivo: 'students', fila: i, campo: 'password_policy', clave: fila.person_id, mensaje: `Política de contraseña "${p}" no válida: solo 4, 6 u 8.` });
    }
  });

  // 5. Clases: curso existente, instructores existentes y sin repetir.
  archivos.classes.forEach((fila, i) => {
    const clave = fila.class_id;
    if (fila.course_id && !courses.has(fila.course_id)) {
      anadir(inc, { nivel: 'error', tipo: 'curso-inexistente', archivo: 'classes', fila: i, campo: 'course_id', clave, mensaje: `El curso "${fila.course_id}" no está en courses.csv.` });
    }
    const profes = CAMPOS_INSTRUCTOR.map((c) => fila[c] ?? '').filter((v) => v.trim() !== '');
    if (profes.length === 0) {
      anadir(inc, { nivel: 'aviso', tipo: 'clase-sin-profe', archivo: 'classes', fila: i, campo: 'instructor_id', clave, mensaje: 'Clase sin ningún profe asignado: en ASM no la verá nadie.' });
    }
    const repes = new Set<string>();
    for (const campo of CAMPOS_INSTRUCTOR) {
      const valor = (fila[campo] ?? '').trim();
      if (!valor) continue;
      if (!staff.has(valor)) {
        anadir(inc, { nivel: 'error', tipo: 'instructor-inexistente', archivo: 'classes', fila: i, campo, clave, mensaje: `El instructor "${valor}" no está en staff.csv.` });
      }
      if (repes.has(valor)) {
        anadir(inc, { nivel: 'aviso', tipo: 'instructor-repetido', archivo: 'classes', fila: i, campo, clave, mensaje: `El instructor "${valor}" está repetido en esta clase.` });
      }
      repes.add(valor);
    }
  });

  // 6. Matrículas: clase y alumno existentes, sin duplicados de par.
  const pares = new Map<string, number>();
  archivos.rosters.forEach((fila, i) => {
    const clave = fila.roster_id;
    if (fila.class_id && !classes.has(fila.class_id)) {
      anadir(inc, { nivel: 'error', tipo: 'clase-inexistente', archivo: 'rosters', fila: i, campo: 'class_id', clave, mensaje: `La clase "${fila.class_id}" no está en classes.csv.` });
    }
    if (fila.student_id && !students.has(fila.student_id)) {
      anadir(inc, { nivel: 'error', tipo: 'alumno-inexistente', archivo: 'rosters', fila: i, campo: 'student_id', clave, mensaje: `El alumno "${fila.student_id}" no está en students.csv.` });
    }
    const par = `${fila.class_id}|${fila.student_id}`;
    const antes = pares.get(par);
    if (antes !== undefined) {
      anadir(inc, { nivel: 'error', tipo: 'matricula-duplicada', archivo: 'rosters', fila: i, campo: 'student_id', clave, mensaje: `Matrícula duplicada: ese alumno ya está en esa clase (fila ${antes + 1}).` });
    } else pares.set(par, i);
  });

  // 7. Avisos de conjunto (huérfanos que no rompen la importación pero delatan un olvido).
  const clasesConAlumnos = new Set(archivos.rosters.map((f) => f.class_id));
  archivos.classes.forEach((fila, i) => {
    if (!clasesConAlumnos.has(fila.class_id)) {
      anadir(inc, { nivel: 'aviso', tipo: 'clase-sin-alumnos', archivo: 'classes', fila: i, clave: fila.class_id, mensaje: 'Clase sin alumnado matriculado.' });
    }
  });
  const cursosConClases = new Set(archivos.classes.map((f) => f.course_id));
  archivos.courses.forEach((fila, i) => {
    if (!cursosConClases.has(fila.course_id)) {
      anadir(inc, { nivel: 'aviso', tipo: 'curso-sin-clases', archivo: 'courses', fila: i, clave: fila.course_id, mensaje: 'Curso sin ninguna clase: ASM lo importa pero no sirve de nada.' });
    }
  });
  const alumnosMatriculados = new Set(archivos.rosters.map((f) => f.student_id));
  archivos.students.forEach((fila, i) => {
    if (!alumnosMatriculados.has(fila.person_id)) {
      anadir(inc, { nivel: 'aviso', tipo: 'alumno-sin-clase', archivo: 'students', fila: i, clave: fila.person_id, mensaje: 'Alumno/a sin ninguna clase.' });
    }
  });
  const profesConClase = new Set(archivos.classes.flatMap((f) => CAMPOS_INSTRUCTOR.map((c) => f[c]).filter(Boolean)));
  archivos.staff.forEach((fila, i) => {
    if (!profesConClase.has(fila.person_id)) {
      anadir(inc, { nivel: 'aviso', tipo: 'profe-sin-clase', archivo: 'staff', fila: i, clave: fila.person_id, mensaje: 'Profe sin ninguna clase asignada.' });
    }
  });
  if (archivos.locations.length === 0) {
    anadir(inc, { nivel: 'error', tipo: 'sin-centro', archivo: 'locations', mensaje: 'Hace falta al menos un centro en locations.csv.' });
  }

  return inc;
}

export function contarIncidencias(incidencias: Incidencia[]): { errores: number; avisos: number } {
  return {
    errores: incidencias.filter((i) => i.nivel === 'error').length,
    avisos: incidencias.filter((i) => i.nivel === 'aviso').length,
  };
}
