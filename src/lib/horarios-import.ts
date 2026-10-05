// Adaptador de importación de horarios (helpers puros, sin IO). Ficha: docs/07-horarios.md
//
// ─── Qué formato se importa y por qué ────────────────────────────────────────
//
// El colegio tiene hoy CUATRO ficheros de horarios y no dicen lo mismo:
//
//   1. "Horario general del colegio" (.xlsx)  — una matriz profe × franja de TODO el
//      centro, pero la celda solo trae el GRUPO ('2PRIA'): ni materia ni aula. A cambio,
//      sus tres primeras filas son LAS TRES REJILLAS reales (infantil, primaria, ESO) con
//      sus horas día a día. Se usa para eso —sembrar rejillas— y como red de seguridad
//      para comprobar cobertura, no como fuente de los horarios.
//   2. "Horarios Primaria Sept/Junio" (.xlsx) — export de Educamos "HORARIO DE CLASE" y
//      "HORARIO DE PROFESOR", una hoja por clase y por profe. Celda 'MATERIA - PROFE'.
//      Es el periodo corto de septiembre/junio (4 sesiones + recreo).
//   3. "Horarios Inf. y Prim." (.docx)        — el MISMO export de Educamos, pero del
//      periodo ordinario y **con aula**: 'EFI1 - SDOM0 - Poli2'. Es el más completo.
//   4. El mismo, en .pdf                      — para imprimir. No se parsea.
//
// **El adaptador apunta al bloque "HORARIO DE CLASE" de Educamos** (2 y 3), porque es el
// único formato que trae materia, profe y aula, y porque su estructura lógica es IDÉNTICA
// en .xlsx y en .docx: un título, una fila de días, filas 'De HH:MM a HH:MM' y, al final,
// las leyendas. Por eso este fichero no lee ficheros: recibe una **cuadrícula de texto**
// (`string[][]`) que produce quien sepa abrir cada formato (SheetJS para xlsx, extracción
// de tablas para docx) y la normaliza. Un formato nuevo = un lector nuevo, no un
// importador nuevo.
//
// ─── La leyenda es la que desambigua ─────────────────────────────────────────
//
// Una celda es 'MATERIA - PROFE' o 'MATERIA - PROFE - AULA', y por regex no hay forma
// honesta de saber si 'POLI' es un profe o un aula. Pero cada bloque trae al final sus
// propias leyendas ('Profesores:', 'Aulas:', 'Materias:'), así que se resuelve MIRÁNDOLAS,
// no adivinando. Lo que no esté en ninguna leyenda se reporta como incidencia en vez de
// colarse mal.

import { compararClases, parseBachillerato } from '@/lib/cursos';
import { type TipoTramo } from '@/lib/horarios';

/** Una celda ya interpretada: lo que se convertirá en asignación + sesión. */
export interface SesionImportada {
  dia: number; // 1 = lunes … 5 = viernes
  orden: number; // posición del tramo dentro del día (incluye recreos y comedor)
  horaInicio: string;
  horaFin: string;
  tipoTramo: TipoTramo;
  /** Grupos a los que va. En un horario de clase es siempre el del título del bloque. */
  grupos: { curso: string; letra: string | null }[];
  materiaCodigo: string | null;
  profeCodigos: string[];
  aulaCodigo: string | null;
  actividadCodigo: string; // 'clase' | 'apoyo_pt' | 'apoyo_al'
  /**
   * A qué se dedica esa hora concreta dentro de la materia. Hoy solo lo usan los **ámbitos
   * de PDC** (la materia oficial es 'Ámbito Científico' y cada hora va a Matemáticas, a
   * Biología o a Física y Química) y el auxiliar de conversación en inglés. Ver
   * `NOMBRES_DETALLE`.
   */
  detalle: string | null;
  /** El texto original de la celda. Se guarda siempre: es lo que se enseña al revisar. */
  crudo: string;
}

/** Lo que sale de UNA celda: puede haber más de una cosa a la misma hora. */
export type CeldaSesion = Pick<
  SesionImportada,
  'materiaCodigo' | 'profeCodigos' | 'aulaCodigo' | 'actividadCodigo' | 'detalle' | 'crudo'
>;

export interface Leyendas {
  materias: Map<string, string>;
  profes: Map<string, string>;
  aulas: Map<string, string>;
}

export interface Incidencia {
  tipo:
    | 'codigo_desconocido'
    | 'celda_ilegible'
    | 'sin_tramos'
    | 'grupo_ilegible'
    | 'dato_personal'
    /** Algo escrito a mano en la hoja de un profe que no se sabe qué es: entra como 'otros'. */
    | 'actividad_desconocida'
    /** La hoja de un profe cuyo nombre no casa con nadie: sus horas no se importan. */
    | 'profe_desconocido'
    /** Una clase que el profe se apunta en su hoja y que no está en la hoja de la clase. */
    | 'solo_en_hoja_profe';
  detalle: string;
  crudo?: string;
  /** El código que seguramente quería decir ('ING' para 'NG'), si hay uno y solo uno. */
  sugerencia?: string;
}

export interface TramoImportado {
  orden: number;
  horaInicio: string;
  horaFin: string;
  tipo: TipoTramo;
}

export interface ResultadoBloque {
  clase: { codigo: string; curso: string; letra: string | null; nombre: string } | null;
  /** Las filas de horas del bloque, recreos y comedor incluidos: ES la rejilla de la clase. */
  tramos: TramoImportado[];
  sesiones: SesionImportada[];
  leyendas: Leyendas;
  incidencias: Incidencia[];
  /** Texto suelto que no encaja en la cuadrícula ("Taller …: lunes 16:15, 1 sesión mensual"). */
  notas: string[];
}

const DIAS_CABECERA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/** 'De 09:00 a 09:45' → { horaInicio: '09:00', horaFin: '09:45' }. */
export function parsearRangoHoras(texto: string): { horaInicio: string; horaFin: string } | null {
  const m = /(\d{1,2})[:.](\d{2})\s*(?:a|-|–|hasta)\s*(\d{1,2})[:.](\d{2})/i.exec(texto ?? '');
  if (!m) return null;
  const dos = (n: string) => n.padStart(2, '0');
  return { horaInicio: `${dos(m[1])}:${m[2]}`, horaFin: `${dos(m[3])}:${m[4]}` };
}

/**
 * '2PRIA' → curso '2PRI', letra 'A' · '3INFB' → '3INF' + 'B' · '1ESOA' → '1ESO' + 'A'.
 * Los códigos del centro son <nivel><etapa><letra>, con la letra opcional.
 *
 * **PDC**: el fichero de la ESO los titula `3º PPDC` (con `º` y con espacio, que ningún
 * otro código lleva). Se traducen a `3ESO` + letra `PDC`, que es como los tiene el resto
 * del repo desde `cursoBaseEso()` — Licencias ya se llevó el susto de dar de baja a los
 * PDC en bloque por no hacer esta traducción.
 */
export function parsearCodigoGrupo(codigo: string): { curso: string; letra: string | null } | null {
  const c = (codigo ?? '').trim().toUpperCase().replace(/\s+/g, '');
  const pdc = /^(\d+)[ºO]?P?PDC$/.exec(c);
  if (pdc) return { curso: `${pdc[1]}ESO`, letra: 'PDC' };
  const bach = parseBachillerato(c.replace(/^(\d)O(?=B)/, '$1'));
  if (bach) return bach;
  const m = /^(\d+\s*[ºO]?\s*(?:INF|PRI|ESO|CFGM|CFGS))\s*([A-Z])?$/.exec(c);
  if (!m) return null;
  return { curso: m[1].replace(/[ºO](?=[A-Z])/, ''), letra: m[2] ?? null };
}

/**
 * '1PRIA: 1º EP-A' → el código, el grupo y el nombre bonito.
 *
 * El código admite `º` y espacios porque los bloques de PDC se titulan `3º PPDC: 3º ESO-PDC`
 * y con la clase de caracteres estricta se caían del import enteros (dos clases de menos,
 * sin ningún aviso: el bloque simplemente no tenía título y se descartaba).
 */
export function parsearTituloClase(
  texto: string,
): { codigo: string; curso: string; letra: string | null; nombre: string } | null {
  const m = /^\s*([0-9A-ZÑº°\s]{3,12}?)\s*:\s*(.+?)\s*$/i.exec(texto ?? '');
  if (!m) return null;
  const grupo = parsearCodigoGrupo(m[1]);
  if (!grupo) return null;
  return { codigo: m[1].toUpperCase().replace(/\s+/g, ' '), curso: grupo.curso, letra: grupo.letra, nombre: m[2] };
}

/**
 * Las leyendas del pie del bloque: 'MVER0: MARÍA VICTORIA VERNIA JULIÁN'.
 * Llegan como una lista de líneas ya aplanadas, con los encabezados incluidos.
 */
export function parsearLeyendas(lineas: readonly string[]): Leyendas {
  const leyendas: Leyendas = { materias: new Map(), profes: new Map(), aulas: new Map() };
  let actual: keyof Leyendas | null = null;
  for (const linea of lineas) {
    const t = (linea ?? '').trim();
    if (!t) continue;
    const cabecera = norm(t).replace(/:$/, '');
    if (cabecera === 'materias') { actual = 'materias'; continue; }
    if (cabecera === 'profesores' || cabecera === 'profesorado') { actual = 'profes'; continue; }
    if (cabecera === 'aulas' || cabecera === 'espacios') { actual = 'aulas'; continue; }
    if (!actual) continue;
    const m = /^([^:]{1,20}):\s*(.+)$/.exec(t);
    if (!m) continue;
    // En el horario de PROFESOR la materia lleva el grupo pegado ('LCO5: Valencià … - 5PRIA').
    const valor = actual === 'materias' ? m[2].replace(/\s*-\s*[0-9A-ZÑ]{3,8}\s*$/i, '').trim() : m[2].trim();
    leyendas[actual].set(m[1].trim().toUpperCase(), valor);
  }
  return leyendas;
}

/**
 * Raíz del código de una materia: `EFI1`, `EFI3` y `EFI5` son **la misma** Educación Física
 * en tres cursos. El número final es el curso, no parte de la identidad.
 *
 * OJO: se quitan solo los dígitos del FINAL. `LCO3` (Valencià) y `LC03` (Lectura, con un
 * cero) conviven en el fichero real y son materias distintas; recortar por otro sitio las
 * fusionaría y sería un error de verdad.
 */
export function raizMateria(codigo: string): string {
  return (codigo ?? '').trim().toUpperCase().replace(/\d+$/, '') || (codigo ?? '').trim().toUpperCase();
}

/** Nombre normalizado para comparar ('Educació Física' ≠ 'Educación Física', pero 'English' = 'ENGLISH'). */
export function normalizarNombreMateria(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const RE_RECREO = /^(recreo|patio|esbarjo)$/i;
const RE_COMEDOR = /^(comedor|menjador)$/i;

/**
 * Nombres del **detalle de una hora**: lo que la celda dice ADEMÁS de la materia, en una
 * segunda línea con un solo código.
 *
 * El caso gordo son los **ámbitos de PDC** y qué asignatura de verdad se da en cada hora.
 *
 * En Diversificación las asignaturas oficiales no son las de siempre: son *ámbitos*, y cada
 * uno junta varias materias que se reparten las horas de la semana.
 *
 *   Ámbito Científico (`ACT` en 3º, `AC` en 4º) → Matemáticas, Biología y Geología, Física y Química
 *   Ámbito Lingüístico y social (`ALS`, `AL2`) → Lengua Castellana, Valencià, Geografía e Historia
 *   Ámbito Práctico (`APR1`, `AP`)             → Tecnología, Digitalización, Plástica (antes FOL)
 *
 * Por eso una celda de PDC viene en dos líneas: `'ACT - MPER0'` y debajo `'MATE'`. La
 * primera es la materia oficial y su profe; la segunda dice **a qué se dedica esa hora**.
 * Sin esto el importador leía dos clases simultáneas donde solo hay una.
 *
 * El mapa es solo para PONERLE NOMBRE al código (`MATE` → 'Matemáticas'): un código que no
 * esté aquí se guarda tal cual, así que si un año cambia el reparto del ámbito práctico
 * —que es el que se mueve— sigue entrando, solo que con su abreviatura. Nada depende de
 * que esta tabla esté completa.
 */
export const NOMBRES_DETALLE: Record<string, string> = {
  AUX: 'Con auxiliar de conversación',
  MATE: 'Matemáticas', MAT: 'Matemáticas',
  BG: 'Biología y Geología', BIO: 'Biología y Geología',
  FQ: 'Física y Química', FYQ: 'Física y Química', FIS: 'Física y Química',
  LEN: 'Lengua Castellana', CAS: 'Lengua Castellana',
  VAL: 'Valencià', LCO: 'Valencià',
  GEH: 'Geografía e Historia', GH: 'Geografía e Historia',
  TECNO: 'Tecnología', TEC: 'Tecnología', TYD: 'Tecnología',
  DIG: 'Digitalización',
  EPV: 'Plástica y Visual', PLA: 'Plástica y Visual', EX: 'Plástica y Visual',
  FOL: 'Formación y Orientación Laboral', FOP: 'Formación y Orientación Laboral',
};

/**
 * El código de profe de la leyenda que corresponde a este texto, o `null`.
 *
 * Acepta que le falte el dígito del final: el fichero real trae `'ACT - MPAR'` cuando en su
 * propia leyenda el profe es `MPAR0`. Solo se rescata si **hay un único candidato**; si
 * conviven `MPAR0` y `MPAR1` no se elige a ninguno, que eso ya sería adivinar quién da la
 * clase.
 */
function esProfeConocido(texto: string, leyendas: Leyendas): string | null {
  const cod = (texto ?? '').trim().toUpperCase();
  if (leyendas.profes.has(cod)) return cod;
  if (!/^[A-ZÑ]{2,}$/.test(cod)) return null;
  const candidatos = [...leyendas.profes.keys()].filter((k) => k.replace(/\d+$/, '') === cod);
  return candidatos.length === 1 ? candidatos[0] : null;
}

/** Distancia de edición (con trasposición de dos letras seguidas, que es la errata típica). */
function distancia(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + coste);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/**
 * El código de la leyenda que seguramente quería decir uno que no está: `NG` → `ING`.
 *
 * Una sola letra de diferencia (de más, de menos, cambiada o dos traspuestas) y **un único
 * candidato**. Es una SUGERENCIA para quien revisa, no una corrección: con dos candidatos a
 * la misma distancia no se dice nada, que ahí ya sería adivinar. Los códigos de una sola
 * letra no se sugieren nunca: todo está a una letra de distancia de ellos.
 */
export function sugerirCodigo(codigo: string, candidatos: Iterable<string>): string | null {
  const c = (codigo ?? '').trim().toUpperCase();
  if (c.length < 2) return null;
  const cerca = [...new Set([...candidatos].map((k) => k.toUpperCase()))].filter((k) => k !== c && distancia(c, k) === 1);
  return cerca.length === 1 ? cerca[0] : null;
}

/** ¿Esta línea es basura de maquetación? Un número suelto, un guion, un punto. */
function esRuido(linea: string): boolean {
  return /^[\d\s.,;:_·\-–]+$/.test(linea);
}

/**
 * Interpreta una celda del horario de una CLASE.
 *
 * Formas reales vistas en los ficheros del colegio:
 *   'LEN1 - MVER0'              materia + profe
 *   'EFI1 - SDOM0 - Poli2'      materia + profe + aula
 *   'MAT1 - RMOG0\nMVER0'       DOS profes en la misma hora (salto de línea)
 *   'Recreo' / 'Comedor'        el tramo no es de clase
 *   'PT- MAPI' · 'AL 5º y 6º'   apoyo de PT/AL, en texto libre (ver nota abajo)
 *
 * `leyendas` es la del propio bloque y es lo que decide si un código suelto es profe o
 * aula. Sin leyenda no se inventa: se devuelve como incidencia.
 */
/**
 * Interpreta una celda del horario de una CLASE. Devuelve una LISTA porque una misma hora
 * puede llevar varias cosas.
 *
 * Formas reales vistas en los ficheros del colegio:
 *   'LEN1 - MVER0'                materia + profe
 *   'EFI1 - SDOM0 - Poli2'        materia + profe + aula
 *   'MAT1 - RMOG0\nMVER0'         DOS profes en la misma hora (la 2ª línea continúa)
 *   'MAT1 - MVER0\nPT- MAPI'      una clase Y un apoyo a la vez → DOS sesiones
 *   'Recreo' / 'Comedor'          el tramo no es de clase
 *   'PT- MAPI' · 'AL 5º y 6º'     apoyo de PT/AL, en texto libre
 *
 * `leyendas` es la del propio bloque y es lo que decide si un código suelto es profe o
 * aula. Sin leyenda no se inventa: se devuelve como incidencia.
 */
export function parsearCeldaClase(
  crudo: string,
  leyendas: Leyendas,
): { sesiones: CeldaSesion[]; incidencias: Incidencia[] } {
  const texto = (crudo ?? '').trim();
  const incidencias: Incidencia[] = [];
  if (!texto) return { sesiones: [], incidencias };
  if (RE_RECREO.test(texto) || RE_COMEDOR.test(texto)) return { sesiones: [], incidencias };

  const sesiones: CeldaSesion[] = [];
  const lineas = texto.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);

  for (const linea of lineas) {
    // Una línea que es solo un número o un guion es basura de maquetación del .docx (el
    // fichero de la ESO trae un '0' suelto encima de una celda). Ni se importa ni se pierde:
    // el crudo de la celda entera sigue guardado.
    if (esRuido(linea)) {
      incidencias.push({
        tipo: 'celda_ilegible',
        detalle: `Un '${linea}' suelto en la celda (maquetación del Word): se ignora y el resto de la celda entra normal`,
        crudo: linea,
      });
      continue;
    }

    const apoyo = /^(PT|AL)\b[\s.\-–]*(.*)$/i.exec(linea);
    if (apoyo) {
      const resto = apoyo[2].trim();
      const codigoProfe = resto.toUpperCase();
      const esProfe = leyendas.profes.has(codigoProfe);
      // Estas celdas son texto libre y sucio ('PT. 1ºB', 'AL 4 AÑOS B', 'AL Aitana'). Se
      // reconoce la ACTIVIDAD y se conserva el crudo, pero no se saca de ahí ni el grupo
      // ni el alumno: a quién afecta un apoyo se mete a mano (`hor_apoyos`).
      if (resto && !esProfe && /[a-záéíóúñ]/.test(resto) && resto.split(/\s+/).length <= 2 && !/^\d/.test(resto)) {
        incidencias.push({
          tipo: 'dato_personal',
          detalle: 'La celda de apoyo parece llevar el nombre de un alumno; no se importa como dato, solo como texto de la sesión',
          crudo: linea,
        });
      }
      sesiones.push({
        materiaCodigo: null,
        profeCodigos: esProfe ? [codigoProfe] : [],
        aulaCodigo: null,
        actividadCodigo: apoyo[1].toUpperCase() === 'PT' ? 'apoyo_pt' : 'apoyo_al',
        detalle: null,
        crudo: linea,
      });
      continue;
    }

    const partes = linea.split(/\s*[-–]\s*/).map((p) => p.trim()).filter(Boolean);
    if (partes.length === 0) continue;
    const primera = partes[0].toUpperCase();

    const ultima = sesiones[sesiones.length - 1] as CeldaSesion | undefined;

    // Una línea que es SOLO códigos de profe o aula continúa la entrada anterior: es el
    // segundo profe que entra a la misma hora ('MAT1 - RMOG0' + salto + 'MVER0').
    if (ultima && partes.every((p) => esProfeConocido(p, leyendas) || leyendas.aulas.has(p.toUpperCase()))) {
      for (const p of partes) {
        const cod = esProfeConocido(p, leyendas);
        if (cod) ultima.profeCodigos.push(cod);
        else ultima.aulaCodigo = p.toUpperCase();
      }
      ultima.crudo = `${ultima.crudo}\n${linea}`;
      continue;
    }

    // Una línea de UN solo código que no es materia, ni profe, ni aula: es **el detalle de
    // esa hora**, no otra clase. Así vienen los ámbitos de PDC ('ACT - MPER0' + salto +
    // 'MATE') y el auxiliar de conversación ('ING2 - EMIR0' + salto + 'AUX'), y leerlo como
    // una entrada nueva metía una clase fantasma en el hueco. Ver `NOMBRES_DETALLE`.
    //
    // Se cuelga de la última entrada CON MATERIA, no de la anterior sin más: en
    // 'ING6 - CRAL0' + 'AL' + 'AUX' el auxiliar es de la clase de inglés, no del apoyo de AL
    // que se ha colado entre medias.
    //
    // Vale también cuando el código suelto SÍ es una materia de la leyenda: en 4º PDC la
    // celda 'AP - NSAB0' + 'DIG' es una hora del Ámbito Práctico dedicada a Digitalización
    // (que en 4º A y B es una materia de verdad, y por eso está en la leyenda común). Una
    // materia sin profe colgando de otra no es una clase aparte: es la hora de esa otra.
    const conMateria = [...sesiones].reverse().find((x) => x.materiaCodigo && !x.detalle);
    if (conMateria && partes.length === 1) {
      conMateria.detalle = NOMBRES_DETALLE[primera] ?? leyendas.materias.get(primera) ?? partes[0];
      conMateria.crudo = `${conMateria.crudo}\n${linea}`;
      continue;
    }

    if (!leyendas.materias.has(primera)) {
      const sugerencia = sugerirCodigo(primera, leyendas.materias.keys());
      incidencias.push({
        tipo: 'codigo_desconocido',
        detalle: sugerencia
          ? `Materia '${partes[0]}' no está en la leyenda. ¿Quizá '${sugerencia}' (${leyendas.materias.get(sugerencia)})?`
          : `Materia '${partes[0]}' no está en la leyenda del bloque`,
        crudo: linea,
        ...(sugerencia ? { sugerencia } : {}),
      });
    }
    const sesion: CeldaSesion = {
      materiaCodigo: primera,
      profeCodigos: [],
      aulaCodigo: null,
      actividadCodigo: 'clase',
      detalle: null,
      crudo: linea,
    };
    for (const p of partes.slice(1)) {
      const cod = esProfeConocido(p, leyendas);
      if (cod) sesion.profeCodigos.push(cod);
      else if (leyendas.aulas.has(p.toUpperCase())) sesion.aulaCodigo = p.toUpperCase();
      else {
        const sugerencia = sugerirCodigo(p, [...leyendas.profes.keys(), ...leyendas.aulas.keys()]);
        incidencias.push({
          tipo: 'codigo_desconocido',
          detalle: sugerencia
            ? `'${p}' no está ni en profesores ni en aulas de la leyenda. ¿Quizá '${sugerencia}'?`
            : `'${p}' no está ni en profesores ni en aulas de la leyenda`,
          crudo: linea,
          ...(sugerencia ? { sugerencia } : {}),
        });
      }
    }
    sesiones.push(sesion);
  }

  return { sesiones, incidencias };
}

/** Celda del horario de un PROFESOR: 'LCO5: 5PRIA' → materia + grupo. */
export function parsearCeldaProfe(
  crudo: string,
): { materiaCodigo: string; curso: string; letra: string | null } | null {
  const texto = (crudo ?? '').trim();
  if (!texto || RE_RECREO.test(texto) || RE_COMEDOR.test(texto)) return null;
  const m = /^([0-9A-ZÑ]{2,8})\s*[:\-–]\s*([0-9A-ZÑ]{3,10})$/i.exec(texto);
  if (!m) return null;
  const grupo = parsearCodigoGrupo(m[2]);
  if (!grupo) return null;
  return { materiaCodigo: m[1].toUpperCase(), curso: grupo.curso, letra: grupo.letra };
}

/** Qué clase de tramo es, mirando la fila entera (si todo el día pone 'Recreo', es recreo). */
function tipoDeFila(celdas: readonly string[]): TipoTramo {
  const conTexto = celdas.map((c) => (c ?? '').trim()).filter(Boolean);
  if (conTexto.length && conTexto.every((c) => RE_RECREO.test(c))) return 'recreo';
  if (conTexto.length && conTexto.every((c) => RE_COMEDOR.test(c))) return 'comedor';
  return 'sesion';
}

/** Fila de días: la que más nombres de día contiene, y en qué columna cae cada uno. */
function localizarFilaDias(limpias: readonly (readonly string[])[]): { filaDias: number; columnaDia: number[] } {
  let filaDias = -1;
  let columnaDia: number[] = [];
  limpias.forEach((f, i) => {
    const cols = DIAS_CABECERA.map((d) => f.findIndex((c) => norm(c) === d));
    const encontrados = cols.filter((c) => c >= 0).length;
    if (encontrados > columnaDia.filter((c) => c >= 0).length) { filaDias = i; columnaDia = cols; }
  });
  return { filaDias, columnaDia };
}

/**
 * Junta las leyendas de varios bloques en una sola.
 *
 * Hace falta porque los bloques de PDC del fichero real de la ESO traen la cuadrícula pero
 * **no** todas sus materias en la leyenda (`MATE`, `BG`, `FQ`, `TECNO`…, que son las horas
 * que hacen con su grupo de referencia). Sin esto, esas celdas se quedaban en el texto
 * crudo: ni nombre de materia, ni color junto a las mismas Matemáticas del grupo de al
 * lado. El mismo código en el mismo fichero es la misma materia; la leyenda del propio
 * bloque sigue mandando cuando existe.
 */
export function unirLeyendas(todas: readonly Leyendas[]): Leyendas {
  const union: Leyendas = { materias: new Map(), profes: new Map(), aulas: new Map() };
  for (const l of todas) {
    for (const clave of ['materias', 'profes', 'aulas'] as const) {
      for (const [k, v] of l[clave]) if (!union[clave].has(k)) union[clave].set(k, v);
    }
  }
  return union;
}

/**
 * Normaliza un bloque "HORARIO DE CLASE" completo a la lista canónica de sesiones.
 *
 * `filas` es la cuadrícula del bloque tal cual la devuelve el lector del formato, sin
 * limpiar: se localizan solas la fila de días (la que tiene 'Lunes'…) y las filas de
 * horas. Lo que quede por debajo de la última fila de horas se trata como leyendas y
 * notas — ahí es donde vive el texto suelto tipo "1 sesión mensual", que no cabe en
 * ninguna cuadrícula y se conserva como nota en vez de inventarse una recurrencia.
 */
export function normalizarBloqueClase(
  filas: readonly (readonly string[])[],
  comunes?: Leyendas,
): ResultadoBloque {
  const incidencias: Incidencia[] = [];
  const limpias = filas.map((f) => f.map((c) => (c ?? '').toString()));

  let clase: ResultadoBloque['clase'] = null;
  for (const f of limpias) {
    for (const c of f) {
      const t = parsearTituloClase(c);
      if (t) { clase = t; break; }
    }
    if (clase) break;
  }

  const { filaDias, columnaDia } = localizarFilaDias(limpias);

  const sesiones: SesionImportada[] = [];
  const tramos: TramoImportado[] = [];
  let ultimaFilaHoras = filaDias;
  let orden = 0;

  if (filaDias >= 0 && clase) {
    // Leyendas primero: hacen falta para interpretar las celdas.
    const pie: string[] = [];
    for (let i = filaDias + 1; i < limpias.length; i++) {
      if (parsearRangoHoras(limpias[i][0] ?? '')) continue;
      pie.push(...limpias[i].filter((c) => c.trim()));
    }
    // La del propio bloque manda; la del resto del fichero rellena lo que le falte.
    const leyendas = comunes ? unirLeyendas([parsearLeyendas(pie), comunes]) : parsearLeyendas(pie);

    for (let i = filaDias + 1; i < limpias.length; i++) {
      const fila = limpias[i];
      const rango = parsearRangoHoras(fila[0] ?? '');
      if (!rango) continue;
      ultimaFilaHoras = i;
      orden++;
      const celdasDelDia = columnaDia.map((col) => (col >= 0 ? (fila[col] ?? '') : ''));
      const tipoTramo = tipoDeFila(celdasDelDia);
      tramos.push({ orden, horaInicio: rango.horaInicio, horaFin: rango.horaFin, tipo: tipoTramo });

      celdasDelDia.forEach((celda, idx) => {
        if (columnaDia[idx] < 0) return;
        const { sesiones: enLaCelda, incidencias: incs } = parsearCeldaClase(celda, leyendas);
        incidencias.push(...incs);
        for (const s of enLaCelda) {
          sesiones.push({
            dia: idx + 1,
            orden,
            horaInicio: rango.horaInicio,
            horaFin: rango.horaFin,
            tipoTramo,
            grupos: [{ curso: clase!.curso, letra: clase!.letra }],
            ...s,
          });
        }
      });
    }

    const notas = limpias
      .slice(ultimaFilaHoras + 1)
      .flatMap((f) => f.filter((c) => c.trim()))
      // Fuera: entradas de leyenda ('LEN1: Lengua…'), sus cabeceras, y cualquier cosa que
      // tenga pinta de celda suelta ('LEN1 - MVER0'), que a veces se cuela al aplanar.
      .filter((t) => !/^[^:]{1,20}:\s*.+$/.test(t) && !/^(materias|profesores|aulas|espacios):?$/i.test(norm(t)))
      .filter((t) => !/^[0-9A-ZÑ]{2,8}\s*[-–]\s*[0-9A-ZÑ]{2,8}/i.test(t))
      .filter((t) => t.length > 8);

    if (orden === 0) incidencias.push({ tipo: 'sin_tramos', detalle: `El bloque de ${clase.codigo} no tiene ninguna fila de horas` });
    return { clase, tramos, sesiones, leyendas, incidencias, notas };
  }

  if (!clase) incidencias.push({ tipo: 'grupo_ilegible', detalle: 'No se ha encontrado el título de clase del bloque (p. ej. "1PRIA: 1º EP-A")' });
  if (filaDias < 0) incidencias.push({ tipo: 'sin_tramos', detalle: 'No se ha encontrado la fila de días del bloque' });
  return { clase, tramos, sesiones, leyendas: { materias: new Map(), profes: new Map(), aulas: new Map() }, incidencias, notas: [] };
}

// ─── Rejillas desde el "Horario general del colegio" ──────────────────────────

export interface RejillaImportada {
  nombre: string;
  tramos: { diaSemana: number; orden: number; horaInicio: string; horaFin: string }[];
}

/**
 * Las filas de cabecera del "Horario general" son, literalmente, las rejillas del centro:
 * una fila por etapa y, en cada una, las horas de los cinco días seguidas.
 *
 *   'Primaria 2026-2027' | 09:00\n09:45 | 09:45\n10:30 | … (lunes) | … (martes) | …
 *
 * Los días NO ocupan el mismo número de columnas en todas las etapas (en ESO el lunes
 * tiene 9 sesiones y el martes 7), así que el corte por día no se puede hacer contando
 * columnas: se hace **detectando el reinicio de la hora** — cuando una hora de inicio es
 * anterior a la anterior, ha empezado un día nuevo. Es lo único que aguanta las tres
 * rejillas reales del colegio con el mismo código.
 */
export function parsearRejillaDeFila(fila: readonly string[]): RejillaImportada | null {
  const nombre = (fila[0] ?? '').toString().trim();
  if (!nombre) return null;
  const horas = fila
    .slice(1)
    .map((c) => (c ?? '').toString().trim())
    .map((c) => {
      const m = /^(\d{1,2})[:.](\d{2})\s*[\n\r/-]\s*(\d{1,2})[:.](\d{2})$/.exec(c);
      return m ? { horaInicio: `${m[1].padStart(2, '0')}:${m[2]}`, horaFin: `${m[3].padStart(2, '0')}:${m[4]}` } : null;
    });

  const tramos: RejillaImportada['tramos'] = [];
  let dia = 0;
  let orden = 0;
  let anterior = '';
  for (const h of horas) {
    if (!h) continue;
    if (h.horaInicio <= anterior) { dia++; orden = 0; } // se ha reiniciado la hora: día nuevo
    else if (dia === 0) dia = 1;
    if (dia === 0) dia = 1;
    orden++;
    anterior = h.horaInicio;
    if (dia > 5) break;
    tramos.push({ diaSemana: dia, orden, horaInicio: h.horaInicio, horaFin: h.horaFin });
  }
  return tramos.length ? { nombre, tramos } : null;
}

// ─── De sesiones sueltas a asignaciones ───────────────────────────────────────

/** Una asignación lista para escribir: qué, quién, a quién y en qué huecos de la semana. */
export interface AsignacionAgrupada {
  id: string;
  actividadCodigo: string;
  materiaCodigo: string | null;
  materiaId: string | null;
  detalle: string | null;
  aulaCodigo: string | null;
  profeCodigos: string[];
  crudo: string;
  /** El curso del que se saca el tramo. Todos los grupos comparten curso, y por eso rejilla. */
  curso: string;
  grupos: { curso: string; letra: string | null }[];
  sesiones: { dia: number; orden: number }[];
}

/**
 * Convierte las sesiones sueltas de todos los bloques en la lista de asignaciones.
 *
 * Es la parte con criterio del import, y por eso vive aquí (sin BBDD) y no en el volcado:
 * se puede probar contra el fichero real del colegio sin Neon delante.
 *
 * Dos agrupaciones, en este orden:
 *
 * 1. **Sesiones reales.** Misma materia, mismo profe, misma hora y mismo curso en dos clases
 *    distintas = UNA sesión con dos grupos, no dos clases simultáneas. Es la optativa que
 *    comparten 4º A y 4º B. La regla se apoya en un hecho físico, no en una heurística: *un
 *    profe no puede estar en dos sitios a la vez*. Y por eso el profe forma parte de la
 *    clave: cuando María Tirado da inglés en 3º PDC, en 3º ESO A lo está dando María Remolar
 *    a la misma hora — profes distintos, dos clases distintas, no se tocan.
 *    Las celdas sin profe reconocido (un 'PT-' suelto) no se funden nunca: no identifican a
 *    nadie, y fundirlas sería juntar cosas por parecido.
 * 2. **Asignaciones.** Las N sesiones semanales de lo mismo (actividad + materia + detalle +
 *    profes + aula + grupos) son UNA asignación puesta N veces, que es lo que hace falta
 *    para que "quitarle Mates a este profe" sea un solo cambio.
 *
 * `materiaIdDe` traduce el código del fichero al id de la materia ya unificada. Cuando
 * devuelve `null` para un código que el fichero usa pero no define, se intenta el rescate
 * por hueco: si a esa hora ese mismo profe da una materia conocida en otra clase, es esa.
 * Solo con **un único candidato**; en la duda no se inventa.
 */
export function agruparSesiones(
  bloques: readonly ResultadoBloque[],
  materiaIdDe: (codigo: string) => string | null,
): AsignacionAgrupada[] {
  const utiles = bloques.filter((b) => b.clase && b.sesiones.length > 0);

  const materiaPorHueco = new Map<string, Set<string>>();
  for (const b of utiles) {
    for (const s of b.sesiones) {
      const id = s.materiaCodigo ? materiaIdDe(s.materiaCodigo) : null;
      if (!id) continue;
      for (const p of s.profeCodigos) {
        const k = `${s.dia}|${s.orden}|${p.toUpperCase()}`;
        materiaPorHueco.set(k, (materiaPorHueco.get(k) ?? new Set()).add(id));
      }
    }
  }
  const rescatar = (s: { dia: number; orden: number; profeCodigos: string[] }): string | null => {
    const candidatas = new Set<string>();
    for (const p of s.profeCodigos) {
      for (const id of materiaPorHueco.get(`${s.dia}|${s.orden}|${p.toUpperCase()}`) ?? []) candidatas.add(id);
    }
    return candidatas.size === 1 ? [...candidatas][0] : null;
  };

  interface Real {
    curso: string;
    dia: number;
    orden: number;
    actividadCodigo: string;
    materiaCodigo: string | null;
    materiaId: string | null;
    detalle: string | null;
    aulaCodigo: string | null;
    profeCodigos: string[];
    crudo: string;
    grupos: Map<string, { curso: string; letra: string | null }>;
  }

  const reales = new Map<string, Real>();
  for (const b of utiles) {
    const clase = b.clase!;
    const claveClase = `${clase.curso}|${clase.letra ?? ''}`;
    for (const s of b.sesiones) {
      const materiaId = s.materiaCodigo ? (materiaIdDe(s.materiaCodigo) ?? rescatar(s)) : null;
      // El ORDEN de la celda se conserva: el primero es el titular ('MAT1 - MPER0' + 'ESEB0'
      // → Montserrat titular y Emilia de apoyo) y de ahí sale `principal`. Ordenado
      // alfabéticamente, Emilia pasaba a ser la titular de unas Matemáticas que no da.
      // Para COMPARAR sí se ordena: el mismo par de profes es la misma clase en otro orden.
      const profeCodigos = [...new Set(s.profeCodigos.map((p) => p.toUpperCase()))];
      const firmaProfes = [...profeCodigos].sort().join('+');
      const clave = profeCodigos.length
        ? ['·', clase.curso, s.dia, s.orden, s.actividadCodigo, materiaId ?? s.materiaCodigo ?? '', s.detalle ?? '', firmaProfes].join('|')
        : ['×', claveClase, s.dia, s.orden, s.actividadCodigo, s.crudo].join('|');
      const previa = reales.get(clave);
      if (previa) {
        previa.grupos.set(claveClase, { curso: clase.curso, letra: clase.letra });
        previa.aulaCodigo ??= s.aulaCodigo;
        continue;
      }
      reales.set(clave, {
        curso: clase.curso,
        dia: s.dia,
        orden: s.orden,
        actividadCodigo: s.actividadCodigo,
        materiaCodigo: s.materiaCodigo,
        materiaId,
        detalle: s.detalle,
        aulaCodigo: s.aulaCodigo,
        profeCodigos,
        crudo: s.crudo,
        grupos: new Map([[claveClase, { curso: clase.curso, letra: clase.letra }]]),
      });
    }
  }

  const asignaciones = new Map<string, AsignacionAgrupada>();
  for (const r of reales.values()) {
    const grupos = [...r.grupos.values()].sort(compararClases);
    const clave = [
      r.actividadCodigo,
      r.materiaId ?? r.materiaCodigo ?? '',
      // Las horas de Matemáticas del Ámbito Científico son una asignación y las de Biología
      // otra, aunque las dé el mismo profe: son cosas distintas dentro de la misma materia.
      r.detalle ?? '',
      [...r.profeCodigos].sort().join('+'),
      r.aulaCodigo ?? '',
      grupos.map((g) => `${g.curso}|${g.letra ?? ''}`).join(','),
      // Sin materia el texto de la celda ES la identidad ('PT- MAPI' y 'AL 5º y 6º' no son
      // lo mismo aunque las dos sean apoyo sin profe reconocido).
      r.materiaId ? '' : r.crudo,
    ].join('#');
    const previa = asignaciones.get(clave);
    if (previa) {
      previa.sesiones.push({ dia: r.dia, orden: r.orden });
      continue;
    }
    asignaciones.set(clave, {
      id: crypto.randomUUID(),
      actividadCodigo: r.actividadCodigo,
      materiaCodigo: r.materiaCodigo,
      materiaId: r.materiaId,
      detalle: r.detalle,
      aulaCodigo: r.aulaCodigo,
      profeCodigos: r.profeCodigos,
      crudo: r.crudo,
      curso: r.curso,
      grupos,
      sesiones: [{ dia: r.dia, orden: r.orden }],
    });
  }
  return [...asignaciones.values()];
}

// ─── Las hojas de PROFESOR: lo que cada uno escribe a mano ───────────────────
//
// El fichero de Educamos trae, detrás de los horarios de clase, uno por profe. Casi todo lo
// que dicen es lo mismo visto del revés ('FIS: 2ESOA') y eso sigue saliendo de las hojas de
// clase. Pero hay dos cosas que SOLO están aquí, escritas a mano por cada uno:
//
//  1. **Las horas que no son clase**: reuniones (TIC los lunes, innovación los miércoles,
//     pastoral los jueves, COCOPE, Erasmus), atención a familias y a alumnado,
//     departamento, jefatura, oratorio, coordinación de pastoral, la web…
//  2. **Clases en las que entra alguien que la hoja de la clase no nombra**: Emilia
//     Sebastiá se apunta 'MATE 1ºB' a la misma hora que 1º B tiene Matemáticas con su
//     profe, así que es un segundo profe en esa clase.
//
// Como lo escriben a mano, el mismo concepto llega de mil formas ('AT. PADRES', 'AT.PADRES',
// 'ATE. PADRES', 'At padres', 'Atención familias'), y por eso se reconoce por PATRONES sobre
// el texto normalizado, nunca comparando literales. Lo que no se reconoce **no se pierde**:
// entra como 'Otros' con su texto y sale en la vista previa para que alguien lo mire.

/** Nombres de las actividades, igual que en la semilla de `hor_actividades`. */
const NOMBRE_ACTIVIDAD: Record<string, string> = {
  clase: 'Clase', tutoria: 'Tutoría', apoyo_pt: 'Apoyo PT', apoyo_al: 'Audición y lenguaje',
  guardia: 'Guardia', departamento: 'Departamento', coordinacion: 'Coordinación', reunion: 'Reunión',
  atencion_padres: 'Atención a familias', atencion_alumnos: 'Atención a alumnado', oratorio: 'Oratorio',
  libre_disposicion: 'Libre disposición', otros: 'Otros', auxiliar: 'Auxiliar / apoyo en aula',
};

/** Una hora no lectiva (o lectiva sin grupo) reconocida en la hoja de un profe. */
export interface HoraReconocida {
  actividadCodigo: string;
  /** Lo que se enseña además del nombre de la actividad ('TIC', 'Jefatura de estudios'). */
  etiqueta: string | null;
}

/** Texto normalizado para reconocer: sin tildes, en mayúsculas, sin puntuación ni asteriscos. */
function claveTexto(t: string): string {
  return (t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9º]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** El texto tal cual, sin el asterisco y sin espacios sobrantes: para enseñarlo. */
function textoLimpio(t: string): string {
  return (t ?? '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Reuniones con nombre propio: el texto normalizado → cómo se enseña. Si la celda dice algo
 * más ('COCOPE ESO'), se enseña lo que dice la celda.
 */
const REUNIONES: Record<string, string> = {
  TIC: 'TIC',
  INNOVACION: 'Innovación', INNOVA: 'Innovación', INNOVACIO: 'Innovación',
  PASTORAL: 'Pastoral',
  COCOPE: 'COCOPE', CCP: 'CCP',
  ERASMUS: 'Erasmus',
  CLAUSTRO: 'Claustro', CLAUSTRE: 'Claustre',
  'EQUIPO DIRECTIVO': 'Equipo directivo', ED: 'Equipo directivo',
  CALIDAD: 'Calidad', CONVIVENCIA: 'Convivencia', IGUALDAD: 'Igualdad', BIBLIOTECA: 'Biblioteca',
  PLURILINGUISMO: 'Plurilingüismo', ETWINNING: 'eTwinning',
  EVALUACION: 'Evaluación', 'SESION EVALUACION': 'Sesión de evaluación',
  REUNION: 'Reunión', REUNIO: 'Reunió', NIVEL: 'Reunión de nivel', CICLO: 'Reunión de ciclo', ETAPA: 'Reunión de etapa',
};

/** Cargos y coordinaciones: el texto normalizado → cómo se enseña. */
const COORDINACIONES: Record<string, string> = {
  JE: 'Jefatura de estudios', 'J E': 'Jefatura de estudios', JEFATURA: 'Jefatura de estudios',
  'JEFATURA DE ESTUDIOS': 'Jefatura de estudios', 'JEFATURA ESTUDIOS': 'Jefatura de estudios', 'JEF ESTUDIOS': 'Jefatura de estudios',
  DIRECCION: 'Dirección', DIR: 'Dirección', SECRETARIA: 'Secretaría',
  WEB: 'Web', 'PAGINA WEB': 'Web',
  ORIENTACION: 'Orientación', ORIENTACIO: 'Orientació',
  'C PASTORAL': 'Coordinación de pastoral', 'COORD PASTORAL': 'Coordinación de pastoral',
  'COORDINACION PASTORAL': 'Coordinación de pastoral', 'COORDINACION DE PASTORAL': 'Coordinación de pastoral',
};

const RE_PREFIJO_ATENCION = String.raw`(?:AT|ATE|ATN|ATT|ATEN|ATENC|ATENCIO|ATENCION|A)?\s*(?:A|AL|DE|LAS|LOS)?\s*`;
const RE_PADRES = new RegExp(`^${RE_PREFIJO_ATENCION}(?:PADRES|PARES|FAMILIAS?|FAMILIES|PAPAS)$`);
const RE_ALUMNOS = new RegExp(`^${RE_PREFIJO_ATENCION}(?:ALUMNOS|ALUMNADO|ALUMNES|ALUMNAT|ALUMNAS)$`);

/**
 * Qué es una línea escrita a mano en la hoja de un profe, o `null` si no se sabe.
 *
 * Se mira el texto **normalizado** (sin tildes, mayúsculas, la puntuación como espacio), así
 * que 'AT. PADRES', 'AT.PADRES', 'ATE. PADRES', 'At padres' y 'ATENCIÓN FAMILIAS' son lo
 * mismo. Los asteriscos se ignoran aquí (los trata quien mira la celda entera).
 */
export function reconocerHoraProfe(linea: string): HoraReconocida | null {
  const k = claveTexto(linea);
  if (!k) return null;
  const pegado = k.replace(/\s+/g, '');
  const limpio = textoLimpio(linea);

  if (RE_PADRES.test(k) || RE_PADRES.test(pegado)) return { actividadCodigo: 'atencion_padres', etiqueta: null };
  if (RE_ALUMNOS.test(k) || RE_ALUMNOS.test(pegado)) return { actividadCodigo: 'atencion_alumnos', etiqueta: null };

  const dpto = /^(?:DPTO|DPT|DEPTO|DEPT|DEP|DEPARTAMENTO|DEPARTAMENT)(?:\s+(.*))?$/.exec(k);
  if (dpto) return { actividadCodigo: 'departamento', etiqueta: dpto[1] ? limpio : null };

  if (/^(?:GUARDIA|GUARDIAS|GUAR|GUARD|VIGILANCIA)(?:\s|$)/.test(k)) {
    return { actividadCodigo: 'guardia', etiqueta: /\s/.test(k) ? limpio : null };
  }
  if (/^ORATORI/.test(k)) return { actividadCodigo: 'oratorio', etiqueta: null };
  if (/^(?:NO LECTIVA|NO LECTIVO|NO LECT|HORA NO LECTIVA)$/.test(k)) return { actividadCodigo: 'libre_disposicion', etiqueta: 'No lectiva' };
  if (/^(?:LIBRE|LIBRE DISPOSICION|HORA LIBRE|PREPARACION|PREPARACION DE CLASES)$/.test(k)) return { actividadCodigo: 'libre_disposicion', etiqueta: null };

  if (COORDINACIONES[k]) return { actividadCodigo: 'coordinacion', etiqueta: COORDINACIONES[k] };
  const coord = /^(?:COORD|COORDINACION|COORDINADORA?|C)\s+(.+)$/.exec(k);
  if (coord && !/^\d/.test(coord[1])) {
    const de = REUNIONES[coord[1]] ?? COORDINACIONES[coord[1]] ?? textoLimpio(limpio.replace(/^\s*(?:coord(?:inaci[oó]n|inadora?)?|c)\s*[.:\-]?\s*/i, ''));
    return { actividadCodigo: 'coordinacion', etiqueta: `Coordinación ${de}` };
  }

  if (REUNIONES[k]) return { actividadCodigo: 'reunion', etiqueta: REUNIONES[k] };
  const primera = k.split(' ')[0];
  if (REUNIONES[primera] && primera.length > 2) return { actividadCodigo: 'reunion', etiqueta: limpio };

  if (/^(?:REFUERZO|DESDOBLE|APOYO|REFORC|REFORÇ)(?:\s|$)/.test(k)) return { actividadCodigo: 'otros', etiqueta: limpio };
  if (/^(?:TUT|TUTORIA|TUTORIAS)$/.test(k)) return { actividadCodigo: 'tutoria', etiqueta: null };
  if (/^(?:TUT|TUTORIA|TUTORIAS) (?:INDIVIDUAL|INDIVIDUALES|FAMILIAS|PADRES)$/.test(k)) return { actividadCodigo: 'tutoria', etiqueta: limpio };
  if (/^PT(?:\s|$)/.test(k)) return { actividadCodigo: 'apoyo_pt', etiqueta: limpio };
  if (/^AL(?:\s|$)/.test(k)) return { actividadCodigo: 'apoyo_al', etiqueta: limpio };
  return null;
}

/** Una línea de clase en la hoja de un profe: 'FIS: 2ESOA', 'MAT B: 4ESOA' o, a mano, 'MATE 1ºB'. */
export interface ClaseEnHojaProfe {
  materiaTexto: string;
  curso: string;
  letra: string | null;
  /** Escrita a mano (no con el formato de Educamos): es la que puede traer información nueva. */
  aMano: boolean;
}

const ETAPA_ESCRITA: Record<string, string> = { ESO: 'ESO', EP: 'PRI', PRI: 'PRI', PRIM: 'PRI', INF: 'INF', EI: 'INF', BACH: 'BACH', BAT: 'BACH' };

/**
 * ¿Es esta línea una clase con su grupo? Dos formatos:
 *   'FIS: 2ESOA' · 'MAT B: 4ESOA' · 'NG: 4º PPDC'   (el de Educamos)
 *   'MATE 1ºB' · 'TUT 4ºA' · 'TUT: 4 ESO' · 'TECNO 3ºB*'   (a mano)
 * A mano solo se acepta si el grupo lleva algo que lo delate (º, la etapa o la letra): sin
 * eso 'REUNIÓN 1' sería una clase de 1º.
 */
export function parsearClaseHojaProfe(linea: string, etapaPorDefecto = 'ESO'): ClaseEnHojaProfe | null {
  const t = textoLimpio(linea);
  // Educamos escribe el grupo pegado ('4ESOB'); el único con espacio es el PDC ('4º PPDC').
  const educamos = /^(.{1,12}?)\s*:\s*(\d(?:INF|PRI|ESO|BACH|CFGM|CFGS)[A-Z]?|\d\s*º?\s*P?PDC)$/i.exec(t);
  if (educamos) {
    const grupo = parsearCodigoGrupo(educamos[2]);
    if (grupo) return { materiaTexto: educamos[1].trim(), curso: grupo.curso, letra: grupo.letra, aMano: false };
  }
  const libre = /^(.{1,20}?)\s*:?\s+(\d)\s*(º|°|o)?\s*(ESO|EP|PRIM|PRI|INF|EI|BACH|BAT|P?PDC)?\s*[-.]?\s*([A-D])?$/i.exec(t);
  if (!libre || !(libre[3] || libre[4] || libre[5])) return null;
  const etapaEscrita = (libre[4] ?? '').toUpperCase();
  if (/PDC$/.test(etapaEscrita)) return { materiaTexto: libre[1].trim(), curso: `${libre[2]}ESO`, letra: 'PDC', aMano: true };
  const etapa = ETAPA_ESCRITA[etapaEscrita] ?? etapaPorDefecto;
  return { materiaTexto: libre[1].trim(), curso: `${libre[2]}${etapa}`, letra: libre[5]?.toUpperCase() ?? null, aMano: true };
}

/** La hoja de un profe, ya en celdas: una por día y franja con algo escrito. */
export interface HojaProfe {
  nombre: string;
  celdas: { dia: number; horaInicio: string; horaFin: string; texto: string }[];
}

export function normalizarBloqueProfe(filas: readonly (readonly string[])[], titulo?: string): HojaProfe | null {
  const limpias = filas.map((f) => f.map((c) => (c ?? '').toString()));
  const { filaDias, columnaDia } = localizarFilaDias(limpias);
  if (filaDias < 0) return null;
  const nombre = (titulo ?? limpias.flat().find((c) => c.trim() && !/^(horario de|colegio)/i.test(c.trim())) ?? '').trim();
  const celdas: HojaProfe['celdas'] = [];
  for (let i = filaDias + 1; i < limpias.length; i++) {
    const rango = parsearRangoHoras(limpias[i][0] ?? '');
    if (!rango) continue;
    columnaDia.forEach((col, idx) => {
      const texto = col >= 0 ? (limpias[i][col] ?? '').trim() : '';
      if (texto) celdas.push({ dia: idx + 1, ...rango, texto });
    });
  }
  return { nombre, celdas };
}

/** Un profe del claustro tal y como lo conoce la BBDD, para casar las hojas por nombre. */
export interface ProfeConocido {
  alias: string;
  nombre: string;
}

function tokensNombre(n: string): string[] {
  return claveTexto((n ?? '').replace(/\(.*?\)/g, ' ')).split(' ').filter((t) => t.length > 1);
}

/**
 * El código del profe de una hoja ('LUCÍA VIVES PEÑA' → 'LVIV0').
 *
 * Primero contra las leyendas del propio fichero ('LVIV0: LUCÍA VIVES PEÑA'); si no está
 * (Emilia Sebastiá no sale en ninguna, porque ninguna hoja de clase la nombra), contra el
 * claustro de la BBDD. Casa si todas las palabras del nombre de la hoja están en el nombre
 * completo y **hay un único candidato**: 'EMILIA SEBASTIÁ' casa con 'EMILIA SEBASTIA
 * LLORENS', pero 'MARÍA PERIS' no se asigna a nadie si hay dos Peris que se llaman María.
 */
export function casarProfePorNombre(
  nombre: string,
  leyendaProfes: ReadonlyMap<string, string>,
  conocidos: readonly ProfeConocido[] = [],
): string | null {
  const buscados = tokensNombre(nombre);
  if (buscados.length === 0) return null;
  const casa = (completo: string) => {
    const suyos = new Set(tokensNombre(completo));
    return buscados.every((t) => suyos.has(t));
  };
  for (const lista of [[...leyendaProfes.entries()], conocidos.map((p) => [p.alias, p.nombre] as const)]) {
    const exactos = lista.filter(([, n]) => tokensNombre(n).join(' ') === buscados.join(' '));
    if (exactos.length === 1) return exactos[0][0].toUpperCase();
    const candidatos = [...new Set(lista.filter(([, n]) => casa(n)).map(([c]) => c.toUpperCase()))];
    if (candidatos.length === 1) return candidatos[0];
  }
  return null;
}

/** ¿El texto escrito a mano ('MATE', 'TECNO', 'FIS') es esta materia ('MAT1', 'TYD3', 'FIS3')? */
function casaMateria(texto: string, codigo: string, leyendas: Leyendas): boolean {
  const t = claveTexto(texto).replace(/\s+/g, '');
  const c = codigo.toUpperCase().replace(/\s+/g, '');
  if (!t) return false;
  const raiz = raizMateria(c);
  if (t === c || raizMateria(t) === raiz) return true;
  if (raiz.length >= 2 && t.startsWith(raiz)) return true;
  const nombre = normalizarNombreMateria(leyendas.materias.get(c) ?? '');
  if (!nombre) return false;
  const delDetalle = NOMBRES_DETALLE[t] ? normalizarNombreMateria(NOMBRES_DETALLE[t]) : null;
  return (!!delDetalle && nombre.startsWith(delDetalle)) || (t.length >= 3 && nombre.replace(/\s+/g, '').startsWith(t.toLowerCase()));
}

/**
 * Una clase que un profe se apunta en su hoja. Si la hoja de esa clase ya le nombra a esa
 * hora, nada. Si no le nombra pero a esa hora hay UNA clase que casa con lo que ha escrito,
 * entra como segundo profe en ella (así entra Emilia en las Matemáticas de 1º B). Si no hay
 * ninguna que case, o hay varias y no se sabe cuál, se devuelve para que se trate como aviso.
 */
function reconciliarClase(
  bloques: readonly ResultadoBloque[],
  profe: string,
  dia: number,
  horaInicio: string,
  clase: ClaseEnHojaProfe,
): 'ya_estaba' | 'añadido' | 'sin_clase' | 'ambiguo' {
  const suyos = bloques.filter(
    (b) => b.clase && b.clase.curso === clase.curso && (clase.letra === null || (b.clase.letra ?? null) === clase.letra),
  );
  if (suyos.length === 0) return 'sin_clase';
  const enHueco = suyos.flatMap((b) =>
    b.sesiones.filter((s) => s.dia === dia && s.horaInicio === horaInicio).map((s) => ({ b, s })),
  );
  if (enHueco.some(({ s }) => s.profeCodigos.includes(profe))) return 'ya_estaba';
  const clases = enHueco.filter(({ s }) => s.actividadCodigo === 'clase' && s.materiaCodigo);
  if (clases.length === 0) return 'sin_clase';
  // La materia TIENE que casar. Coger «la única clase que hay a esa hora» metía a Emilia en
  // una Lengua de 2º A porque su hoja dice 'FIS 2ºA' a una hora en que 2º A tiene Lengua: eso
  // es una contradicción entre las dos hojas, y se avisa en vez de elegir por ella.
  const elegidas = clases.filter(({ b, s }) => casaMateria(clase.materiaTexto, s.materiaCodigo!, b.leyendas));
  if (elegidas.length !== 1) return elegidas.length === 0 ? 'sin_clase' : 'ambiguo';
  elegidas[0].s.profeCodigos.push(profe);
  return 'añadido';
}

/**
 * **El inglés del PDC.** Educamos junta en la misma celda a la profe del grupo de referencia
 * y a la del PDC, y la pone igual en los dos grupos: 4º ESO B y 4º PDC dicen los dos
 * 'ING - MREM0' + 'MTIR0'. Pero no son dos profes dando una clase: el grupo se parte, y
 * **al PDC le da clase la segunda** (María Tirado), y al grupo de referencia, la primera.
 * David lo confirmó: pasa siempre que en el PDC salen dos profes.
 *
 * Solo se reparte cuando la MISMA celda (mismos profes, misma hora) está también en un grupo
 * del mismo curso: es esa repetición lo que delata el truco de Educamos. Si un día el PDC
 * tiene de verdad dos profes en una clase suya, no se toca.
 *
 * Si la materia del PDC no está en la leyenda (el 'NG - MREM0' al que Educamos se comió la
 * I), se toma la del grupo de referencia, que es la misma celda.
 */
export function repartirProfesPdc(bloques: readonly ResultadoBloque[]): string[] {
  const avisos = new Map<string, string>();
  for (const pdc of bloques) {
    if (!pdc.clase || pdc.clase.letra !== 'PDC') continue;
    const referencia = bloques.filter((b) => b.clase && b !== pdc && b.clase.curso === pdc.clase!.curso && b.clase.letra !== 'PDC');
    for (const s of pdc.sesiones) {
      if (s.actividadCodigo !== 'clase' || s.profeCodigos.length < 2) continue;
      const mismos = (x: SesionImportada) =>
        x.dia === s.dia &&
        x.orden === s.orden &&
        x.actividadCodigo === 'clase' &&
        x.profeCodigos.length === s.profeCodigos.length &&
        x.profeCodigos.every((p) => s.profeCodigos.includes(p)) &&
        (x.materiaCodigo === s.materiaCodigo || !s.materiaCodigo || !pdc.leyendas.materias.has(s.materiaCodigo) ||
          raizMateria(x.materiaCodigo ?? '') === raizMateria(s.materiaCodigo));
      const gemelas = referencia.flatMap((b) => b.sesiones.filter(mismos).map((x) => ({ b, x })));
      if (gemelas.length === 0) continue;

      const comoVenia = s.profeCodigos.join(' y ');
      const delPdc = s.profeCodigos[s.profeCodigos.length - 1];
      const deReferencia = s.profeCodigos.filter((p) => p !== delPdc);
      if (s.materiaCodigo && !pdc.leyendas.materias.has(s.materiaCodigo) && gemelas[0].x.materiaCodigo) {
        s.materiaCodigo = gemelas[0].x.materiaCodigo;
      }
      s.profeCodigos = [delPdc];
      for (const { x } of gemelas) x.profeCodigos = [...deReferencia];

      const grupos = [...new Set(gemelas.map(({ b }) => b.clase!.codigo))].join(', ');
      avisos.set(
        `${pdc.clase.codigo}|${s.materiaCodigo}|${delPdc}|${grupos}`,
        `${s.materiaCodigo} de ${pdc.clase.codigo}: Educamos pone a ${comoVenia} en ${pdc.clase.codigo} y en ${grupos}. Se ha repartido: ${delPdc} da clase al PDC y ${deReferencia.join(' y ')} a ${grupos}.`,
      );
    }
  }
  return [...avisos.values()];
}

/** Una hora de un profe que no es una clase de grupo. */
export interface HoraDeProfe {
  profeCodigo: string;
  dia: number;
  horaInicio: string;
  horaFin: string;
  actividadCodigo: string;
  etiqueta: string | null;
  crudo: string;
}

/** Lo que se vuelca: una actividad con sus profes y sus huecos de la semana. */
export interface ActividadProfeAgrupada {
  actividadCodigo: string;
  etiqueta: string | null;
  profeCodigos: string[];
  crudo: string;
  sesiones: { dia: number; horaInicio: string; horaFin: string }[];
}

/**
 * Junta las horas sueltas de los profes en asignaciones, como `agruparSesiones` con las clases.
 *
 * Las **reuniones** se juntan además entre profes: la de TIC del lunes a segunda la tienen
 * Amparo, Bárbara y David a la vez, y eso es UNA reunión con tres personas, no tres
 * reuniones (el modelo lo dice así desde el principio). Lo demás no se junta nunca: que dos
 * profes tengan atención a familias a la misma hora no hace que atiendan a las mismas.
 */
export function agruparHorasDeProfe(horas: readonly HoraDeProfe[]): ActividadProfeAgrupada[] {
  // 1. Por hueco: quién está en cada reunión.
  const porHueco = new Map<string, { h: HoraDeProfe; profes: Set<string> }>();
  for (const h of horas) {
    const comun = h.actividadCodigo === 'reunion';
    const clave = [h.actividadCodigo, h.etiqueta ?? '', h.dia, h.horaInicio, h.horaFin, comun ? '' : h.profeCodigo].join('|');
    const previa = porHueco.get(clave);
    if (previa) previa.profes.add(h.profeCodigo);
    else porHueco.set(clave, { h, profes: new Set([h.profeCodigo]) });
  }
  // 2. Por actividad + profes: las N veces a la semana de lo mismo son una asignación.
  const asignaciones = new Map<string, ActividadProfeAgrupada>();
  for (const { h, profes } of porHueco.values()) {
    const profeCodigos = [...profes].sort();
    const clave = [h.actividadCodigo, h.etiqueta ?? '', profeCodigos.join('+')].join('#');
    const previa = asignaciones.get(clave);
    const hueco = { dia: h.dia, horaInicio: h.horaInicio, horaFin: h.horaFin };
    if (previa) {
      if (!previa.sesiones.some((s) => s.dia === hueco.dia && s.horaInicio === hueco.horaInicio)) previa.sesiones.push(hueco);
      continue;
    }
    asignaciones.set(clave, { actividadCodigo: h.actividadCodigo, etiqueta: h.etiqueta, profeCodigos, crudo: h.crudo, sesiones: [hueco] });
  }
  return [...asignaciones.values()];
}

/** Lo que sale de un fichero entero, listo para la vista previa y para el volcado. */
export interface Preparacion {
  /** Las clases, con lo que han aportado las hojas de profe ya metido dentro. */
  clases: ResultadoBloque[];
  /** Las horas que no son clase de grupo, ya agrupadas. */
  horasProfe: ActividadProfeAgrupada[];
  hojasProfe: { nombre: string; codigo: string | null; horas: number }[];
  /** Avisos que vienen de las hojas de profe (los de clase siguen dentro de cada bloque). */
  incidencias: Incidencia[];
  /** Lo que el importador ha arreglado solo y conviene que alguien sepa. */
  ajustes: string[];
}

/** Lo mínimo de un bloque leído (para no depender del lector, que trae SheetJS). */
export interface BloqueEntrada {
  tipo: 'clase' | 'profe';
  titulo: string;
  filas: readonly (readonly string[])[];
}

/**
 * Todo el criterio del import, sin BBDD: clases, hojas de profe y el cruce entre ellas.
 *
 * El orden importa:
 *  1. Clases, en dos pasadas (la segunda con las leyendas de todo el fichero de respaldo).
 *  2. Hojas de profe: lo que no es clase se reconoce como hora del profe, y las clases que
 *     se apunta a mano y la hoja de la clase no nombra le meten como segundo profe.
 *  3. El reparto del inglés del PDC, DESPUÉS del cruce: si fuera antes, el cruce vería que
 *     la hoja de María Remolar dice 'ING: 4º PPDC', no la encontraría ya en el PDC y la
 *     volvería a meter.
 *
 * `conocidos` es el claustro de la BBDD, para casar por nombre las hojas de quien no sale en
 * ninguna leyenda. Sin él, esas hojas se avisan y no se importan.
 */
export function prepararImportacion(bloques: readonly BloqueEntrada[], conocidos: readonly ProfeConocido[] = []): Preparacion {
  const deClase = bloques.filter((b) => b.tipo === 'clase');
  const comunes = unirLeyendas(deClase.map((b) => normalizarBloqueClase(b.filas).leyendas));
  const clases = deClase.map((b) => normalizarBloqueClase(b.filas, comunes)).filter((r) => r.clase && r.sesiones.length > 0);

  const etapas = clases.map((c) => /(INF|PRI|ESO|BACH)$/.exec(c.clase!.curso)?.[1]).filter(Boolean) as string[];
  const etapaPorDefecto = etapas.sort((a, b) => etapas.filter((x) => x === b).length - etapas.filter((x) => x === a).length)[0] ?? 'ESO';

  const incidencias: Incidencia[] = [];
  const ajustes: string[] = [];
  const horas: HoraDeProfe[] = [];
  const hojasProfe: Preparacion['hojasProfe'] = [];
  const añadidos = new Map<string, number>();

  for (const b of bloques.filter((x) => x.tipo === 'profe')) {
    const hoja = normalizarBloqueProfe(b.filas, b.titulo);
    if (!hoja || hoja.celdas.length === 0) continue;
    const codigo = casarProfePorNombre(hoja.nombre, comunes.profes, conocidos);
    if (!codigo) {
      incidencias.push({
        tipo: 'profe_desconocido',
        detalle: `La hoja de '${hoja.nombre}' no casa con nadie del profesorado: sus horas no se importan`,
        crudo: hoja.nombre,
      });
      hojasProfe.push({ nombre: hoja.nombre, codigo: null, horas: 0 });
      continue;
    }
    let suyas = 0;

    for (const celda of hoja.celdas) {
      const lineas = celda.texto.split(/[\n\r]+/).map((l) => l.trim()).filter((l) => l && !esRuido(l));
      if (lineas.length === 0 || lineas.every((l) => RE_RECREO.test(l) || RE_COMEDOR.test(l))) continue;
      const hueco = { dia: celda.dia, horaInicio: celda.horaInicio, horaFin: celda.horaFin };

      type Leida =
        | { tipo: 'clase'; linea: string; estrella: boolean; clase: ClaseEnHojaProfe }
        | { tipo: 'hora'; linea: string; estrella: boolean; hora: HoraReconocida }
        | { tipo: 'detalle' | 'rara'; linea: string; estrella: boolean };
      const leidas: Leida[] = [];
      for (const linea of lineas) {
        if (RE_RECREO.test(linea) || RE_COMEDOR.test(linea)) continue;
        const estrella = /\*/.test(linea);
        const clase = parsearClaseHojaProfe(linea, etapaPorDefecto);
        if (clase) { leidas.push({ tipo: 'clase', linea, estrella, clase }); continue; }
        const hora = reconocerHoraProfe(linea);
        if (hora) { leidas.push({ tipo: 'hora', linea, estrella, hora }); continue; }
        // 'AC: 4º PPDC' + 'MATE': la segunda línea es la hora del ámbito, no otra cosa.
        const anterior = leidas[leidas.length - 1];
        if (anterior?.tipo === 'clase' && !/\s/.test(linea.trim())) { leidas.push({ tipo: 'detalle', linea, estrella }); continue; }
        leidas.push({ tipo: 'rara', linea, estrella });
      }

      // ── Celdas con asterisco: dos cosas que se turnan en la misma hora ──────────
      // 'TECNO 3ºB*' + 'ORATORIO', 'COCOPE*' + 'DPTO', 'TYD1: 1ESOB*' + 'TIC'. Se guardan
      // como UNA hora con las dos cosas ('Oratorio | TECNO 3ºB'), que es como David se lo
      // había apuntado a mano; meterlas como dos sería un profe en dos sitios a la vez.
      const conEstrella = leidas.length > 1 && leidas.some((l) => l.estrella);
      if (conEstrella) {
        const nombreDe = (l: Leida) =>
          l.tipo === 'hora' ? (l.hora.etiqueta ?? NOMBRE_ACTIVIDAD[l.hora.actividadCodigo] ?? textoLimpio(l.linea)) : textoLimpio(l.linea);
        const sinEstrella = leidas.filter((l) => !l.estrella && l.tipo !== 'detalle');
        const ordenadas = [...sinEstrella, ...leidas.filter((l) => l.estrella)];
        const principal = (sinEstrella.find((l) => l.tipo === 'hora') ?? leidas.find((l) => l.tipo === 'hora')) as
          | Extract<Leida, { tipo: 'hora' }>
          | undefined;
        // Las clases SIN asterisco de esa celda siguen siendo clases normales.
        for (const l of sinEstrella) {
          if (l.tipo === 'clase') reconciliarClase(clases, codigo, hueco.dia, hueco.horaInicio, l.clase);
        }
        const partes = ordenadas.filter((l) => !(l.tipo === 'clase' && !l.estrella)).map(nombreDe);
        horas.push({
          profeCodigo: codigo,
          ...hueco,
          actividadCodigo: principal?.hora.actividadCodigo ?? 'otros',
          etiqueta: [...new Set(partes)].join(' | '),
          crudo: lineas.join('\n'),
        });
        suyas++;
        continue;
      }

      for (const l of leidas) {
        if (l.tipo === 'detalle') continue;
        if (l.tipo === 'clase') {
          const r = reconciliarClase(clases, codigo, hueco.dia, hueco.horaInicio, l.clase);
          if (r === 'añadido') {
            const k = `${hoja.nombre}|${l.clase.curso}${l.clase.letra ? ` ${l.clase.letra}` : ''}|${textoLimpio(l.clase.materiaTexto)}`;
            añadidos.set(k, (añadidos.get(k) ?? 0) + 1);
          } else if (l.clase.aMano && r !== 'ya_estaba') {
            // A mano y sin clase donde encajarla: no se inventa una clase, se guarda como
            // hora del profe con su texto y se avisa.
            incidencias.push({
              tipo: 'solo_en_hoja_profe',
              detalle:
                r === 'ambiguo'
                  ? `${hoja.nombre} se apunta '${textoLimpio(l.linea)}', pero a esa hora hay varias clases que podrían ser: entra como hora suya, sin grupo`
                  : `${hoja.nombre} se apunta '${textoLimpio(l.linea)}', y la hoja de esa clase no tiene nada que case a esa hora: entra como hora suya, sin grupo`,
              crudo: textoLimpio(l.linea),
            });
            horas.push({ profeCodigo: codigo, ...hueco, actividadCodigo: 'otros', etiqueta: textoLimpio(l.linea), crudo: l.linea });
            suyas++;
          }
          continue;
        }
        if (l.tipo === 'hora') {
          horas.push({ profeCodigo: codigo, ...hueco, actividadCodigo: l.hora.actividadCodigo, etiqueta: l.hora.etiqueta, crudo: l.linea });
          suyas++;
          continue;
        }
        incidencias.push({
          tipo: 'actividad_desconocida',
          detalle: `'${textoLimpio(l.linea)}' en la hoja de ${hoja.nombre}: no se sabe qué es, entra como 'Otros' con ese texto`,
          crudo: textoLimpio(l.linea),
        });
        horas.push({ profeCodigo: codigo, ...hueco, actividadCodigo: 'otros', etiqueta: textoLimpio(l.linea), crudo: l.linea });
        suyas++;
      }
    }
    hojasProfe.push({ nombre: hoja.nombre, codigo, horas: suyas });
  }

  for (const [k, n] of añadidos) {
    const [nombre, grupo, materia] = k.split('|');
    ajustes.push(`${nombre} entra como segundo profe en ${materia} de ${grupo} (${n} h/semana): lo dice su hoja y la de la clase no la nombraba.`);
  }
  ajustes.push(...repartirProfesPdc(clases));
  const conTurno = horas.filter((h) => h.etiqueta?.includes(' | ')).length;
  if (conTurno) {
    ajustes.push(`${conTurno} celda(s) con asterisco (dos cosas en la misma hora, p. ej. 'COCOPE*' y 'DPTO') entran como una sola hora con las dos: 'Departamento | COCOPE'.`);
  }

  return { clases, horasProfe: agruparHorasDeProfe(horas), hojasProfe, incidencias, ajustes };
}
