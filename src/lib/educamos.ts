// Helpers puros del módulo Educamos: parseo de exports (.csv/.xls/.xlsx),
// mapeo de cabeceras, cascada de matching y generación de código interno.
// Sin IO: las queries Drizzle viven en educamos-server.ts.
import * as XLSX from 'xlsx';

// ─── Normalización ────────────────────────────────────────────────────────────

/** Mayúsculas, sin acentos, espacios colapsados. Para casar cabeceras y apellidos. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Regex del código interno de alumno: AA + 3 letras + 3 letras (ej. 14PONROS). */
export const CODIGO_INTERNO_RE = /^\d{2}[A-ZÀ-Ü]{3}[A-ZÀ-Ü]{3}$/;

// ─── Tipos parseados ──────────────────────────────────────────────────────────

export interface ParsedGuardian {
  orden: number; // 1 = TUTOR1, 2 = TUTOR2
  educamosPersonaId: string | null;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  dni: string | null;
  sexo: string | null;
  email: string | null;
  emailGoogle: string | null;
  telCasa: string | null;
  telPersonal: string | null;
  movilTrabajo: string | null;
  direccion: string | null;
  cp: string | null;
  localidad: string | null;
  provincia: string | null;
  parentesco: string | null;
  recibeInformacion: boolean | null;
  guardaCustodia: boolean | null;
  extra: Record<string, string>;
}

export interface ParsedStudentRow {
  fila: number; // nº de fila del fichero (1-based, contando cabecera como 1)
  codigo: string | null;
  educamosPersonaId: string | null;
  nia: string | null;
  dni: string | null;
  matricula: string | null;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  sexo: string | null;
  fechaNacimiento: string | null; // ISO YYYY-MM-DD
  curso: string | null;
  letra: string | null;
  claseCodigo: string | null;
  tutorPersonal: string | null;
  modeloLinguistico: string | null;
  deficit: string | null;
  email: string | null;
  emailGoogle: string | null;
  movil1: string | null;
  movil2: string | null;
  telEmergencia: string | null;
  familiaId: string | null;
  extra: Record<string, string>;
  tutores: ParsedGuardian[];
}

export interface ParseResult {
  formato: 'csv' | 'xls' | 'xlsx';
  rows: ParsedStudentRow[];
  /** Cabeceras que no casaron con ningún campo tipado y fueron a `extra`. */
  cabecerasExtra: string[];
  /** Cabeceras del bloque pagadores, descartadas por completo (no van ni a extra). */
  cabecerasDescartadas: string[];
  warnings: string[];
}

// ─── Mapa de cabeceras (por nombre normalizado, nunca por posición) ───────────

// El bloque PAGADOR1-3 (IBAN, cuentas, firmas) NO se importa: ni tipado ni en extra.
const PATRONES_BLOQUEADOS = [/PAGADOR/, /IBAN/, /\bCUENTA\b/, /N[º°.]? ?CUENTA/, /FIRMA/, /ORDENANTE/];

function esCabeceraBloqueada(header: string): boolean {
  return PATRONES_BLOQUEADOS.some((re) => re.test(header));
}

type FieldMatcher = { field: string; aliases: string[] };

// Campos tipados del alumno. Los alias son cabeceras normalizadas (sin acentos, mayúsculas).
const CAMPOS_ALUMNO: FieldMatcher[] = [
  { field: 'codigo', aliases: ['ID ALUMNO', 'CODIGO', 'CODIGO INTERNO', 'N'] },
  { field: 'educamosPersonaId', aliases: ['ID PERSONA', 'IDPERSONA', 'ID PERSONA ALUMNO'] },
  { field: 'nia', aliases: ['NIA'] },
  { field: 'dni', aliases: ['DNI ALUMNO', 'DNI'] },
  { field: 'matricula', aliases: ['MATRICULA ALUMNO', 'MATRICULA'] },
  { field: 'nombre', aliases: ['NOMBRE ALUMNO', 'NOMBRE'] },
  { field: 'apellido1', aliases: ['APELLIDO1 ALUMNO', 'APELLIDO1', 'APELLIDO 1', 'PRIMER APELLIDO'] },
  { field: 'apellido2', aliases: ['APELLIDO2 ALUMNO', 'APELLIDO2', 'APELLIDO 2', 'SEGUNDO APELLIDO'] },
  { field: 'sexo', aliases: ['SEXO', 'SEXO ALUMNO'] },
  { field: 'fechaNacimiento', aliases: ['FECHA NACIMIENTO ALUMNO', 'FECHA NACIMIENTO', 'FECHA DE NACIMIENTO'] },
  { field: 'clase', aliases: ['CLASE'] },
  { field: 'claseCodigo', aliases: ['CODIGO CLASE'] },
  { field: 'tutorPersonal', aliases: ['TUTOR PERSONAL'] },
  { field: 'modeloLinguistico', aliases: ['MODELO LINGUISTICO'] },
  { field: 'deficit', aliases: ['DEFICIT'] },
  { field: 'email', aliases: ['EMAIL ALUMNO', 'EMAIL'] },
  { field: 'emailGoogle', aliases: ['EMAILGOOGLE ALUMNO', 'EMAIL GOOGLE ALUMNO', 'EMAILGOOGLE'] },
  { field: 'movil1', aliases: ['MOVIL1', 'MOVIL 1', 'MOVIL1 ALUMNO'] },
  { field: 'movil2', aliases: ['MOVIL2', 'MOVIL 2', 'MOVIL2 ALUMNO'] },
  { field: 'telEmergencia', aliases: ['TEL EMERGENCIA', 'TELEFONO EMERGENCIA', 'TEL. EMERGENCIA'] },
  { field: 'familiaId', aliases: ['ID FAMILIA', 'IDFAMILIA'] },
];

// Campos tipados del tutor (la cabecera real lleva sufijo TUTOR1/TUTOR2, que se separa antes).
const CAMPOS_TUTOR: FieldMatcher[] = [
  { field: 'educamosPersonaId', aliases: ['IDPERSONA', 'ID PERSONA'] },
  { field: 'nombre', aliases: ['NOMBRE'] },
  { field: 'apellido1', aliases: ['APELLIDO1', 'APELLIDO 1'] },
  { field: 'apellido2', aliases: ['APELLIDO2', 'APELLIDO 2'] },
  { field: 'dni', aliases: ['DNI'] },
  { field: 'sexo', aliases: ['SEXO'] },
  { field: 'email', aliases: ['EMAIL'] },
  { field: 'emailGoogle', aliases: ['EMAILGOOGLE', 'EMAIL GOOGLE'] },
  { field: 'telCasa', aliases: ['TEL CASA', 'TELEFONO CASA', 'TEL. CASA'] },
  { field: 'telPersonal', aliases: ['TEL PERSONAL', 'MOVIL', 'MOVIL PERSONAL', 'TELEFONO PERSONAL'] },
  { field: 'movilTrabajo', aliases: ['MOVIL TRABAJO', 'TEL TRABAJO', 'TELEFONO TRABAJO'] },
  { field: 'direccion', aliases: ['DIRECCION', 'DOMICILIO'] },
  { field: 'cp', aliases: ['CP', 'CODIGO POSTAL'] },
  { field: 'localidad', aliases: ['LOCALIDAD', 'POBLACION'] },
  { field: 'provincia', aliases: ['PROVINCIA'] },
  { field: 'parentesco', aliases: ['PARENTESCO'] },
  { field: 'recibeInformacion', aliases: ['RECIBE INFORMACION'] },
  { field: 'guardaCustodia', aliases: ['GUARDA Y CUSTODIA', 'GUARDA CUSTODIA'] },
];

function buscarCampo(matchers: FieldMatcher[], headerNorm: string): string | null {
  for (const m of matchers) {
    if (m.aliases.includes(headerNorm)) return m.field;
  }
  return null;
}

/** Separa el sufijo TUTORn de una cabecera normalizada. 'TUTOR PERSONAL' no cuenta. */
function separarSufijoTutor(headerNorm: string): { base: string; orden: number } | null {
  const m = headerNorm.match(/^(.*?)\s*TUTOR\s?([12])$/);
  if (!m) return null;
  return { base: m[1].trim(), orden: Number(m[2]) };
}

// ─── Valores ──────────────────────────────────────────────────────────────────

function limpiar(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
}

/** 'DD/MM/YYYY' (o 'D/M/YY') → 'YYYY-MM-DD'. Devuelve null si no parsea. */
export function parseFechaES(valor: string | null): string | null {
  if (!valor) return null;
  const m = valor.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (!m) return null;
  const [, d, mo] = m;
  let y = m[3];
  if (y.length === 2) y = Number(y) > 30 ? `19${y}` : `20${y}`;
  const dia = Number(d), mes = Number(mo), anyo = Number(y);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return `${anyo}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function parseBooleano(valor: string | null): boolean | null {
  if (valor === null) return null;
  const v = normalizar(valor);
  if (['SI', 'S', 'TRUE', 'VERDADERO', '1', 'X'].includes(v)) return true;
  if (['NO', 'N', 'FALSE', 'FALSO', '0'].includes(v)) return false;
  return null;
}

/** 'CLASE' → { curso, letra }: '2ESOB' → 2ESO/B · '3ESOPDC' → 3ESOPDC con letra 'PDC'. */
export function parseClase(clase: string | null): { curso: string | null; letra: string | null } {
  if (!clase) return { curso: null, letra: null };
  const c = normalizar(clase).replace(/\s+/g, '');
  if (c.endsWith('PDC')) return { curso: c, letra: 'PDC' };
  const m = c.match(/^(.*\d[A-Z]*?)([A-Z])$/);
  if (m && /\d/.test(m[1])) return { curso: m[1], letra: m[2] };
  return { curso: c, letra: null };
}

// ─── Generación de código interno ─────────────────────────────────────────────

/** Quita acentos y deja solo letras A-Z (Ñ→N para el código). */
function letrasCodigo(apellido: string): string {
  return normalizar(apellido).replace(/Ñ/g, 'N').replace(/[^A-Z]/g, '');
}

/**
 * Genera el código interno AAXXXYYY: año de nacimiento en 2 cifras + 3 letras del
 * primer apellido + 3 del segundo. Null si faltan datos suficientes.
 */
export function generarCodigo(
  fechaNacimientoISO: string | null,
  apellido1: string | null,
  apellido2: string | null,
): string | null {
  if (!fechaNacimientoISO || !apellido1 || !apellido2) return null;
  const aa = fechaNacimientoISO.slice(2, 4);
  const a1 = letrasCodigo(apellido1).slice(0, 3);
  const a2 = letrasCodigo(apellido2).slice(0, 3);
  if (a1.length < 3 || a2.length < 3) return null;
  return `${aa}${a1}${a2}`;
}

// ─── Parseo del fichero ───────────────────────────────────────────────────────

export function detectarFormato(filename: string): 'csv' | 'xls' | 'xlsx' | null {
  const ext = filename.toLowerCase().split('.').pop();
  return ext === 'csv' || ext === 'xls' || ext === 'xlsx' ? ext : null;
}

/**
 * Parsea un export de Educamos (o del Sheets de David) en memoria.
 * Detección de columnas por cabecera normalizada, nunca por posición; la única
 * excepción es la columna A, que si trae valores con pinta de código interno se usa
 * como `codigo` aunque su cabecera no case con ningún alias.
 */
export function parseEducamosFile(buffer: ArrayBuffer | Buffer, filename: string): ParseResult {
  const formato = detectarFormato(filename);
  if (!formato) throw new Error(`Formato no soportado: ${filename} (se admite .csv, .xls, .xlsx)`);

  // El CSV real de Educamos es UTF-8 (con BOM); SheetJS por defecto asume cp1252 y
  // rompe los acentos, así que lo decodificamos nosotros y se lo damos como string.
  const wb =
    formato === 'csv'
      ? XLSX.read(new TextDecoder('utf-8').decode(buffer as ArrayBuffer).replace(/^﻿/, ''), { type: 'string', raw: false })
      : XLSX.read(buffer, { type: Buffer.isBuffer(buffer) ? 'buffer' : 'array', raw: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error('El fichero no tiene ninguna hoja de datos');

  // Matriz cruda con todo como texto formateado (raw:false respeta DD/MM/YYYY).
  const matriz: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  if (matriz.length < 2) throw new Error('El fichero no tiene filas de datos (solo cabecera o vacío)');

  const cabecerasOriginales = matriz[0].map((h) => String(h ?? '').replace(/^﻿/, ''));
  const warnings: string[] = [];
  const cabecerasExtra: string[] = [];
  const cabecerasDescartadas: string[] = [];

  // Plan de columnas: a qué destino va cada índice.
  type Destino =
    | { tipo: 'alumno'; field: string }
    | { tipo: 'tutor'; orden: number; field: string }
    | { tipo: 'extra-alumno'; key: string }
    | { tipo: 'extra-tutor'; orden: number; key: string }
    | { tipo: 'descartada' };

  const plan: Destino[] = cabecerasOriginales.map((original) => {
    const norm = normalizar(original);
    if (!norm) return { tipo: 'descartada' };
    if (esCabeceraBloqueada(norm)) {
      cabecerasDescartadas.push(original);
      return { tipo: 'descartada' };
    }
    const tutor = separarSufijoTutor(norm);
    if (tutor) {
      const field = buscarCampo(CAMPOS_TUTOR, tutor.base);
      if (field) return { tipo: 'tutor', orden: tutor.orden, field };
      return { tipo: 'extra-tutor', orden: tutor.orden, key: original };
    }
    const field = buscarCampo(CAMPOS_ALUMNO, norm);
    if (field) return { tipo: 'alumno', field };
    cabecerasExtra.push(original);
    return { tipo: 'extra-alumno', key: original };
  });

  // Detección del código interno en columna A: si sus valores casan con el patrón,
  // se usa como `codigo` aunque la cabecera sea otra cosa.
  const valoresColA = matriz.slice(1).map((f) => limpiar(f[0])).filter(Boolean) as string[];
  const colAEsCodigo =
    valoresColA.length > 0 &&
    valoresColA.filter((v) => CODIGO_INTERNO_RE.test(normalizar(v))).length / valoresColA.length >= 0.8;
  if (colAEsCodigo && plan[0]?.tipo !== 'descartada') {
    plan[0] = { tipo: 'alumno', field: 'codigo' };
  }

  const rows: ParsedStudentRow[] = [];

  for (let i = 1; i < matriz.length; i++) {
    const filaValores = matriz[i];
    if (filaValores.every((v) => limpiar(v) === null)) continue; // fila vacía

    const alumno: Record<string, string | null> = {};
    const extraAlumno: Record<string, string> = {};
    const tutoresCampos: Record<number, Record<string, string | null>> = {};
    const tutoresExtra: Record<number, Record<string, string>> = {};

    plan.forEach((destino, col) => {
      const valor = limpiar(filaValores[col]);
      if (valor === null || destino.tipo === 'descartada') return;
      switch (destino.tipo) {
        case 'alumno':
          alumno[destino.field] = valor;
          break;
        case 'extra-alumno':
          extraAlumno[destino.key] = valor;
          break;
        case 'tutor':
          (tutoresCampos[destino.orden] ??= {})[destino.field] = valor;
          break;
        case 'extra-tutor':
          (tutoresExtra[destino.orden] ??= {})[destino.key] = valor;
          break;
      }
    });

    const { curso, letra } = parseClase(alumno.clase ?? null);
    const fechaNacimiento = parseFechaES(alumno.fechaNacimiento ?? null);
    if (alumno.fechaNacimiento && !fechaNacimiento) {
      warnings.push(`Fila ${i + 1}: fecha de nacimiento no reconocida ("${alumno.fechaNacimiento}")`);
    }

    let codigo = alumno.codigo ? normalizar(alumno.codigo) : null;
    if (codigo && !CODIGO_INTERNO_RE.test(codigo)) {
      warnings.push(`Fila ${i + 1}: valor de código interno descartado ("${alumno.codigo}")`);
      codigo = null;
    }

    const tutores: ParsedGuardian[] = [];
    for (const orden of [1, 2]) {
      const c = tutoresCampos[orden] ?? {};
      const ex = tutoresExtra[orden] ?? {};
      const tieneAlgo = Object.keys(c).length > 0 || Object.keys(ex).length > 0;
      if (!tieneAlgo) continue;
      tutores.push({
        orden,
        educamosPersonaId: c.educamosPersonaId ?? null,
        nombre: c.nombre ?? null,
        apellido1: c.apellido1 ?? null,
        apellido2: c.apellido2 ?? null,
        dni: c.dni ?? null,
        sexo: c.sexo ?? null,
        email: c.email ?? null,
        emailGoogle: c.emailGoogle ?? null,
        telCasa: c.telCasa ?? null,
        telPersonal: c.telPersonal ?? null,
        movilTrabajo: c.movilTrabajo ?? null,
        direccion: c.direccion ?? null,
        cp: c.cp ?? null,
        localidad: c.localidad ?? null,
        provincia: c.provincia ?? null,
        parentesco: c.parentesco ?? null,
        recibeInformacion: parseBooleano(c.recibeInformacion ?? null),
        guardaCustodia: parseBooleano(c.guardaCustodia ?? null),
        extra: ex,
      });
    }

    rows.push({
      fila: i + 1,
      codigo,
      educamosPersonaId: alumno.educamosPersonaId ?? null,
      nia: alumno.nia ?? null,
      dni: alumno.dni ?? null,
      matricula: alumno.matricula ?? null,
      nombre: alumno.nombre ?? null,
      apellido1: alumno.apellido1 ?? null,
      apellido2: alumno.apellido2 ?? null,
      sexo: alumno.sexo ?? null,
      fechaNacimiento,
      curso,
      letra,
      claseCodigo: alumno.claseCodigo ?? null,
      tutorPersonal: alumno.tutorPersonal ?? null,
      modeloLinguistico: alumno.modeloLinguistico ?? null,
      deficit: alumno.deficit ?? null,
      email: alumno.email ?? null,
      emailGoogle: alumno.emailGoogle ?? null,
      movil1: alumno.movil1 ?? null,
      movil2: alumno.movil2 ?? null,
      telEmergencia: alumno.telEmergencia ?? null,
      familiaId: alumno.familiaId ?? null,
      extra: extraAlumno,
      tutores,
    });
  }

  return { formato, rows, cabecerasExtra, cabecerasDescartadas, warnings };
}

// ─── Cascada de matching ──────────────────────────────────────────────────────

/** Subconjunto de edu_students que necesita el matching (lo carga educamos-server). */
export interface MatchTarget {
  id: string;
  codigo: string | null;
  educamosPersonaId: string | null;
  nia: string | null;
  dni: string | null;
  apellido1: string | null;
  apellido2: string | null;
  fechaNacimiento: string | null; // ISO
}

export type MatchVia = 'codigo' | 'educamos_persona_id' | 'nia' | 'dni' | 'apellidos+fecha';

export interface MatchResult {
  target: MatchTarget | null;
  via: MatchVia | null;
}

/**
 * Cascada de matching (primera que case gana):
 * codigo → GUID Educamos → NIA → DNI → apellido1+apellido2+fecha (match exacto).
 */
export function matchStudent(row: ParsedStudentRow, existentes: MatchTarget[]): MatchResult {
  const porCodigo = new Map<string, MatchTarget>();
  const porGuid = new Map<string, MatchTarget>();
  const porNia = new Map<string, MatchTarget>();
  const porDni = new Map<string, MatchTarget>();
  const porApellidosFecha = new Map<string, MatchTarget[]>();
  for (const e of existentes) {
    if (e.codigo) porCodigo.set(normalizar(e.codigo), e);
    if (e.educamosPersonaId) porGuid.set(e.educamosPersonaId.toLowerCase(), e);
    if (e.nia) porNia.set(e.nia.trim(), e);
    if (e.dni) porDni.set(normalizar(e.dni), e);
    if (e.apellido1 && e.apellido2 && e.fechaNacimiento) {
      const key = `${normalizar(e.apellido1)}|${normalizar(e.apellido2)}|${e.fechaNacimiento}`;
      (porApellidosFecha.get(key) ?? porApellidosFecha.set(key, []).get(key)!).push(e);
    }
  }

  if (row.codigo) {
    const t = porCodigo.get(normalizar(row.codigo));
    if (t) return { target: t, via: 'codigo' };
  }
  if (row.educamosPersonaId) {
    const t = porGuid.get(row.educamosPersonaId.toLowerCase());
    if (t) return { target: t, via: 'educamos_persona_id' };
  }
  if (row.nia) {
    const t = porNia.get(row.nia.trim());
    if (t) return { target: t, via: 'nia' };
  }
  if (row.dni) {
    const t = porDni.get(normalizar(row.dni));
    if (t) return { target: t, via: 'dni' };
  }
  if (row.apellido1 && row.apellido2 && row.fechaNacimiento) {
    const key = `${normalizar(row.apellido1)}|${normalizar(row.apellido2)}|${row.fechaNacimiento}`;
    const candidatos = porApellidosFecha.get(key);
    if (candidatos?.length === 1) return { target: candidatos[0], via: 'apellidos+fecha' };
  }
  return { target: null, via: null };
}

/**
 * Para altas sin código: genera uno y detecta colisiones contra los ya existentes
 * y contra los generados en la misma tanda. Colisión → `codigo: null` + flag de
 * revisión manual (no se inventa sufijo en silencio).
 */
export function asignarCodigoAlta(
  row: ParsedStudentRow,
  codigosOcupados: Set<string>,
): { codigo: string | null; colision: boolean } {
  const generado = generarCodigo(row.fechaNacimiento, row.apellido1, row.apellido2);
  if (!generado) return { codigo: null, colision: false };
  if (codigosOcupados.has(generado)) return { codigo: null, colision: true };
  codigosOcupados.add(generado);
  return { codigo: generado, colision: false };
}
